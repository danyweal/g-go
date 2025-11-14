import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { adminDb } from '@/lib/firebaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || (session.user as unknown)?.role !== 'admin') {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  const snap = await adminDb.collectionGroup('comments').where('approved','==', false).limit(200).get();
  const items = snap.docs.map(d => ({ id: d.id, path: d.ref.path, ...(d.data() as unknown) }));
  return res.status(200).json({ ok: true, items });
}
