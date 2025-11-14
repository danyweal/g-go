// pages/api/admin/events/set-primary.ts
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

    const { eventId, mediaId } = req.body || {};
    if (!eventId || !mediaId) return res.status(400).json({ ok: false, error: 'missing_params' });

    const mDoc = await adminDb.collection('cms').doc('root').collection('media').doc(String(mediaId)).get();
    if (!mDoc.exists) return res.status(404).json({ ok: false, error: 'media_not_found' });
    const m: unknown = mDoc.data() || {};

    const eventRef = adminDb.collection('cms').doc('root').collection('events').doc(String(eventId));
    await eventRef.set({
      primaryMediaId: String(mediaId),
      primaryMediaUrl: m.url ?? null,
      primaryMediaType: m.type === 'video' ? 'video' : 'image',
      primaryMediaThumbUrl: m.thumbUrl ?? null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    return res.status(200).json({ ok: true });
  } catch (err: unknown) {
    console.error('POST /api/admin/events/set-primary:', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Server error' });
  }
}
