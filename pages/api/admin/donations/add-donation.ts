import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { adminDb } from '@/lib/firebaseAdmin';

/** Ensure only admins can call this route */
function ensureAdmin(session: unknown) {
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role !== 'admin') throw Object.assign(new Error('Unauthorized'), { code: 401 });
}

/**
 * Adds an offline/Stripe-confirmed donation record AND **atomically updates**
 * the parent campaign's aggregate fields:
 *   - totalDonated (sum of confirmed donations)
 *   - donorsCount  (count of confirmed donations)
 *   - lastDonors   (rolling window of the latest donations)
 *
 * Idempotent-ish when `paymentRef` is provided: the same paymentRef
 * will not be counted twice toward aggregates.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  try {
    ensureAdmin(session);
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    }

    const body = req.body || {};
    const payload = {
      campaignId: String(body.campaignId || '').trim(),
      donorName: String(body.donorName || '').trim() || 'Anonymous',
      amount: Number(body.amount || 0),
      currency: String(body.currency || 'GBP').toUpperCase(),
      message: String(body.message || ''),
      isAnonymous: !!body.isAnonymous,
      status: String(body.status || 'confirmed'),
      method: String(body.method || 'offline'),
      paymentRef: body.paymentRef ? String(body.paymentRef) : null,
      createdAt: Date.now(),
      confirmedAt: String(body.status || 'confirmed') === 'confirmed' ? Date.now() : null,
    };

    if (!payload.campaignId || !payload.amount) {
      return res.status(400).json({ ok: false, error: 'campaignId/amount required' });
    }

    // References
    const campaignRef = adminDb.collection('campaigns').doc(payload.campaignId);
    const paymentsRef = adminDb.collection('donationPayments');
    const donationCol = adminDb.collection('donations');

    await adminDb.runTransaction(async (tx) => {
      // -------------------- READS FIRST --------------------
      let payDocRef: FirebaseFirestore.DocumentReference | null = null;
      let paySnap: FirebaseFirestore.DocumentSnapshot | null = null;

      if (payload.paymentRef) {
        payDocRef = paymentsRef.doc(payload.paymentRef);
        paySnap = await tx.get(payDocRef);
        if (paySnap.exists && paySnap.get('counted') === true) {
          // Already counted; ensure donation record exists (best effort) without touching aggregates.
          const existingId = paySnap.get('donationId');
          if (!existingId) {
            const newDonationRef = donationCol.doc();
            // (No further reads after this point in this branch)
            tx.set(newDonationRef, payload, { merge: true });
            tx.set(payDocRef, { donationId: newDonationRef.id }, { merge: true });
          }
          return; // idempotent exit with no aggregate writes
        }
      }

      // Read current campaign aggregates BEFORE any writes
      const campSnap = await tx.get(campaignRef);
      if (!campSnap.exists) {
        throw new Error(`Donation campaign not found for id "${payload.campaignId}"`);
      }
      const data = campSnap.data() || {};
      const prevTotal = Number(data.totalDonated || 0);
      const prevDonors = Number(data.donorsCount || 0);
      const prevLast = Array.isArray(data.lastDonors) ? data.lastDonors : [];

      // -------------------- WRITES AFTER ALL READS --------------------
      // Create the donation document
      const newDonationRef = donationCol.doc();
      tx.set(newDonationRef, payload, { merge: true });

      // Only confirmed donations affect aggregates
      const isConfirmed = payload.status === 'confirmed';
      const nextTotal = isConfirmed ? prevTotal + payload.amount : prevTotal;
      const nextDonors = isConfirmed ? prevDonors + 1 : prevDonors;

      const donorEntry = { name: payload.donorName || 'Anonymous', amount: payload.amount, at: Date.now() };
      const nextLast = isConfirmed ? [donorEntry, ...prevLast].slice(0, 10) : prevLast;

      // Write back campaign aggregates
      tx.set(
        campaignRef,
        {
          totalDonated: nextTotal,
          donorsCount: nextDonors,
          lastDonors: nextLast,
          updatedAt: Date.now(),
        },
        { merge: true }
      );

      // Mark paymentRef as counted to avoid double counting
      if (payload.paymentRef && payDocRef) {
        tx.set(
          payDocRef,
          {
            counted: isConfirmed ? true : false, // only mark as counted if it affected aggregates
            donationId: newDonationRef.id,
            campaignId: payload.campaignId,
            currency: payload.currency,
            amount: payload.amount,
            lastCountedAt: isConfirmed ? Date.now() : null,
          },
          { merge: true }
        );
      }
    });

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    return res.status(e?.code === 401 ? 401 : 500).json({ ok: false, error: e?.message || 'Server error' });
  }
}
