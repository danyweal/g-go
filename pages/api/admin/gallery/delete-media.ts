// pages/api/admin/gallery/delete-media.ts
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
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'method_not_allowed' }); }

    const { id } = req.body || {};
    if (!id) return res.status(400).json({ ok: false, error: 'Missing id' });

    const mediaRef = adminDb.collection('cms').doc('root').collection('media').doc(String(id));
    const snap = await mediaRef.get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: 'Media not found' });
    const m = snap.data() as unknown;

    const bucket = admin.storage().bucket();

    // Delete original file by storagePath
    if (m?.storagePath) { try { await bucket.file(String(m.storagePath)).delete({ ignoreNotFound: true }); } catch {} }

    // Delete thumb by parsing ?o= path from URL
    if (m?.thumbUrl) {
      try {
        const url = new URL(String(m.thumbUrl));
        const pathEnc = url.searchParams.get('o');
        if (pathEnc) await bucket.file(decodeURIComponent(pathEnc)).delete({ ignoreNotFound: true });
      } catch {}
    }

    // Update album counters & primary fallback
    const albumId = String(m?.groupId || '');
    if (albumId) {
      const albumRef = adminDb.collection('cms').doc('root').collection('galleries').doc(albumId);
      const aDoc = await albumRef.get();
      const isVideo = m?.type === 'video';

      await albumRef.set({
        mediaCount: admin.firestore.FieldValue.increment(-1),
        imageCount: admin.firestore.FieldValue.increment(isVideo ? 0 : -1),
        videoCount: admin.firestore.FieldValue.increment(isVideo ? -1 : 0),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      const a = aDoc.data() as unknown;
      if (a?.primaryMediaId === String(id)) {
        const qs = await adminDb.collection('cms').doc('root').collection('media')
          .where('groupId', '==', albumId)
          .orderBy('createdAt', 'desc')
          .limit(1)
          .get();

        if (!qs.empty) {
          const nn = qs.docs[0];
          const nm: unknown = nn.data();
          await albumRef.set({
            primaryMediaId: nn.id,
            primaryMediaUrl: nm.url ?? '',
            primaryMediaType: nm.type === 'video' ? 'video' : 'image',
            primaryMediaThumbUrl: nm.thumbUrl ?? null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });
        } else {
          await albumRef.set({
            primaryMediaId: null,
            primaryMediaUrl: null,
            primaryMediaType: null,
            primaryMediaThumbUrl: null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });
        }
      }
    }

    await mediaRef.delete();
    return res.status(200).json({ ok: true });
  } catch (err: unknown) {
    console.error('POST /api/admin/gallery/delete-media:', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Server error' });
  }
}
