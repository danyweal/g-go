import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { adminStorage } from '@/lib/firebaseAdmin';
import { v4 as uuidv4 } from 'uuid';

export const config = { api: { bodyParser: { sizeLimit: '200mb' } } };

function safe(name: string) { return String(name || 'file').replace(/[^\w.\-]+/g, '_'); }
function publicDownloadUrl(bucket: string, path: string, token: string) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session || (session.user as unknown)?.role !== 'admin') {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    if (req.method !== 'POST') { res.setHeader('Allow', ['POST']); return res.status(405).json({ ok: false, error: 'Method Not Allowed' }); }

    const { dataURL, filename } = req.body || {};
    if (!dataURL || !filename) return res.status(400).json({ ok: false, error: 'dataURL/filename required' });

    const match = String(dataURL).match(/^data:(.+);base64,(.*)$/);
    if (!match) return res.status(400).json({ ok: false, error: 'Invalid data URL' });

    const contentType = match[1];
    const buffer = Buffer.from(match[2], 'base64');

    const ts = Date.now();
    const token = uuidv4();
    const path = `donations/admin/${ts}_${uuidv4()}_${safe(filename)}`;
    const file = adminStorage.file(path);

    await file.save(buffer, {
      resumable: false,
      contentType,
      metadata: { contentType, metadata: { firebaseStorageDownloadTokens: token }, cacheControl: 'public, max-age=31536000' },
    });

    const downloadUrl = publicDownloadUrl((adminStorage as unknown).name, path, token);
    const type = String(contentType).startsWith('video/') ? 'video' : 'image';

    return res.status(200).json({ ok: true, type, storagePath: path, contentType, downloadUrl });
  } catch (err: unknown) {
    return res.status(500).json({ ok: false, error: err?.message || 'Upload failed' });
  }
}
