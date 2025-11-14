import type { NextApiRequest, NextApiResponse } from 'next';
import { adminDb } from '@/lib/firebaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const snap = await adminDb.collection('cms').doc('root').collection('events').get();
  const items = snap.docs.map(d => ({ id: d.id, ...(d.data() as unknown) }));
  return res.status(200).json({ ok: true, items });
}
