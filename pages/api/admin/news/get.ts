import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { adminDb } from '@/lib/firebaseAdmin';
import crypto from 'crypto';

function toMillis(v: unknown): number | null {
  try {
    if (!v) return null;
    if (typeof v?.toMillis === 'function') return v.toMillis();
    if (typeof v?.toDate === 'function') return v.toDate().getTime?.() ?? null;
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

function choosePrimaryUrlFromArray(media: unknown[]): string {
  if (!Array.isArray(media) || media.length === 0) return '';
  const flagged = media.find((m) => m?.isPrimary || m?.featured);
  if (flagged?.url) return String(flagged.url);
  const firstVideo = media.find((m) => String(m?.type).toLowerCase() === 'video');
  if (firstVideo?.url) return String(firstVideo.url);
  const firstImage = media.find((m) => String(m?.type).toLowerCase() === 'image');
  if (firstImage?.url) return String(firstImage.url);
  const firstAny = media.find((m) => m?.url);
  return firstAny?.url ? String(firstAny.url) : '';
}

function countsFromArray(media: unknown[]) {
  const arr = Array.isArray(media) ? media : [];
  let imageCount = 0;
  let videoCount = 0;
  for (const m of arr) {
    const t = String(m?.type || '').toLowerCase();
    if (t === 'image') imageCount++;
    else if (t === 'video') videoCount++;
  }
  return { mediaCount: arr.length, imageCount, videoCount };
}

export default async function getHandler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session || (session.user as unknown)?.role !== 'admin') {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    const { id } = req.query as { id?: string };
    if (!id) return res.status(400).json({ ok: false, error: 'Missing id' });

    const ref = adminDb.collection('cms').doc('root').collection('news').doc(String(id));
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: 'Not found' });

    const x = (snap.data() || {}) as unknown;
    const legacyMedia: unknown[] = Array.isArray(x.media) ? x.media : [];
    const computed = countsFromArray(legacyMedia);

    const primaryMediaUrl: string =
      (typeof x.primaryMediaUrl === 'string' && x.primaryMediaUrl) ||
      (typeof x.coverUrl === 'string' && x.coverUrl) ||
      choosePrimaryUrlFromArray(legacyMedia) ||
      '';

    const primaryMediaId: string | null =
      typeof x.primaryMediaId === 'string' && x.primaryMediaId
        ? x.primaryMediaId
        : primaryMediaUrl
        ? crypto.createHash('md5').update(String(primaryMediaUrl)).digest('hex')
        : null;

    const createdAtMillis =
      typeof x.createdAtMillis === 'number'
        ? x.createdAtMillis
        : toMillis(x.createdAt);

    const item = {
      id: snap.id,
      title: x.title || '',
      slug: x.slug || snap.id,
      excerpt: x.excerpt || '',
      content: x.content || x.body || '',
      published: !!x.published,
      primaryMediaId,
      primaryMediaUrl: primaryMediaUrl || null,
      createdAtMillis: createdAtMillis,
      mediaCount: typeof x.mediaCount === 'number' ? x.mediaCount : computed.mediaCount,
      imageCount: typeof x.imageCount === 'number' ? x.imageCount : computed.imageCount,
      videoCount: typeof x.videoCount === 'number' ? x.videoCount : computed.videoCount,
      tags: Array.isArray(x.tags) ? x.tags : [],
    };

    return res.status(200).json({ ok: true, item, news: item });
  } catch (e: unknown) {
    return res.status(500).json({ ok: false, error: e?.message || 'Get failed' });
  }
}
