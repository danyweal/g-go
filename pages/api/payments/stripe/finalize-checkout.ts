// pages/api/payments/stripe/finalize-checkout.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { adminDb, adminFieldValue } from '@/lib/firebaseAdmin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2024-06-20' });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { session_id } = req.query as { session_id: string };
    if (!session_id) return res.status(400).json({ ok: false, error: 'Missing session_id' });

    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.payment_status !== 'paid') {
      return res.status(400).json({ ok: false, error: 'Session not paid' });
    }

    const docRef = adminDb.collection('payments').doc(`cs_${session_id}`);
    const snap = await docRef.get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: 'Payment doc not found' });
    const data = snap.data() || {};
    let applicationId = data.applicationId as string | null;

    // أنشئ الطلب لو مش موجود
    if (!applicationId) {
      const pre = data.preApplication || {};
      if (!pre || !pre.email) return res.status(400).json({ ok: false, error: 'Missing preApplication snapshot' });
      const now = adminFieldValue.serverTimestamp();
      const ref = await adminDb.collection('joinApplications').add({
        ...pre,
        status: 'submitted',
        paymentRequired: false,
        createdAt: now,
        updatedAt: now,
      });
      applicationId = ref.id;
      await ref.set({ id: applicationId }, { merge: true });
    }

    await docRef.set({
      applicationId,
      status: 'succeeded',
      updatedAt: adminFieldValue.serverTimestamp(),
    }, { merge: true });

    return res.status(200).json({ ok: true, applicationId });
  } catch (e: unknown) {
    console.error('finalize checkout error', e);
    return res.status(500).json({ ok: false, error: e?.message || 'Finalize error' });
  }
}
