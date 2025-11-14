import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { adminDb, adminStorage } from '@/lib/firebaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || (session.user as unknown)?.role !== 'admin') {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  const { id, storagePath } = req.body || {};
  if (!id) return res.status(400).json({ ok: false, error: 'Missing id' });
  await adminDb.collection('cms').doc('root').collection('media').doc(String(id)).delete();
  if (storagePath) {
    await adminStorage.file(String(storagePath)).delete({ ignoreNotFound: true }).catch(() => {});
  }
  return res.status(200).json({ ok: true });
}
