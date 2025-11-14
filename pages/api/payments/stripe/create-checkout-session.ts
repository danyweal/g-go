// pages/api/payments/stripe/create-checkout-session.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { adminDb, adminFieldValue } from '@/lib/firebaseAdmin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2024-06-20' });

// Allowed monthly amounts (GBP)
const ALLOWED_AMOUNTS = [11.99, 21.99, 49.99] as const;

// Build an absolute base URL for redirect URLs
function getAbsoluteBase(req: NextApiRequest) {
  const envBase =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.SITE_URL ||
    '';
  if (envBase) return envBase.replace(/\/$/, '');

  const proto =
    (req.headers['x-forwarded-proto'] as string) ||
    (req.headers['x-forwarded-protocol'] as string) ||
    'https';
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host;
  if (host) return `${proto}://${host}`;
  return 'http://localhost:3000';
}

function pickEnvPriceIdByAmount(amount?: number) {
  switch (Number(amount)) {
    case 11.99:
      return process.env.STRIPE_PRICE_SILVER || '';
    case 21.99:
      return process.env.STRIPE_PRICE_GOLD || '';
    case 49.99:
      return process.env.STRIPE_PRICE_DIAMOND || '';
    default:
      return '';
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    const {
      applicationId,
      priceId,
      amount,
      currency = 'GBP',
      mode = 'subscription',
      formSnapshot,
      tier, // 'silver' | 'gold' | 'diamond' (optional)
    } = (req.body || {}) as {
      applicationId?: string;
      priceId?: string;
      amount?: number;
      currency?: string;
      mode?: 'subscription' | 'payment';
      formSnapshot?: unknown;
      tier?: string;
    };

    if (mode !== 'subscription') {
      return res.status(400).json({ ok: false, error: 'Only subscription mode is supported' });
    }

    // Resolve a Stripe Price ID
    let usePriceId = (priceId || '').trim();
    if (!usePriceId && amount && ALLOWED_AMOUNTS.includes(Number(amount))) {
      usePriceId = pickEnvPriceIdByAmount(amount);
    }
    if (!usePriceId) {
      usePriceId = (process.env.NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID || '').trim();
    }

    // If still missing (dev fallback), create a price on the fly
    if (!usePriceId) {
      const product = await stripe.products.create({ name: 'Membership Subscription' });
      const unit_amount = Math.max(50, Math.round(Number(amount || 10) * 100));
      const createdPrice = await stripe.prices.create({
        currency,
        unit_amount,
        recurring: { interval: 'month' },
        product: product.id,
        nickname: 'Join Monthly',
      });
      usePriceId = createdPrice.id;
    }

    const base = getAbsoluteBase(req);
    const success_url = `${base}/join/subscribe?status=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancel_url = `${base}/join/subscribe?status=canceled`;

    // Keep metadata compact (Stripe limits apply)
    const metadata: Record<string, string> = { source: 'join' };
    if (applicationId) metadata.applicationId = String(applicationId);
    if (tier) metadata.tier = String(tier);
    if (!applicationId && formSnapshot) {
      try {
        const compact = Buffer.from(JSON.stringify(formSnapshot)).toString('base64');
        metadata.formSnapshot = compact.slice(0, 450);
      } catch {
        // ignore if encoding fails
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: usePriceId, quantity: 1 }],
      success_url,
      cancel_url,
      // NOTE: `customer_creation` is ONLY allowed in payment mode; do not use it here.
      client_reference_id: applicationId ? String(applicationId) : undefined,
      metadata,
      subscription_data: {
        metadata,
      },
    });

    // Store a lightweight record for later reconciliation
    await adminDb
      .collection('payments')
      .doc(`cs_${session.id}`)
      .set(
        {
          applicationId: applicationId || null,
          provider: 'stripe',
          kind: 'subscription',
          sessionId: session.id,
          status: 'created',
          createdAt: adminFieldValue.serverTimestamp(),
          currency,
          priceId: usePriceId,
          amount: amount ?? null,
          tier: tier || null,
          preApplication: applicationId ? null : formSnapshot || null,
        },
        { merge: true }
      );

    // Return both forms so the client can handle either
    return res.status(200).json({
      ok: true,
      url: session.url,
      sessionId: session.id,
      session: { id: session.id, url: session.url },
    });
  } catch (e: any) {
    console.error('stripe checkout error', e);
    return res.status(500).json({ ok: false, error: e?.message || 'Stripe error' });
  }
}
