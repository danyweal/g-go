import type { NextApiRequest, NextApiResponse } from 'next';
import { stripe } from '@/lib/stripe';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    }
    const { customerId, returnPath = '/auth/admin/join' } = req.body as { customerId?: string; returnPath?: string };
    if (!customerId) return res.status(400).json({ ok: false, error: 'Missing customerId' });

    const base = process.env.NEXT_PUBLIC_SITE_URL;
    if (!base) throw new Error('Missing NEXT_PUBLIC_SITE_URL');

    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${base}${returnPath}`,
    });

    return res.status(200).json({ ok: true, url: portal.url });
  } catch (e: unknown) {
    console.error('create-portal-session error', e);
    return res.status(400).json({ ok: false, error: e?.message ?? 'Failed' });
  }
}
