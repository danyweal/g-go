// pages/api/news/get.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { adminDb } from '@/lib/firebaseAdmin';

type Raw = Record<string, unknown>;

type MediaItem = {
  id: string;
  groupId: string | null;
  contentType: string | null;
  type: 'image' | 'video' | 'other';
  url: string | null;          // primary URL clients use
  downloadUrl: string | null;  // alias of url for compatibility
  thumbUrl: string | null;
  title: string;
  createdAtMillis: number | null;
};

function toMillis(v: unknown): number | null {
  try {
    if (!v) return null;
    if (typeof v.toMillis === 'function') return v.toMillis();
    if (v instanceof Date) return v.getTime();
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const t = Date.parse(v);
      return Number.isFinite(t) ? t : null;
    }
    return null;
  } catch {
    return null;
  }
}

function detectType(url?: string | null, declared?: string | null): 'image' | 'video' | 'other' {
  if (declared === 'image' || declared === 'video') return declared;
  if (!url) return 'other';
  const u = String(url);
  const isVid =
    /youtu\.be\/[A-Za-z0-9_-]{11}/.test(u) ||
    /youtube\.com\/.*[?&]v=[A-Za-z0-9_-]{11}/.test(u) ||
    /youtube\.com\/embed\/[A-Za-z0-9_-]{11}/.test(u) ||
    /\.(mp4|webm|ogg|ogv|m4v|mov)(\?|#|$)/i.test(u);
  return isVid ? 'video' : /\.(jpe?g|png|webp|gif|avif|svg)(\?|#|$)/i.test(u) ? 'image' : 'other';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ ok: false, error: 'method_not_allowed' });
    }

    const id = typeof req.query.id === 'string' ? req.query.id.trim() : '';
    if (!id) return res.status(400).json({ ok: false, error: 'missing_id' });

    const include = (typeof req.query.include === 'string' ? req.query.include : 'all') as
      | 'images'
      | 'all';
    const limRaw = typeof req.query.limit === 'string' ? req.query.limit : '400';
    const limit = Number(limRaw) > 0 ? Number(limRaw) : 400;

    // ── 1) Load the news article doc
    const newsDocRef = adminDb.collection('cms').doc('root').collection('news').doc(id);
    const newsSnap = await newsDocRef.get();
    if (!newsSnap.exists) {
      return res.status(404).json({ ok: false, error: 'not_found' });
    }
    const d = (newsSnap.data() || {}) as Raw;

    // Normalize article fields
    const createdAtMillis =
      toMillis(d.createdAt) ??
      toMillis(d.createdAtMillis) ??
      toMillis(d.date) ??
      null;

    const article = {
      id: newsSnap.id,
      title: String(d.title || 'Untitled'),
      slug: String(d.slug || newsSnap.id),
      excerpt: (d.excerpt as string) || null,
      content: (d.content as string) || (d.body as string) || null,
      html: (d.html as string) || (d.contentHtml as string) || null,
      createdAtMillis,
      primaryMediaUrl:
        (d.primaryMediaUrl as string) ||
        (d.coverUrl as string) ||
        (d.imageUrl as string) ||
        null,
      tags: Array.isArray(d.tags) ? d.tags : [],
      published: Boolean(d.published),
    };

    // ── 2) Load media from /news/{id}/media ; fallback to legacy /media?groupId=id
    let mediaSnap = await newsDocRef.collection('media').limit(limit).get();

    if (mediaSnap.empty) {
      const legacy = adminDb
        .collection('cms').doc('root')
        .collection('media')
        .where('groupId', '==', id)
        .limit(limit);
      mediaSnap = await legacy.get();
    }

    const dedup = new Map<string, MediaItem>();

    mediaSnap.forEach((doc) => {
      const m = (doc.data() || {}) as Raw;

      const url =
        (m.url as string) ||
        (m.downloadUrl as string) ||
        null;

      const it: MediaItem = {
        id: doc.id,
        groupId: (m.groupId as string) ?? id,
        contentType: (m.contentType as string) ?? null,
        type: detectType(url, m.type),
        url,
        downloadUrl: url,
        thumbUrl: (m.thumbUrl as string) ?? null,
        title: (m.title as string) ?? '',
        createdAtMillis:
          toMillis(m.createdAtMillis) ??
          toMillis(m.createdAt) ??
          null,
      };

      if (it.url) dedup.set(it.id, it);
    });

    let items = Array.from(dedup.values());
    items =
      include === 'images'
        ? items.filter((i) => i.type === 'image')
        : items.filter((i) => i.type === 'image' || i.type === 'video');

    // Oldest -> newest for stable gallery order
    items.sort((a, b) => (a.createdAtMillis ?? 0) - (b.createdAtMillis ?? 0));

    // ── 3) Cache headers
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    if (createdAtMillis) res.setHeader('Last-Modified', new Date(createdAtMillis).toUTCString());

    return res.status(200).json({
      ok: true,
      article: {
        ...article,
        media: items,
      },
    });
  } catch (err: unknown) {
    console.error('GET /api/news/get:', err);
    return res
      .status(500)
      .json({ ok: false, error: 'internal', message: String(err?.message || '') });
  }
}
a