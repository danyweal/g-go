// pages/api/admin/events/delete-media.ts
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

    if (m?.storagePath) { try { await bucket.file(String(m.storagePath)).delete({ ignoreNotFound: true }); } catch {} }

    if (m?.thumbUrl) {
      try {
        const url = new URL(String(m.thumbUrl));
        const pathEnc = url.searchParams.get('o');
        if (pathEnc) await bucket.file(decodeURIComponent(pathEnc)).delete({ ignoreNotFound: true });
      } catch {}
    }

    // Update counters on event
    const eventId = String(m?.groupId || '');
    if (eventId) {
      const eventRef = adminDb.collection('cms').doc('root').collection('events').doc(eventId);
      const eDoc = await eventRef.get();
      const isVideo = m?.type === 'video';

      await eventRef.set({
        mediaCount: admin.firestore.FieldValue.increment(-1),
        imageCount: admin.firestore.FieldValue.increment(isVideo ? 0 : -1),
        videoCount: admin.firestore.FieldValue.increment(isVideo ? -1 : 0),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      const e = eDoc.data() as unknown;
      if (e?.primaryMediaId === String(id)) {
        // Pick latest as new primary (no orderBy; sort in memory)
        const qs = await adminDb.collection('cms').doc('root').collection('media')
          .where('groupId', '==', eventId)
          .get();

        const items = qs.docs.map((d) => {
          const x: unknown = d.data() || {};
          return { id: d.id, url: x.url, type: x.type, thumbUrl: x.thumbUrl, createdAtMillis: x.createdAt?.toDate?.() ? x.createdAt.toDate().getTime() : 0 };
        }).sort((a, b) => (b.createdAtMillis || 0) - (a.createdAtMillis || 0));

        if (items.length) {
          const top = items[0];
          await eventRef.set({
            primaryMediaId: top.id,
            primaryMediaUrl: top.url ?? '',
            primaryMediaType: top.type === 'video' ? 'video' : 'image',
            primaryMediaThumbUrl: top.thumbUrl ?? null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });
        } else {
          await eventRef.set({
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
    console.error('POST /api/admin/events/delete-media:', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Server error' });
  }
}
