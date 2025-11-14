// pages/api/admin/gallery/update.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebaseAdmin';

const CMS = ['cms', 'root'] as const;

function slugify(input: string) {
  return (input || '').toString().normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

    const { id, title, description, published, primaryMediaId } = req.body || {};
    if (!id) return res.status(400).json({ ok: false, error: 'missing_id' });

    const ref = adminDb.collection(CMS[0]).doc(CMS[1]).collection('galleries').doc(String(id));
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: 'not_found' });

    const updates: unknown = { updatedAt: FieldValue.serverTimestamp() };
    if (typeof title === 'string' && title.trim()) { updates.title = title; updates.slug = slugify(title); }
    if (typeof description === 'string') updates.description = description;
    if (typeof published === 'boolean') updates.published = published;

    if (primaryMediaId) {
      const mDoc = await adminDb.collection(CMS[0]).doc(CMS[1]).collection('media').doc(String(primaryMediaId)).get();
      if (!mDoc.exists) return res.status(404).json({ ok: false, error: 'primary_media_not_found' });
      const m: unknown = mDoc.data() || {};
      updates.primaryMediaId = String(primaryMediaId);
      updates.primaryMediaUrl = m.url ?? null;
      updates.primaryMediaType = m.type === 'video' ? 'video' : 'image';
      updates.primaryMediaThumbUrl = m.thumbUrl ?? null;
    }

    await ref.set(updates, { merge: true });
    return res.status(200).json({ ok: true });
  } catch (err: unknown) {
    return res.status(500).json({ ok: false, error: 'internal', message: String(err?.message || '') });
  }
}
