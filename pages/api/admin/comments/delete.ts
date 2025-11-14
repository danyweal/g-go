import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { adminDb } from '@/lib/firebaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || (session.user as unknown)?.role !== 'admin') {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  const { path } = req.body || {};
  if (!path) return res.status(400).json({ ok: false, error: 'Missing path' });
  const ref = adminDb.doc(String(path));
  await ref.delete();
  return res.status(200).json({ ok: true });
}
