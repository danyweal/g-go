import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebaseAdmin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-06-20',
});

const ZERO_DECIMAL = new Set([
  'BIF','CLP','DJF','GNF','JPY','KMF','KRW','MGA','PYG','RWF','UGX','VND','VUV','XAF','XOF','XPF'
]);
function minorToMajor(minor: number | null | undefined, currency: string) {
  const cur = (currency || '').toUpperCase();
  if (!minor || minor <= 0) return 0;
  return ZERO_DECIMAL.has(cur) ? minor : minor / 100;
}

/**
 * Public endpoint: verifies PaymentIntent with Stripe (server-side),
 * then atomically updates the campaign aggregates, idempotent by PI id.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    }

    const { paymentIntentId, campaignId: campaignIdFromBody } = req.body || {};
    if (!paymentIntentId) {
      return res.status(400).json({ ok: false, error: 'paymentIntentId required' });
    }

    // Retrieve PI securely
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ['latest_charge'] });
    const status = pi.status;
    const currency = (pi.currency || 'gbp').toUpperCase();
    const amountMajor = minorToMajor(pi.amount_received ?? pi.amount ?? 0, currency);

    const meta = (pi.metadata || {}) as Record<string, string>;
    const campaignId =
      (meta.campaignId || meta.campaign_id || meta.donationCampaignId || meta.donation_campaign_id || '') ||
      String(campaignIdFromBody || '').trim();

    if (!campaignId) {
      return res.status(400).json({ ok: false, error: 'campaignId missing in PI metadata/body' });
    }

    const isConfirmed =
      status === 'succeeded' || status === 'processing' || status === 'requires_capture';

    if (!isConfirmed) {
      return res.status(200).json({
        ok: true,
        message: `PaymentIntent status is ${status}; not updating aggregates yet.`,
      });
    }

    const campaignRef = adminDb.collection('campaigns').doc(campaignId);
    const paymentsRef = adminDb.collection('donationPayments');
    const donationsCol = adminDb.collection('donations');

    const donorName =
      [meta.donorFirstName || '', meta.donorLastName || '']
        .map((s) => s.trim())
        .filter(Boolean)
        .join(' ') || 'Anonymous';

    await adminDb.runTransaction(async (tx) => {
      // -------------------- READS FIRST --------------------
      const payDoc = paymentsRef.doc(paymentIntentId);
      const paySnap = await tx.get(payDoc);
      if (paySnap.exists && paySnap.get('counted') === true) {
        // Already counted; exit transaction without any writes
        return;
      }

      const campSnap = await tx.get(campaignRef);
      if (!campSnap.exists) {
        throw new Error(`Donation campaign not found: ${campaignId}`);
      }
      const c = campSnap.data() || {};
      const prevTotal = Number(c.totalDonated || 0);
      const prevDonors = Number(c.donorsCount || 0);
      const prevLast = Array.isArray(c.lastDonors) ? c.lastDonors : [];

      // -------------------- WRITES AFTER ALL READS --------------------
      const donationDoc = donationsCol.doc();
      tx.set(donationDoc, {
        campaignId,
        donorName,
        amount: amountMajor,
        currency,
        message: '',
        isAnonymous: false,
        status: 'confirmed',
        method: 'stripe',
        paymentRef: paymentIntentId,
        createdAt: Date.now(),
        confirmedAt: Date.now(),
      });

      const nextTotal = prevTotal + amountMajor;
      const nextDonors = prevDonors + 1;
      const donorEntry = { name: donorName, amount: amountMajor, at: Date.now() };
      const nextLast = [donorEntry, ...prevLast].slice(0, 10);

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

      tx.set(
        payDoc,
        {
          counted: true,
          donationId: donationDoc.id,
          campaignId,
          currency,
          amount: amountMajor,
          lastCountedAt: Date.now(),
        },
        { merge: true }
      );
    });

    return res.status(200).json({
      ok: true,
      paymentIntentId,
      campaignId,
      amount: amountMajor,
      currency,
      status,
    });
  } catch (e: any) {
    const code = e?.statusCode || e?.code;
    return res
      .status(code && Number.isFinite(+code) ? +code : 500)
      .json({ ok: false, error: e?.message || 'Server error' });
  }
}
