// pages/api/news/by-slug/[slug].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { adminDb } from '@/lib/firebaseAdmin';

/* ───────────────── helpers ───────────────── */

function toMillis(v: unknown): number | null {
  try {
    if (!v) return null;
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const t = Date.parse(v);
      return Number.isFinite(t) ? t : null;
    }
    // Firestore Timestamp
    if (typeof v?.toMillis === 'function') return v.toMillis();
    if (typeof v?.toDate === 'function') return (v.toDate() as Date).getTime();
    return null;
  } catch {
    return null;
  }
}

function isVideoUrl(url?: string | null) {
  if (!url) return false;
  const u = url.toLowerCase();
  return (
    /\.(mp4|webm|mov|m4v|avi|mkv|ogg|ogv)(\?|#|$)/i.test(u) ||
    /youtube\.com|youtu\.be/.test(u)
  );
}

type NormMedia = {
  url: string;
  type: 'image' | 'video';
  thumbUrl?: string | null;
  title?: string | null;
  // you can add other fields if you store them later
};

function normalizeMedia(input: unknown): NormMedia[] {
  const src = Array.isArray(input) ? input : [];
  const out: NormMedia[] = [];
  const seen = new Set<string>();

  for (const raw of src) {
    if (!raw) continue;
    const url = String(raw.url ?? raw.downloadUrl ?? '');
    if (!url) continue;

    const type: 'image' | 'video' =
      (raw.type === 'video' || raw.type === 'image')
        ? raw.type
        : isVideoUrl(url) ? 'video' : 'image';

    const thumbUrl: string | null =
      typeof raw.thumbUrl === 'string'
        ? raw.thumbUrl
        : typeof raw.thumb === 'string'
        ? raw.thumb
        : null;

    const title: string | null =
      typeof raw.title === 'string' && raw.title ? raw.title : null;

    const key = `${type}:${url}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({ url, type, thumbUrl, title });
  }

  return out;
}

function choosePrimary(
  media: NormMedia[],
  primaryUrl?: string | null
): { url: string; type: 'image' | 'video'; thumbUrl?: string | null } | null {
  if (!media.length && !primaryUrl) return null;
  if (primaryUrl) {
    const byUrl = media.find((m) => m.url === primaryUrl);
    if (byUrl) return byUrl;
  }
  const firstVideo = media.find((m) => m.type === 'video');
  return firstVideo || media[0] || null;
}

/* ───────────────── handler ───────────────── */

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ ok: false, error: 'method_not_allowed' });
    }

    const slug = typeof req.query.slug === 'string' ? req.query.slug.trim() : '';
    if (!slug) return res.status(400).json({ ok: false, error: 'missing_slug' });

    // Admins may optionally include drafts with ?includeDraft=1
    const session = await getServerSession(req, res, authOptions);
    const isAdmin = (session?.user as unknown)?.role === 'admin';
    const includeDraft = isAdmin && String(req.query.includeDraft || '') === '1';

    // Query: cms/root/news where slug == slug AND published == true (unless admin override)
    let q = adminDb
      .collection('cms').doc('root')
      .collection('news')
      .where('slug', '==', slug);

    if (!includeDraft) {
      q = q.where('published', '==', true);
    }

    // Prefer the most recently updated doc if multiple match
    const snap = await q.limit(1).get();
    if (snap.empty) {
      // If not found and admin asked for drafts, we already included; else one more fallback for admins
      return res.status(404).json({ ok: false, error: 'not_found' });
    }

    const doc = snap.docs[0];
    const d = doc.data() || {};

    // Normalize fields
    const media = normalizeMedia(d.media);
    const createdAtMillis =
      toMillis(d.createdAtMillis) ?? toMillis(d.createdAt) ?? toMillis(d.date) ?? null;

    // Primary media selection
    const primary = choosePrimary(media, d.primaryMediaUrl || d.coverUrl || null);

    // Counts (compute if missing)
    let imageCount = Number(d.imageCount || 0);
    let videoCount = Number(d.videoCount || 0);
    let mediaCount = Number(d.mediaCount || 0);
    if (!imageCount && !videoCount && media.length) {
      imageCount = media.filter((m) => m.type === 'image').length;
      videoCount = media.filter((m) => m.type === 'video').length;
      mediaCount = imageCount + videoCount;
    }

    // Build response item
    const item = {
      id: doc.id,
      slug: String(d.slug || slug),
      title: String(d.title || 'Untitled'),
      excerpt: typeof d.excerpt === 'string' ? d.excerpt : (typeof d.summary === 'string' ? d.summary : ''),
      content: typeof d.content === 'string' ? d.content : (typeof d.body === 'string' ? d.body : ''),
      published: !!d.published,

      createdAtMillis,

      primaryMediaUrl: primary?.url || null,
      primaryMediaType: primary ? primary.type : null,
      primaryMediaThumbUrl: primary?.thumbUrl || null,

      imageCount,
      videoCount,
      mediaCount,

      // include normalized media array so the client can render a gallery
      media,
    };

    // Cache for public (and short for admin)
    res.setHeader('Cache-Control', includeDraft
      ? 'private, max-age=0, no-cache'
      : 's-maxage=60, stale-while-revalidate=300');

    return res.status(200).json({ ok: true, item });
  } catch (err: unknown) {
    console.error('GET /api/news/by-slug/[slug] error:', err);
    return res.status(500).json({ ok: false, error: err?.message || 'internal_error' });
  }
}
