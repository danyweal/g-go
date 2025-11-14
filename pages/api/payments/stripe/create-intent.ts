// pages/api/payments/stripe/create-intent.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { adminDb, adminFieldValue } from '@/lib/firebaseAdmin';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

const ZERO_DECIMAL = new Set([
  'BIF','CLP','DJF','GNF','JPY','KMF','KRW','MGA','PYG','RWF','UGX','VND','VUV','XAF','XOF','XPF'
]);

/** Convert major units to Stripe-required minor units. */
function toMinor(amountMajor: number, currency: string) {
  const cur = (currency || 'GBP').toUpperCase();
  // Keep your old "GBP min = 50 minor units (i.e. £0.50)" logic.
  return ZERO_DECIMAL.has(cur)
    ? Math.max(1, Math.round(amountMajor))
    : Math.max(50, Math.round(amountMajor * 100));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    if (!STRIPE_SECRET_KEY) {
      return res.status(500).json({ ok: false, error: 'Missing STRIPE_SECRET_KEY' });
    }

    const {
      applicationId,               // JOIN page (legacy) — keep
      amount,                      // major units (e.g., 12.34)
      currency = 'GBP',
      preApplication,              // JOIN pre-application payload (legacy)
      metadata = {},               // DONATION flow sends campaign info here
    } = (req.body || {}) as {
      applicationId?: string;
      amount: number | string;
      currency?: string;
      preApplication?: unknown;
      metadata?: Record<string, any>;
    };

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ ok: false, error: 'Invalid amount' });
    }

    const cur = (currency || 'GBP').toUpperCase();
    const minor = toMinor(amt, cur);

    // Detect donation vs join from metadata.type (client sends 'donation')
    const typeRaw = String(metadata?.type || '').toLowerCase();
    const isDonation = typeRaw === 'donation';

    // Pull campaignId from any alias the client might send
    const campaignId: string | null =
      metadata?.campaignId ??
      metadata?.campaign_id ??
      metadata?.donationCampaignId ??
      metadata?.donation_campaign_id ??
      null;

    const campaignSlug: string =
      metadata?.campaignSlug ??
      metadata?.slug ??
      '';

    // If this is a donation flow, require a campaignId (prevents orphaned PIs)
    if (isDonation && !campaignId) {
      return res.status(400).json({ ok: false, error: 'campaignId is required for donations' });
    }

    // Normalize metadata for downstream consumers (webhooks, confirm route, admin tools)
    const normMeta: Record<string, string> = {
      // Canonical markers
      type: isDonation ? 'donation' : 'join',
      source: isDonation ? 'donation' : 'join',

      // JOIN fields (kept for backward compatibility)
      applicationId: applicationId || '',

      // DONATION canonical keys
      campaignId: campaignId ? String(campaignId) : '',
      campaignSlug: campaignSlug ? String(campaignSlug) : '',
      donorFirstName: metadata?.donorFirstName ? String(metadata.donorFirstName) : '',
      donorLastName: metadata?.donorLastName ? String(metadata.donorLastName) : '',

      // Aliases (older code may read these)
      campaign_id: campaignId ? String(campaignId) : '',
      donationCampaignId: campaignId ? String(campaignId) : '',
      donation_campaign_id: campaignId ? String(campaignId) : '',
      slug: campaignSlug ? String(campaignSlug) : '',
    };

    // Create the PaymentIntent with unified metadata
    const intent = await stripe.paymentIntents.create({
      amount: minor,
      currency: cur.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: normMeta,
    });

    // Persist a canonical "created" record where your admin expects it.
    // Using a single 'payments' collection keeps things tidy for dashboards.
    const payDocId = `pi_${intent.id}`;
    await adminDb.collection('payments').doc(payDocId).set(
      {
        provider: 'stripe',
        kind: 'one_time',
        intentId: intent.id,

        // JOIN fields
        applicationId: applicationId || null,
        preApplication: applicationId ? null : (preApplication ?? null),

        // DONATION fields
        campaignId: isDonation && campaignId ? String(campaignId) : null,
        campaignSlug: isDonation && campaignSlug ? String(campaignSlug) : null,

        // Amount/currency
        amount: amt,               // stored in major units for UI
        amountMinor: minor,        // useful for reconciliation
        currency: cur,

        status: 'created',
        createdAt: adminFieldValue.serverTimestamp(),
        updatedAt: adminFieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // (Optional) Mirror a lightweight idempotency record for confirm route parity:
    // adminDb.collection('donationPayments').doc(intent.id).set(
    //   { counted: false, createdAt: adminFieldValue.serverTimestamp() },
    //   { merge: true }
    // );

    return res.status(200).json({
      ok: true,
      clientSecret: intent.client_secret,
      intentId: intent.id,
      currency: cur,
    });
  } catch (e: any) {
    console.error('stripe intent error', e);
    return res.status(500).json({ ok: false, error: e?.message || 'Stripe error' });
  }
}
