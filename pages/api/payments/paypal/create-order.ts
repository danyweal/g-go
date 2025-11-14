// pages/api/payments/paypal/create-order.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getAccessToken, PAYPAL_BASE } from '@/lib/paypal';
import { adminDb } from '@/lib/firebaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });

    const { applicationId, amountMinor, currency = 'GBP', description = 'Membership' } = req.body || {};
    if (!applicationId) throw new Error('applicationId required');
    if (!amountMinor || amountMinor <= 0) throw new Error('amountMinor required');

    const token = await getAccessToken();

    const r = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: currency,
              value: (amountMinor / 100).toFixed(2),
            },
            description,
            custom_id: applicationId,
          },
        ],
        application_context: {
          shipping_preference: 'NO_SHIPPING',
          user_action: 'PAY_NOW',
        },
      }),
    });

    const j = await r.json();
    if (!r.ok) {
      console.error('paypal create order error', j);
      throw new Error(j?.message || 'PayPal create order failed');
    }

    // اختياري: تخزين رقم الطلب
    await adminDb.collection('joinApplications').doc(String(applicationId)).update({
      lastPayPalOrderId: j.id,
      updatedAt: new Date(),
    });

    return res.status(200).json({ ok: true, orderId: j.id });
  } catch (e: unknown) {
    console.error('paypal create-order err', e);
    return res.status(400).json({ ok: false, error: e?.message || 'Failed' });
  }
}
