// pages/api/gallery/list.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { adminDb } from '@/lib/firebaseAdmin';

const CMS = ['cms', 'root'] as const;

type AlbumItem = {
  id: string;
  title: string;
  slug: string;
  description: string;
  createdAtMillis: number | null;
  primaryMediaUrl: string | null;
  primaryMediaType: 'image' | 'video' | null;
  primaryMediaThumbUrl: string | null;
  mediaCount: number;
  imageCount: number;
  videoCount: number;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ ok: false, error: 'method_not_allowed' });
    }

    const rawLimit = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
    const limit = Math.max(1, Math.min(200, Number(rawLimit ?? 50) || 50));

    const afterParam = Array.isArray(req.query.after) ? req.query.after[0] : req.query.after;
    const afterMillis = afterParam ? Number(afterParam) : null;

    // No orderBy here -> avoids composite index requirement
    const snap = await adminDb
      .collection(CMS[0]).doc(CMS[1]).collection('galleries')
      .where('published', '==', true)
      .get();

    const all: AlbumItem[] = snap.docs.map((d) => {
      const x: unknown = d.data() || {};
      const created: Date | null = x.createdAt?.toDate?.() ? x.createdAt.toDate() : null;
      const createdAtMillis = created && !isNaN(created.getTime()) ? created.getTime() : 0;
      return {
        id: d.id,
        title: x.title ?? '',
        slug: x.slug ?? '',
        description: x.description ?? '',
        createdAtMillis,
        primaryMediaUrl: x.primaryMediaUrl ?? null,
        primaryMediaType: x.primaryMediaType ?? null,
        primaryMediaThumbUrl: x.primaryMediaThumbUrl ?? null,
        mediaCount: typeof x.mediaCount === 'number' ? x.mediaCount : 0,
        imageCount: typeof x.imageCount === 'number' ? x.imageCount : 0,
        videoCount: typeof x.videoCount === 'number' ? x.videoCount : 0,
      };
    });

    // Sort newest -> oldest in memory
    all.sort((a, b) => (b.createdAtMillis || 0) - (a.createdAtMillis || 0));

    // Cursor-style paging in memory
    let filtered = all;
    if (Number.isFinite(afterMillis)) {
      filtered = filtered.filter(a => (a.createdAtMillis || 0) < (afterMillis as number));
    }

    const items = filtered.slice(0, limit);
    const nextAfter = items.length === limit ? (items[items.length - 1].createdAtMillis ?? null) : null;

    return res.status(200).json({ ok: true, items, nextAfter });
  } catch (err: unknown) {
    console.error('GET /api/gallery/list:', err);
    return res.status(500).json({ ok: false, error: 'internal', message: String(err?.message || '') });
  }
}
