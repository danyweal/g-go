// pages/api/gallery/[slug].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { adminDb } from '@/lib/firebaseAdmin';

const CMS = ['cms', 'root'] as const;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ ok: false, error: 'method_not_allowed' });
    }

    const slug = Array.isArray(req.query.slug) ? req.query.slug[0] : req.query.slug;
    if (!slug) return res.status(400).json({ ok: false, error: 'missing_slug' });

    const albumsRef = adminDb.collection(CMS[0]).doc(CMS[1]).collection('galleries');

    // Only filter by slug (no composite index). We'll check published afterwards.
    const albumSnap = await albumsRef.where('slug', '==', slug).limit(1).get();
    if (albumSnap.empty) return res.status(404).json({ ok: false, error: 'not_found' });

    const d = albumSnap.docs[0];
    const a: unknown = d.data() || {};

    // Hide unpublished albums publicly
    if (!a?.published) return res.status(404).json({ ok: false, error: 'not_found' });

    // Fetch media without orderBy to avoid composite index
    const mediaSnap = await adminDb
      .collection(CMS[0]).doc(CMS[1]).collection('media')
      .where('groupId', '==', d.id)
      .get();

    const media = mediaSnap.docs.map((m) => {
      const x: unknown = m.data() || {};
      const createdAtMillis = x.createdAt?.toDate?.() ? x.createdAt.toDate().getTime() : 0;
      return {
        id: m.id,
        type: x.type === 'video' ? 'video' : 'image',
        downloadUrl: x.url as string,
        thumbUrl: (x.thumbUrl as string) || null,
        title: (x.title as string) || '',
        createdAtMillis,
      };
    }).sort((m1, m2) => (m1.createdAtMillis || 0) - (m2.createdAtMillis || 0)) // oldest -> newest
      .map(({ createdAtMillis, ...rest }) => rest);

    return res.status(200).json({
      ok: true,
      album: {
        id: d.id,
        title: a.title ?? '',
        slug: a.slug ?? '',
        description: a.description ?? '',
        createdAtMillis: a.createdAt?.toDate?.() ? a.createdAt.toDate().getTime() : null,
        primaryMediaUrl: a.primaryMediaUrl ?? null,
        primaryMediaType: a.primaryMediaType ?? null,
        primaryMediaThumbUrl: a.primaryMediaThumbUrl ?? null,
        mediaCount: typeof a.mediaCount === 'number' ? a.mediaCount : media.length,
        imageCount: typeof a.imageCount === 'number' ? a.imageCount : media.filter((x) => x.type === 'image').length,
        videoCount: typeof a.videoCount === 'number' ? a.videoCount : media.filter((x) => x.type === 'video').length,
      },
      media,
    });
  } catch (err: unknown) {
    console.error('GET /api/gallery/[slug]:', err);
    return res.status(500).json({ ok: false, error: 'internal', message: String(err?.message || '') });
  }
}
