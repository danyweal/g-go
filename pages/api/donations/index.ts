import type { NextApiRequest, NextApiResponse } from 'next';
import { adminDb } from '@/lib/firebaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { slug, status } = req.query as { slug?: string; status?: string };

    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    }

    if (slug) {
      const qs = await adminDb.collection('campaigns').where('slug', '==', slug).limit(1).get();
      if (qs.empty) return res.status(404).json({ ok: false, error: 'Not found' });
      const doc = qs.docs[0];
      return res.status(200).json({ ok: true, item: { id: doc.id, ...(doc.data() as unknown) } });
    }

    const ref = adminDb.collection('campaigns').orderBy('startAt', 'desc');
    if (status) {
      const all = await ref.get();
      const items = all.docs.map(d => ({ id: d.id, ...(d.data() as unknown) }))
        .filter((x: unknown) => String(x.status) === String(status));
      return res.status(200).json({ ok: true, items });
    } else {
      const snap = await ref.get();
      const items = snap.docs.map(d => ({ id: d.id, ...(d.data() as unknown) }));
      return res.status(200).json({ ok: true, items });
    }
  } catch (e: unknown) {
    return res.status(500).json({ ok: false, error: e?.message || 'Server error' });
  }
}
