// pages/api/admin/store/create.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebaseAdmin';

const CMS = ['cms', 'root'] as const;

function slugify(input: string) {
  return (input || '')
    .toString()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
    const { name = '', title, address = '', description = '', published = false } = req.body || {};
    if (!title) return res.status(400).json({ ok: false, error: 'missing_title' });

    const coll = adminDb.collection(CMS[0]).doc(CMS[1]).collection('stores');

    // unique slug
    const base = slugify(title) || `album-${Date.now()}`;
    let slug = base, i = 1;
    while (!(await coll.where('slug', '==', slug).limit(1).get()).empty) slug = `${base}-${++i}`;

    const ref = await coll.add({
      title: String(title),
      description: String(description),
      slug,
      name: String(name || ''),
      address: String(address || ''),
      published: !!published,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      mediaCount: 0,
      imageCount: 0,
      videoCount: 0,
      primaryMediaId: null,
      primaryMediaUrl: null,
      primaryMediaType: null,
      primaryMediaThumbUrl: null,
    });

    return res.status(200).json({ ok: true, id: ref.id, slug });
  } catch (err: unknown) {
    return res.status(500).json({ ok: false, error: 'internal', message: String(err?.message || '') });
  }
}
