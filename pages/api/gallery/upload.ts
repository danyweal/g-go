// pages/api/admin/media/upload.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { adminDb, adminStorage } from '@/lib/firebaseAdmin';
import admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';

export const config = {
  api: {
    bodyParser: { sizeLimit: '100mb' },
  },
};

// Firestore: cms/root/media
// Storage:   cms/root/media/{uid}/{timestamp}_{uuid}_{safe-filename}
const MEDIA_COLLECTION_PATH = ['cms', 'root', 'media'] as const;
const STORAGE_FOLDER_PREFIX = 'cms/root/media';

function safe(name: string) {
  return String(name || 'file').replace(/[^\w.\-]+/g, '_');
}

function publicDownloadUrl(bucket: string, path: string, token: string) {
  const enc = encodeURIComponent(path);
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${enc}?alt=media&token=${token}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const isDev = process.env.NODE_ENV !== 'production';
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session || (session.user as unknown)?.role !== 'admin') {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

    const {
      filename,
      contentType,
      data, // base64 (raw or dataURL)
      title = '',
      description = '',
      published = true,
    } = (req.body || {}) as unknown;

    if (!filename || !contentType || !data) {
      return res.status(400).json({ ok: false, error: 'Missing filename/contentType/data' });
    }
    if (!adminStorage || !adminStorage.name) {
      return res.status(500).json({ ok: false, error: 'Storage bucket is not configured' });
    }

    // Prepare binary
    const raw = String(data);
    const base64 = raw.includes(',') ? raw.split(',').pop()! : raw;
    let buffer: Buffer;
    try { buffer = Buffer.from(base64, 'base64'); }
    catch { return res.status(400).json({ ok: false, error: 'Invalid base64 data' }); }
    if (!buffer?.length) return res.status(400).json({ ok: false, error: 'Empty file buffer' });

    // Compose storage path
    const uidPart = safe(((session.user as unknown)?.email || 'admin').split('@')[0] || 'admin');
    const id = uuidv4();
    const stamp = Date.now();
    const name = safe(filename);
    const storagePath = `${STORAGE_FOLDER_PREFIX}/${uidPart}/${stamp}_${id}_${name}`;

    // Upload to Storage
    const file = adminStorage.file(storagePath);
    const token = uuidv4();
    await file.save(buffer, {
      resumable: false,
      contentType,
      metadata: {
        contentType,
        cacheControl: 'public, max-age=31536000',
        metadata: { firebaseStorageDownloadTokens: token },
      },
    });

    const bucket = adminStorage.name;
    const downloadUrl = publicDownloadUrl(bucket, storagePath, token);
    const kind = String(contentType).toLowerCase().startsWith('video/') ? 'video' : 'image';

    // Prepare Firestore document (server timestamps)
    const nowTs = admin.firestore.FieldValue.serverTimestamp();
    const doc = {
      title: String(title || ''),
      description: String(description || ''),
      published: Boolean(published),
      type: kind as 'image' | 'video',
      contentType: String(contentType),
      storagePath,
      downloadUrl,
      likes: 0,
      dislikes: 0,
      emojis: {} as Record<string, number>,
      commentsCount: 0,
      createdAt: nowTs,
      updatedAt: nowTs,
    };

    // Write to Firestore: cms/root/media
    const ref = await adminDb
      .collection(MEDIA_COLLECTION_PATH[0])
      .doc(MEDIA_COLLECTION_PATH[1])
      .collection(MEDIA_COLLECTION_PATH[2])
      .add(doc);

    return res.status(200).json({
      ok: true,
      id: ref.id,
      doc: { id: ref.id, ...doc },
      _meta: isDev ? { bucket, storagePath } : undefined,
    });
  } catch (err: unknown) {
    console.error('Upload failed:', err);
    return res.status(500).json({
      ok: false,
      error: 'Upload failed',
      detail: process.env.NODE_ENV !== 'production' ? String(err?.message || err) : undefined,
      code: process.env.NODE_ENV !== 'production' ? err?.code : undefined,
    });
  }
}
