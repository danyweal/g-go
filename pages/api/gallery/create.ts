// pages/api/gallery/create.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebaseAdmin';

const CMS = ['cms', 'root'] as const;
const GALLERIES = 'galleries';

function slugify(input: string) {
  return (input || '')
    .toString()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 80);
}

async function ensureUniqueSlug(baseSlug: string) {
  const ref = adminDb.collection(CMS[0]).doc(CMS[1]).collection(GALLERIES);
  let candidate = baseSlug || 'album';
  let i = 0;
  // جرّب حتى تجد سلاج غير مستخدم
  // (التحقق عبر query لأن المسار ليس على السلاج)
  // ملاحظة: يمكن تحسينه بكتابة doc(slug) كـ ID لكن هنا نحافظ على ID auto
  // ونخزن slug حقلًا.
  // لذلك نتأكد بعدم وجود وثيقة بنفس السلاج.
  while (true) {
    const snap = await ref.where('slug', '==', candidate).limit(1).get();
    if (snap.empty) return candidate;
    i += 1;
    candidate = `${baseSlug}-${i}`;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ ok: false, error: 'method_not_allowed' });
    }

    const { title, description = '', slug, published = false } = req.body || {};
    if (!title) return res.status(400).json({ ok: false, error: 'missing_title' });

    const baseSlug = slug ? slugify(slug) : slugify(title);
    const unique = await ensureUniqueSlug(baseSlug);

    const ref = adminDb.collection(CMS[0]).doc(CMS[1]).collection(GALLERIES).doc();
    await ref.set({
      title: title || '',
      description,
      slug: unique,
      published: !!published,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      mediaCount: 0,
      primaryMediaUrl: null,
      primaryMediaType: null,        // 'image' | 'video'
      primaryMediaThumbUrl: null
    });

    return res.status(200).json({ ok: true, id: ref.id, slug: unique });
  } catch (err: unknown) {
    return res.status(500).json({ ok: false, error: 'internal', message: String(err?.message || '') });
  }
}
