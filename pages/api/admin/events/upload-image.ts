import type { NextApiRequest, NextApiResponse } from 'next';
import admin from 'firebase-admin';
import { randomUUID } from 'crypto';
import { adminDb } from '@/lib/firebaseAdmin'; // ensures Admin SDK is initialized

export const config = { api: { bodyParser: { sizeLimit: '100mb' } } };

function safe(name: string) { return String(name || 'file').replace(/[^\w.\-]+/g, '_'); }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  try {
    const { filename, contentType, data } = req.body || {};
    if (!filename || !contentType || !data) {
      return res.status(400).json({ ok: false, error: 'filename, contentType and data (base64) are required' });
    }
    if (!String(contentType).startsWith('image/')) {
      return res.status(400).json({ ok: false, error: 'Only image uploads are allowed' });
    }

    const bucket = admin.storage().bucket();
    const path = `cms/root/events/${Date.now()}_${safe(filename)}`;
    const buffer = Buffer.from(String(data), 'base64');
    const token = randomUUID();

    await bucket.file(path).save(buffer, {
      contentType,
      metadata: { metadata: { firebaseStorageDownloadTokens: token } },
      resumable: false,
      public: false,
      validation: 'md5',
    });

    const downloadUrl =
      `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;

    return res.status(200).json({ ok: true, storagePath: path, contentType, downloadUrl });
  } catch (err: unknown) {
    return res.status(500).json({ ok: false, error: err?.message || 'Server error' });
  }
}
