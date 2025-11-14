// pages/api/gallery/upload-media.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebaseAdmin';

const CMS = ['cms', 'root'] as const;
const GALLERIES = 'galleries';
const MEDIA = 'media';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ ok: false, error: 'method_not_allowed' });
    }

    const {
      albumId,
      url,               // downloadURL من Firebase Storage
      type = 'image',    // 'image' | 'video'
      thumbUrl = null,   // للفيديو (اختياري)
      caption = '',
      approved = true,
      setAsPrimary = false
    } = req.body || {};

    if (!albumId || !url) {
      return res.status(400).json({ ok: false, error: 'missing_albumId_or_url' });
    }

    const albumRef = adminDb.collection(CMS[0]).doc(CMS[1]).collection(GALLERIES).doc(albumId);
    const albumDoc = await albumRef.get();
    if (!albumDoc.exists) return res.status(404).json({ ok: false, error: 'album_not_found' });

    // أنشئ الميديا
    const mediaRef = adminDb.collection(MEDIA).doc();
    await mediaRef.set({
      groupId: albumId,
      url,
      type,
      thumbUrl,
      caption,
      approved: !!approved,
      createdAt: FieldValue.serverTimestamp()
    });

    // حدّث العداد
    const updates: Record<string, unknown> = {
      mediaCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp()
    };

    // اجعل الملف كوفر إن لم يكن هناك كوفر أو طُلب صراحة
    const a: unknown = albumDoc.data() || {};
    if (setAsPrimary || !a.primaryMediaUrl) {
      updates.primaryMediaUrl = url;
      updates.primaryMediaType = type === 'video' ? 'video' : 'image';
      updates.primaryMediaThumbUrl = thumbUrl ?? null;
    }

    await albumRef.update(updates);

    return res.status(200).json({ ok: true, id: mediaRef.id });
  } catch (err: unknown) {
    return res.status(500).json({ ok: false, error: 'internal', message: String(err?.message || '') });
  }
}
