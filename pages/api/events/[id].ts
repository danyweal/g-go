// pages/api/events/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { adminDb } from '@/lib/firebaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ ok: false, error: 'method_not_allowed' });
    }

    const { id } = req.query as { id?: string };
    if (!id) return res.status(400).json({ ok: false, error: 'missing_id' });

    const doc = await adminDb
      .collection('cms').doc('root').collection('events')
      .doc(id)
      .get();

    if (!doc.exists) return res.status(404).json({ ok: false, error: 'not_found' });

    const data = doc.data() as unknown;
    if (!data?.published) return res.status(404).json({ ok: false, error: 'not_found' });

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json({ ok: true, item: { id: doc.id, ...data } });
  } catch (err: unknown) {
    console.error('GET /api/events/[id]:', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Server error' });
  }
}
