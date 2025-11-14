import type { NextApiRequest, NextApiResponse } from 'next';
import { adminDb } from '@/lib/firebaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { slug } = req.query as { slug: string };
  if (!slug) return res.status(400).json({ ok: false, error: 'Missing slug' });
  const snap = await adminDb.collection('cms').doc('root').collection('news')
    .where('slug','==', slug).limit(1).get();
  if (snap.empty) return res.status(404).json({ ok: false, error: 'Not found' });
  const doc = snap.docs[0];
  const data = doc.data() as unknown;
  if (!data.published) return res.status(404).json({ ok: false, error: 'Not found' });
  return res.status(200).json({ ok: true, item: { id: doc.id, ...data } });
}
