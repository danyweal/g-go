// pages/api/admin/store/[slug].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { adminDb } from '@/lib/firebaseAdmin';

const GALLERIES = ['cms', 'root', 'stores'] as const;
const MEDIA = ['cms', 'root', 'media'] as const;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

    const slug = String(req.query.slug || '').trim().toLowerCase();
    if (!slug) return res.status(400).json({ ok: false, error: 'Missing slug' });

    const galleriesCol = adminDb.collection(GALLERIES[0]).doc(GALLERIES[1]).collection(GALLERIES[2]);
    const snap = await galleriesCol.where('slug', '==', slug).limit(1).get();
    if (snap.empty) return res.status(404).json({ ok: false, error: 'Not found' });

    const galleryDoc = snap.docs[0];
    const gallery = { id: galleryDoc.id, ...galleryDoc.data() };

    // If you want to hide unpublished albums publicly, uncomment this:
    // if (!gallery.published) return res.status(404).json({ ok: false, error: 'Not found' });

    // Get media in this album
    const mediaCol = adminDb.collection(MEDIA[0]).doc(MEDIA[1]).collection(MEDIA[2]);
    const mediaSnap = await mediaCol.where('groupId', '==', galleryDoc.id).orderBy('createdAt', 'asc').get();

    const items = mediaSnap.docs.map((d) => {
      const x = d.data();
      return {
        id: d.id,
        type: x.type as 'image' | 'video',
        downloadUrl: x.downloadUrl as string,
        title: (x.title as string) || '',
      };
    });

    return res.status(200).json({ ok: true, gallery, items });
  } catch (err: unknown) {
    console.error('GET /api/admin/store/[slug]:', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Server error' });
  }
}
