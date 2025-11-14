import type { NextApiRequest, NextApiResponse } from 'next';
import admin from 'firebase-admin';
import { randomUUID } from 'crypto';
import { adminDb } from '@/lib/firebaseAdmin'; // ensures Admin SDK is initialized

// رفعت الحد قليلاً لأن الفيديوهات أكبر عادةً (عدّله حسب حاجتك)
export const config = { api: { bodyParser: { sizeLimit: '200mb' } } };

function safe(name: string) {
  return String(name || 'file').replace(/[^\w.\-]+/g, '_');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const { filename, contentType, data } = req.body || {};
    if (!filename || !contentType || !data) {
      return res.status(400).json({
        ok: false,
        error: 'filename, contentType and data (base64) are required',
      });
    }

    // يقبل فيديو فقط
    const ct = String(contentType);
    if (!ct.startsWith('video/')) {
      return res.status(400).json({ ok: false, error: 'Only video uploads are allowed' });
    }

    const bucket = admin.storage().bucket();
    const buffer = Buffer.from(String(data), 'base64');

    // تخزين الفيديوهات في مجلد فرعي منفصل
    const path = `cms/root/events/videos/${Date.now()}_${safe(filename)}`;
    const token = randomUUID();

    await bucket.file(path).save(buffer, {
      contentType: ct,
      metadata: { metadata: { firebaseStorageDownloadTokens: token } },
      resumable: false,
      public: false,
      validation: 'md5',
    });

    const downloadUrl =
      `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;

    return res.status(200).json({ ok: true, storagePath: path, contentType: ct, downloadUrl });
  } catch (err: unknown) {
    return res.status(500).json({ ok: false, error: err?.message || 'Server error' });
  }
}
