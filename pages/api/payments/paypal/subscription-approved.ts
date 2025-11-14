// pages/api/payments/paypal/subscription-approved.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { adminDb, adminFieldValue } from '@/lib/firebaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
    const { subscriptionId, applicationId, formSnapshot } = req.body as { subscriptionId: string; applicationId?: string; formSnapshot?: unknown };
    if (!subscriptionId) return res.status(400).json({ ok: false, error: 'Missing subscriptionId' });

    let appId = applicationId || null;
    if (!appId) {
      if (!formSnapshot || !formSnapshot.email) return res.status(400).json({ ok: false, error: 'Missing form snapshot' });
      const now = adminFieldValue.serverTimestamp();
      const ref = await adminDb.collection('joinApplications').add({
        ...formSnapshot,
        status: 'submitted',
        paymentRequired: false,
        createdAt: now,
        updatedAt: now,
      });
      appId = ref.id;
      await ref.set({ id: appId }, { merge: true });
    }

    await adminDb.collection('payments').doc(`pps_${subscriptionId}`).set({
      applicationId: appId,
      provider: 'paypal',
      kind: 'subscription',
      subscriptionId,
      status: 'approved',
      createdAt: adminFieldValue.serverTimestamp(),
      updatedAt: adminFieldValue.serverTimestamp(),
    }, { merge: true });

    return res.status(200).json({ ok: true, applicationId: appId });
  } catch (e: unknown) {
    console.error('paypal sub approved error', e);
    return res.status(500).json({ ok: false, error: e?.message || 'PayPal error' });
  }
}
