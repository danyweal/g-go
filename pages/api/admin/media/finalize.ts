import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { adminDb, adminStorage } from '@/lib/firebaseAdmin';
import { v4 as uuidv4 } from 'uuid';

function publicDownloadUrl(bucket: string, path: string, token: string) {
  const enc = encodeURIComponent(path);
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${enc}?alt=media&token=${token}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || (session.user as unknown)?.role !== 'admin') {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const { storagePath, title = '', description = '', published = true, contentType = '' } = req.body || {};
  if (!storagePath) return res.status(400).json({ ok: false, error: 'Missing storagePath' });

  const file = adminStorage.file(String(storagePath));

  // Ensure the file has a download token so we can make a long-lived URL
  const token = uuidv4();
  await file.setMetadata({
    contentType: contentType || undefined,
    metadata: { firebaseStorageDownloadTokens: token },
  }).catch(() => {});

  const [metadata] = await file.getMetadata().catch(() => [{ contentType } as unknown]);
  const bucket = file.bucket.name;
  const url = publicDownloadUrl(bucket, String(storagePath), token);

  const now = Date.now();
  const type = (metadata?.contentType || contentType || '').startsWith('video/') ? 'video' : 'image';
  const doc = {
    title,
    description,
    type,
    contentType: metadata?.contentType || contentType || '',
    storagePath,
    downloadUrl: url, // long-lived token URL
    published,
    likesCount: 0,
    commentsCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  const ref = await adminDb.collection('cms').doc('root').collection('media').add(doc);
  return res.status(200).json({ ok: true, id: ref.id, doc });
}
