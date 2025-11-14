// pages/api/donations/record-payment.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { adminDb, adminFieldValue } from '@/lib/firebaseAdmin';

/**
 * Body (JSON):
 * {
 *   provider: 'stripe',
 *   paymentIntentId: string,   // required (Stripe)
 *   status: string,            // 'succeeded' | 'processing' | ...
 *   campaignId: string,        // required: donation campaign doc id from admin
 *   amount: number,            // major units (e.g. 1.00)
 *   amountMinor?: number,      // optional; if omitted we derive from amount
 *   currency: string,          // e.g. 'GBP'
 *   campaignSlug?: string,     // optional for debugging/reconciliation
 *   donor?: { firstName?: string; lastName?: string }
 * }
 *
 * Behavior:
 * - Upserts a payment doc at: payments/pi_<paymentIntentId>
 * - If this is the first time the payment reaches 'succeeded', atomically increments:
 *      donations/<campaignId>.totalDonated += amount
 *      donations/<campaignId>.donorsCount += 1
 * - Idempotent: re-calls with the same pi + 'succeeded' won't double count.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    const {
      provider,
      paymentIntentId,
      status,
      campaignId,
      amount,
      amountMinor,
      currency,
      donor,
      campaignSlug,
    } = (req.body || {}) as {
      provider?: 'stripe' | string;
      paymentIntentId?: string;
      status?: string;
      campaignId?: string;
      amount?: number;
      amountMinor?: number;
      currency?: string;
      donor?: { firstName?: string; lastName?: string } | null;
      campaignSlug?: string;
    };

    // ---- Basic validation
    if (provider !== 'stripe') {
      return res.status(400).json({ ok: false, error: 'Invalid or missing provider (expected "stripe")' });
    }
    if (!paymentIntentId || typeof paymentIntentId !== 'string') {
      return res.status(400).json({ ok: false, error: 'Missing paymentIntentId' });
    }
    if (!campaignId || typeof campaignId !== 'string') {
      return res.status(400).json({ ok: false, error: 'Missing campaignId' });
    }
    const amountNumber = Number(amount);
    if (!isFinite(amountNumber) || amountNumber <= 0) {
      return res.status(400).json({ ok: false, error: 'Invalid amount' });
    }
    const currencyStr = String(currency || 'GBP').toUpperCase();
    const now = adminFieldValue.serverTimestamp();

    // ---- Idempotent payment doc key
    const payDocId = `pi_${paymentIntentId.replace(/^pi_/, '')}`;
    const payRef = adminDb.collection('payments').doc(payDocId);
    const campRef = adminDb.collection('donations').doc(campaignId);

    // ---- Transaction: upsert payment + (if first success) increment campaign totals
    await adminDb.runTransaction(async (tx) => {
      const [paySnap, campSnap] = await Promise.all([tx.get(payRef), tx.get(campRef)]);

      const prevStatus = paySnap.exists ? String(paySnap.data()?.status || '') : '';
      const alreadySucceeded = prevStatus === 'succeeded';

      // Always upsert the payment row (audit trail)
      tx.set(
        payRef,
        {
          provider: 'stripe',
          kind: 'one_time',
          campaignId,
          campaignSlug: campaignSlug || null,
          paymentIntentId,
          amount: amountNumber, // store major units for readability
          amountMinor:
            Number.isFinite(amountMinor as number)
              ? Math.round(Number(amountMinor))
              : Math.round(amountNumber * 100),
          currency: currencyStr,
          status: status || 'succeeded',
          donor: donor || null,
          updatedAt: now,
          createdAt: paySnap.exists ? paySnap.data()?.createdAt || now : now,
        },
        { merge: true }
      );

      // Only increment totals if we are transitioning into 'succeeded'
      // and haven't counted this payment before.
      const isNowSucceeded = status === 'succeeded';
      if (isNowSucceeded && !alreadySucceeded) {
        if (!campSnap.exists) {
          // Initialize the campaign doc minimally if it somehow doesn't exist
          tx.set(
            campRef,
            {
              totalDonated: 0,
              donorsCount: 0,
              currency: currencyStr,
              createdAt: now,
              updatedAt: now,
            },
            { merge: true }
          );
        }

        tx.update(campRef, {
          totalDonated: adminFieldValue.increment(amountNumber),
          donorsCount: adminFieldValue.increment(1),
          updatedAt: now,
        });
      }
    });

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    console.error('[record-payment] error', e);
    return res.status(500).json({ ok: false, error: e?.message || 'Internal error' });
  }
}
