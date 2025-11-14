// pages/api/payments/attach.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { adminDb, adminFieldValue } from '@/lib/firebaseAdmin';

/** Collections your admin dashboard may use for donation campaigns.
 *  The code will try each in this order and stop at the first match. */
const CANDIDATE_COLLECTIONS = ['donations', 'donationCampaigns', 'campaigns'];

/** Find campaign doc by its document id across candidate collections. */
async function findCampaignById(campaignId: string) {
  for (const col of CANDIDATE_COLLECTIONS) {
    const ref = adminDb.collection(col).doc(campaignId);
    const snap = await ref.get();
    if (snap.exists) return { ref, snap, collection: col };
  }
  return null;
}

/** Transaction: idempotently record a donation and bump campaign totals. */
async function recordDonationAndUpdateTotals(opts: {
  campaignId: string;
  paymentRef: string; // Stripe PI id or other ref
  provider: 'stripe' | 'paypal';
  status: string;
  amount?: number;    // major units (e.g., 12.34)
  currency?: string;
  donor?: { firstName?: string; lastName?: string } | null;
}) {
  const { campaignId, paymentRef, provider, status, amount = 0, currency = 'GBP', donor } = opts;

  const campaign = await findCampaignById(campaignId);
  if (!campaign) {
    throw new Error(`Donation campaign not found for id "${campaignId}". If you use a different collection name, add it to CANDIDATE_COLLECTIONS.`);
  }

  const paymentDoc = adminDb.collection('donationPayments').doc(paymentRef);

  await adminDb.runTransaction(async (tx) => {
    const existing = await tx.get(paymentDoc);
    if (existing.exists) {
      // Already processed => no double counting
      return;
    }

    // Save payment record first to enforce idempotency
    const donorFirst = (donor?.firstName || '').trim();
    const donorLast = (donor?.lastName || '').trim();
    const donorFull = `${donorFirst} ${donorLast}`.trim() || 'Anonymous';

    tx.set(paymentDoc, {
      campaignId,
      provider,
      paymentRef,
      status,
      amount,
      currency: (currency || 'GBP').toUpperCase(),
      donor: {
        firstName: donorFirst || null,
        lastName: donorLast || null,
        fullName: donorFull,
      },
      createdAt: adminFieldValue.serverTimestamp(),
      updatedAt: adminFieldValue.serverTimestamp(),
    });

    // Only bump totals on succeeded to avoid counting incomplete payments
    if (String(status).toLowerCase() === 'succeeded' && amount > 0) {
      const campSnap = await tx.get(campaign.ref);
      if (!campSnap.exists) throw new Error('Campaign disappeared during transaction.');

      const data = campSnap.data() || {};
      const prevTotal = Number(data.totalDonated || 0);
      const prevDonors = Number(data.donorsCount || 0);
      const prevLast = Array.isArray(data.lastDonors) ? data.lastDonors : [];

      const newEntry = { name: donorFull, amount: Number(amount), at: Date.now() };

      tx.update(campaign.ref, {
        totalDonated: prevTotal + Number(amount),
        donorsCount: prevDonors + 1,
        lastDonors: prevLast.concat([newEntry]).slice(-20), // keep last 20 donors
        updatedAt: adminFieldValue.serverTimestamp(),
      });
    }
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

    // Accept both join (applicationId) and donation (campaignId)
    const {
      provider,
      ref,
      status,
      amount,
      currency,
      applicationId,                 // join flow
      campaignId,                    // donation flow (IMPORTANT — admin campaign doc id)
      donor,                         // optional donor { firstName, lastName }
    }: {
      provider: 'stripe' | 'paypal';
      ref: string;
      status: string;
      amount?: number;
      currency?: string;
      applicationId?: string;
      campaignId?: string;
      donor?: { firstName?: string; lastName?: string };
    } = req.body || {};

    if (!provider || !ref) {
      return res.status(400).json({ ok: false, error: 'Missing params: provider, ref are required' });
    }

    // ---------------- Existing JOIN behavior (kept) ----------------
    if (applicationId) {
      // Use the raw ref as the doc id to align with webhook idempotency
      const payRef = ref;
      await adminDb.collection('payments').doc(payRef).set(
        {
          applicationId,
          provider,
          status,
          amount: typeof amount === 'number' ? amount : null,
          currency: currency ?? null,
          updatedAt: adminFieldValue.serverTimestamp(),
          createdAt: adminFieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return res.status(200).json({ ok: true, scope: 'join', ref: payRef });
    }

    // ---------------- NEW: DONATION behavior ----------------
    if (campaignId) {
      const paymentRef = ref; // keep it identical to Stripe PI id so webhook & UI share the same idempotency key

      // Save basic donation payment doc immediately
      await adminDb.collection('donationPayments').doc(paymentRef).set(
        {
          campaignId,
          provider,
          paymentRef,
          status,
          amount: typeof amount === 'number' ? amount : null,
          currency: (currency || null) as string | null,
          donor: donor || null,
          updatedAt: adminFieldValue.serverTimestamp(),
          createdAt: adminFieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // If payment already succeeded, idempotently bump totals now
      if (String(status).toLowerCase() === 'succeeded' && typeof amount === 'number' && amount > 0) {
        try {
          await recordDonationAndUpdateTotals({
            campaignId: String(campaignId),
            paymentRef: paymentRef,
            provider,
            status,
            amount,
            currency: currency || 'GBP',
            donor: donor || undefined,
          });
        } catch (err) {
          // If this throws because the campaign isn't found or already processed,
          // we still return ok:true so the client isn't blocked.
          console.error('attach donation totals update error:', err);
        }
      }

      return res.status(200).json({ ok: true, scope: 'donation', ref: paymentRef });
    }

    // If neither id provided
    return res.status(400).json({ ok: false, error: 'Provide either applicationId (join) or campaignId (donation).' });
  } catch (e: any) {
    console.error('attach error', e);
    return res.status(500).json({ ok: false, error: e?.message || 'Attach error' });
  }
}
