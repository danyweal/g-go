// pages/api/store/[slug].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { adminDb } from '@/lib/firebaseAdmin';
import type { Timestamp } from 'firebase-admin/firestore';

function toMillis(t?: Timestamp | null): number | null {
  try { return t ? (t as unknown).toMillis?.() ?? null : null; } catch { return null; }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ ok: false, error: 'method_not_allowed' });
    }

    // Dynamic route param for slug, and optional query param for id
    const slugParam = String(req.query.slug ?? '').trim().toLowerCase();
    const idParam = typeof req.query.id === 'string' ? req.query.id.trim() : undefined;

    if (!slugParam && !idParam) {
      return res.status(400).json({ ok: false, error: 'missing_slug_or_id' });
    }

    const col = adminDb.collection('cms').doc('root').collection('stores');

    // Prefer explicit id lookups if provided
    if (idParam) {
      const doc = await col.doc(idParam).get();
      if (!doc.exists) return res.status(404).json({ ok: false, error: 'not_found' });

      const x = doc.data() as unknown;
      if (!x?.published) return res.status(404).json({ ok: false, error: 'not_found' });

      const item = {
        id: doc.id,
        slug: String(x.slug || ''),
        title: String(x.title || ''),
        name: x.name ? String(x.name) : undefined,
        address: x.address ? String(x.address) : undefined,
        description: String(x.description || ''),
        createdAtMillis:
          typeof x.createdAtMillis === 'number'
            ? x.createdAtMillis
            : toMillis(x.createdAt) || null,
        primaryMediaUrl: x.primaryMediaUrl ?? null,
        primaryMediaType: x.primaryMediaType ?? null,
        primaryMediaThumbUrl: x.primaryMediaThumbUrl ?? null,
        mediaCount: Number(x.mediaCount || 0),
        imageCount: Number(x.imageCount || 0),
        videoCount: Number(x.videoCount || 0),
      };

      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
      return res.status(200).json({ ok: true, item });
    }

    // Otherwise, lookup by slug (from the route)
    if (!slugParam) {
      return res.status(400).json({ ok: false, error: 'missing_slug' });
    }

    const snap = await col.where('slug', '==', slugParam).limit(1).get();
    if (snap.empty) return res.status(404).json({ ok: false, error: 'not_found' });

    const doc = snap.docs[0];
    const x = doc.data() as unknown;
    if (!x?.published) return res.status(404).json({ ok: false, error: 'not_found' });

    const item = {
      id: doc.id,
      slug: String(x.slug || ''),
      title: String(x.title || ''),
      name: x.name ? String(x.name) : undefined,
      address: x.address ? String(x.address) : undefined,
      description: String(x.description || ''),
      createdAtMillis:
        typeof x.createdAtMillis === 'number'
          ? x.createdAtMillis
          : toMillis(x.createdAt) || null,
      primaryMediaUrl: x.primaryMediaUrl ?? null,
      primaryMediaType: x.primaryMediaType ?? null,
      primaryMediaThumbUrl: x.primaryMediaThumbUrl ?? null,
      mediaCount: Number(x.mediaCount || 0),
      imageCount: Number(x.imageCount || 0),
      videoCount: Number(x.videoCount || 0),
    };

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json({ ok: true, item });
  } catch (err: unknown) {
    console.error('GET /api/store/[slug]:', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Server error' });
  }
}
