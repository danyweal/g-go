import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { adminStorage } from '@/lib/firebaseAdmin';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || (session.user as unknown)?.role !== 'admin') {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const { filename, contentType } = req.body || {};
  if (!filename || !contentType) return res.status(400).json({ ok: false, error: 'Missing fields' });

  const uid = (session.user as unknown).email || 'admin';
  const id = uuidv4();
  const path = `media/${uid}/${Date.now()}_${id}_${filename}`;
  const file = adminStorage.file(path);

  const [uploadUrl] = await file.getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: Date.now() + 15 * 60 * 1000,
    contentType,
  });

  return res.status(200).json({ ok: true, uploadUrl, path });
}
