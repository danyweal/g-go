// pages/api/payments/paypal/capture-order.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { adminDb, adminFieldValue } from '@/lib/firebaseAdmin';

const PP_ENV = (process.env.PAYPAL_ENV || 'live').toLowerCase();
const BASE = PP_ENV === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';

async function getAccessToken() {
  const id = process.env.PAYPAL_CLIENT_ID || '';
  const secret = process.env.PAYPAL_CLIENT_SECRET || '';
  const r = await fetch(`${BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64') },
    body: 'grant_type=client_credentials',
  });
  if (!r.ok) throw new Error('PayPal auth failed');
  const j = await r.json();
  return j.access_token as string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
    const { orderId, applicationId, formSnapshot } = req.body as { orderId: string; applicationId?: string; formSnapshot?: unknown };
    if (!orderId) return res.status(400).json({ ok: false, error: 'Missing orderId' });

    const token = await getAccessToken();
    const r = await fetch(`${BASE}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    const j = await r.json();

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

    await adminDb.collection('payments').doc(`pp_${orderId}`).set({
      applicationId: appId,
      provider: 'paypal',
      kind: 'one_time',
      orderId,
      status: 'captured',
      details: j || null,
      capturedAt: adminFieldValue.serverTimestamp(),
      updatedAt: adminFieldValue.serverTimestamp(),
    }, { merge: true });

    return res.status(200).json({ ok: true, applicationId: appId });
  } catch (e: unknown) {
    console.error('paypal capture error', e);
    return res.status(500).json({ ok: false, error: e?.message || 'PayPal error' });
  }
}
