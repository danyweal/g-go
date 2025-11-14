// pages/api/gallery/update.ts
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

    const { id, title, description, slug, published, primaryMediaId } = req.body || {};
    if (!id) return res.status(400).json({ ok: false, error: 'missing_id' });

    const ref = adminDb.collection(CMS[0]).doc(CMS[1]).collection(GALLERIES).doc(id);
    const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };

    if (title !== undefined) updates.title = title ?? '';
    if (description !== undefined) updates.description = description ?? '';
    if (slug !== undefined) updates.slug = slug ?? '';
    if (published !== undefined) updates.published = !!published;

    // تعيين الوسيط الأساسي مثل نيوز
    if (primaryMediaId) {
      const mDoc = await adminDb.collection(MEDIA).doc(primaryMediaId).get();
      if (!mDoc.exists) return res.status(404).json({ ok: false, error: 'primary_media_not_found' });
      const m: unknown = mDoc.data() || {};
      updates.primaryMediaUrl = m.url ?? null;
      updates.primaryMediaType = (m.type === 'video' ? 'video' : 'image') as 'image' | 'video' | null;
      updates.primaryMediaThumbUrl = m.thumbUrl ?? null;
    }

    await ref.update(updates);
    return res.status(200).json({ ok: true });
  } catch (err: unknown) {
    return res.status(500).json({ ok: false, error: 'internal', message: String(err?.message || '') });
  }
}
