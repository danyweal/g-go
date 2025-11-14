// pages/api/admin/gallery/upload-media.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebaseAdmin';
import { randomUUID } from 'crypto';

export const config = { api: { bodyParser: { sizeLimit: '64mb' } } };

function safe(name: string) {
  return String(name || 'file').replace(/[^\w.\-]+/g, '_');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session || (session.user as unknown)?.role !== 'admin') {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'method_not_allowed' }); }

    const {
      albumId, type, title = '', caption = '', filename: rawFilename, contentType, data,
      thumbData, thumbContentType = 'image/jpeg', setAsPrimary = false,
    } = req.body || {};

    if (!albumId) return res.status(400).json({ ok: false, error: 'missing_albumId' });
    const isVideo = type === 'video';
    if (!isVideo && type !== 'image') return res.status(400).json({ ok: false, error: 'bad_type' });
    if (!contentType || !data) return res.status(400).json({ ok: false, error: 'missing_file' });

    const albumRef = adminDb.collection('cms').doc('root').collection('galleries').doc(String(albumId));
    const albumDoc = await albumRef.get();
    if (!albumDoc.exists) return res.status(404).json({ ok: false, error: 'album_not_found' });

    const bucket = admin.storage().bucket();
    const filename = safe(rawFilename || (isVideo ? `video_${Date.now()}` : `image_${Date.now()}`));
    const objectPath = `cms/root/gallery/${albumId}/${filename}`;
    const buffer = Buffer.from(String(data), 'base64');
    const token = randomUUID();

    await bucket.file(objectPath).save(buffer, {
      contentType,
      metadata: { metadata: { firebaseStorageDownloadTokens: token } },
      resumable: false,
      public: false,
      validation: isVideo ? false : 'md5',
    });

    const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`;

    // Optional video thumbnail
    let thumbUrl: string | null = null;
    if (thumbData) {
      const thumbName = safe(`thumb_${filename.replace(/\.[^.]+$/, '')}.jpg`);
      const thumbPath = `cms/root/gallery/${albumId}/${thumbName}`;
      const tbuf = Buffer.from(String(thumbData), 'base64');
      const tkn = randomUUID();
      await bucket.file(thumbPath).save(tbuf, {
        contentType: thumbContentType,
        metadata: { metadata: { firebaseStorageDownloadTokens: tkn } },
        resumable: false,
        public: false,
        validation: 'md5',
      });
      thumbUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(thumbPath)}?alt=media&token=${tkn}`;
    }

    // Create media doc under cms/root/media
    const mediaDoc = {
      groupId: String(albumId),
      url: downloadUrl,
      type: isVideo ? ('video' as const) : ('image' as const),
      storagePath: objectPath,
      thumbUrl: thumbUrl ?? null,
      title: String(title || caption || ''),
      approved: true,
      createdAt: FieldValue.serverTimestamp(),
    };

    const mediaRef = await adminDb.collection('cms').doc('root').collection('media').add(mediaDoc);

    // Update album counters & possibly primary
    const updates: unknown = {
      mediaCount: FieldValue.increment(1),
      imageCount: FieldValue.increment(isVideo ? 0 : 1),
      videoCount: FieldValue.increment(isVideo ? 1 : 0),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const album = albumDoc.data() as unknown;
    if (setAsPrimary || !album?.primaryMediaUrl) {
      updates.primaryMediaId = mediaRef.id;
      updates.primaryMediaUrl = downloadUrl;
      updates.primaryMediaType = isVideo ? 'video' : 'image';
      updates.primaryMediaThumbUrl = thumbUrl ?? null;
    }

    await albumRef.set(updates, { merge: true });
    return res.status(200).json({ ok: true, id: mediaRef.id, downloadUrl, thumbUrl });
  } catch (err: unknown) {
    console.error('POST /api/admin/gallery/upload-media:', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Server error' });
  }
}
