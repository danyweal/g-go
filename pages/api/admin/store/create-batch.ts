// pages/api/admin/store/create-batch.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { adminDb } from '@/lib/firebaseAdmin';
import admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';

export const config = {
  api: { bodyParser: { sizeLimit: '100mb' } },
};

const GALLERIES = ['cms', 'root', 'stores'] as const;
const MEDIA = ['cms', 'root', 'media'] as const;

function slugify(input: string) {
  return String(input || 'gallery')
    .trim()
    .toLowerCase()
    .replace(/['"’`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'gallery';
}

async function ensureUniqueSlug(baseSlug: string) {
  const col = adminDb.collection(GALLERIES[0]).doc(GALLERIES[1]).collection(GALLERIES[2]);
  let slug = baseSlug;
  let i = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const snap = await col.where('slug', '==', slug).limit(1).get();
    if (snap.empty) return slug;
    i += 1;
    slug = `${baseSlug}-${i}`;
  }
}

function dataUrlToBuffer(dataUrl: string) {
  const s = String(dataUrl || '');
  const base64 = s.includes(',') ? s.split(',')[1] : s;
  return Buffer.from(base64, 'base64');
}
function isVideoContentType(ct: string) { return /^video\//i.test(ct); }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session || (session.user as unknown)?.role !== 'admin') {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

    const { title, description, published = false, files, primaryIndex = 0 } = req.body || {};
    if (!title) return res.status(400).json({ ok: false, error: 'Missing title' });
    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ ok: false, error: 'No files provided' });
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const slug = await ensureUniqueSlug(slugify(title));

    // Create album
    const galleryDoc = {
      title, slug, description: description || '',
      published: !!published,
      primaryMediaId: null as string | null, primaryMediaUrl: '',
      createdAt: now, updatedAt: now,
    };
    const galleries = adminDb.collection(GALLERIES[0]).doc(GALLERIES[1]).collection(GALLERIES[2]);
    const galleryRef = await galleries.add(galleryDoc);
    const groupId = galleryRef.id;

    // Upload files
    const bucket = admin.storage().bucket(); // default bucket
    const results: { id: string; downloadUrl: string; type: 'image'|'video' }[] = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i] || {};
      const filename = String(f.filename || `file_${i}`);
      const contentType = String(f.contentType || 'application/octet-stream');
      const buf = dataUrlToBuffer(String(f.dataUrl || ''));

      const id = uuidv4();
      const safeName = filename.replace(/[^\w.\-]+/g, '_');
      const storagePath = `media/${groupId}/${Date.now()}_${id}_${safeName}`;

      const file = bucket.file(storagePath);
      const token = uuidv4();
      await file.save(buf, {
        metadata: { contentType, metadata: { firebaseStorageDownloadTokens: token } },
        resumable: false, public: false,
      });

      const enc = encodeURIComponent(storagePath);
      const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${file.bucket.name}/o/${enc}?alt=media&token=${token}`;
      const type: 'image'|'video' = isVideoContentType(contentType) ? 'video' : 'image';

      const mediaDoc = {
        groupId, type, contentType, storagePath, downloadUrl,
        title: filename, published: !!published,
        likesCount: 0, commentsCount: 0,
        createdAt: now, updatedAt: now,
      };
      const mediaRef = await adminDb.collection(MEDIA[0]).doc(MEDIA[1]).collection(MEDIA[2]).add(mediaDoc);
      results.push({ id: mediaRef.id, downloadUrl, type });
    }

    // Primary
    const p = results[Math.max(0, Math.min(results.length - 1, primaryIndex))];
    await galleryRef.set({ primaryMediaId: p?.id || null, primaryMediaUrl: p?.downloadUrl || '', updatedAt: now }, { merge: true });

    return res.status(200).json({ ok: true, id: groupId, slug, items: results });
  } catch (err: unknown) {
    console.error('POST /api/admin/store/create-batch:', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Server error' });
  }
}
