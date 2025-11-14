// pages/api/admin/news/delete-media.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { adminDb } from '@/lib/firebaseAdmin';
import admin from 'firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session || (session.user as unknown)?.role !== 'admin') {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ ok: false, error: 'method_not_allowed' });
    }

    const { mediaId } = req.body || {};
    if (!mediaId) return res.status(400).json({ ok: false, error: 'missing_mediaId' });

    const mediaRef = adminDb.collection('cms').doc('root').collection('media').doc(String(mediaId));
    const mDoc = await mediaRef.get();
    if (!mDoc.exists) return res.status(404).json({ ok: false, error: 'media_not_found' });
    const m: unknown = mDoc.data() || {};

    await mediaRef.delete();

    // Delete storage objects by decoding the url paths (main + thumb)
    try {
      const bucket = admin.storage().bucket();
      if (m?.url) {
        const url = new URL(String(m.url));
        const pathEnc = url.pathname.split('/o/')[1]?.split('?')[0];
        if (pathEnc) await bucket.file(decodeURIComponent(pathEnc)).delete({ ignoreNotFound: true });
      }
      if (m?.thumbUrl) {
        const url = new URL(String(m.thumbUrl));
        const pathEnc = url.pathname.split('/o/')[1]?.split('?')[0];
        if (pathEnc) await bucket.file(decodeURIComponent(pathEnc)).delete({ ignoreNotFound: true });
      }
    } catch {}

    // Update counters on news
    const newsId = String(m?.groupId || '');
    if (newsId) {
      const newsRef = adminDb.collection('cms').doc('root').collection('news').doc(newsId);
      const nDoc = await newsRef.get();
      const isVideo = m?.type === 'video';
      const updates: unknown = {
        mediaCount: admin.firestore.FieldValue.increment(-1),
        imageCount: admin.firestore.FieldValue.increment(isVideo ? 0 : -1),
        videoCount: admin.firestore.FieldValue.increment(isVideo ? -1 : 0),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      const data = nDoc.data() as unknown;
      if (data?.primaryMediaId === String(mediaId)) {
        updates.primaryMediaId = null;
        updates.primaryMediaUrl = null;
        updates.primaryMediaType = null;
        updates.primaryMediaThumbUrl = null;
      }
      await newsRef.set(updates, { merge: true });
    }

    return res.status(200).json({ ok: true });
  } catch (err: unknown) {
    console.error('POST /api/admin/news/delete-media:', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Server error' });
  }
}
