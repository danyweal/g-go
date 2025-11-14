import type { NextApiRequest, NextApiResponse } from 'next';
import { adminDb } from '@/lib/firebaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query as { id: string };
  if (!id) return res.status(400).json({ ok: false, error: 'Missing id' });
  const doc = await adminDb.collection('cms').doc('root').collection('events').doc(id).get();
  if (!doc.exists) return res.status(404).json({ ok: false, error: 'Not found' });
  const data = doc.data() as unknown;
  if (!data.published) return res.status(404).json({ ok: false, error: 'Not found' });
  return res.status(200).json({ ok: true, item: { id: doc.id, ...data } });
}
