// pages/api/events/list.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { adminDb } from '@/lib/firebaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ ok: false, error: 'method_not_allowed' });
    }

    const snap = await adminDb
      .collection('cms').doc('root').collection('events')
      .where('published', '==', true)
      .get();

    const items = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as unknown) }))
      .sort((a: unknown, b: unknown) => {
        const aKey = String(a.dateISO || a.date || a.createdAtMillis || '');
        const bKey = String(b.dateISO || b.date || b.createdAtMillis || '');
        return bKey.localeCompare(aKey); // newest first
      });

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json({ ok: true, items });
  } catch (err: unknown) {
    console.error('GET /api/events/list:', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Server error' });
  }
}
