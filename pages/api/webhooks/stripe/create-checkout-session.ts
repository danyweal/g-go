import type { NextApiRequest, NextApiResponse } from 'next';
import { stripe } from '@/lib/stripe';
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    }
    const { applicationId } = req.body as { applicationId?: string };
    if (!applicationId) return res.status(400).json({ ok: false, error: 'Missing applicationId' });

    const snap = await adminDb.collection('joinApplications').doc(applicationId).get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: 'Application not found' });

    const app = snap.data() as unknown;
    const amount = Number(app?.feeCents || 0);
    if (app.membershipPlan !== 'monthly' || amount <= 0) {
      return res.status(400).json({ ok: false, error: 'Application is not monthly or amount invalid' });
    }

    const site = process.env.NEXT_PUBLIC_SITE_URL;
    if (!site) throw new Error('Missing NEXT_PUBLIC_SITE_URL');

    let customerId: string | undefined = app.stripeCustomerId || undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: app.email, name: app.fullName, metadata: { applicationId },
      });
      customerId = customer.id;
      await snap.ref.update({ stripeCustomerId: customerId, updatedAt: FieldValue.serverTimestamp() });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'gbp',
          product_data: { name: 'PSANW Membership (Monthly)' },
          recurring: { interval: 'month' },
          unit_amount: amount,
        },
      }],
      allow_promotion_codes: true,
      metadata: { applicationId },
      success_url: `${site}/auth/admin/join/${applicationId}?checkout=success`,
      cancel_url: `${site}/auth/admin/join/${applicationId}?checkout=cancelled`,
    });

    await snap.ref.update({ stripeCheckoutSessionId: session.id, updatedAt: FieldValue.serverTimestamp() });
    return res.status(200).json({ ok: true, url: session.url });
  } catch (e: unknown) {
    console.error('create-checkout-session error', e);
    return res.status(400).json({ ok: false, error: e?.message ?? 'Failed' });
  }
}
