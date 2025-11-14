// pages/api/store/list.ts
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

    const limit = Math.max(1, Math.min(200, Number(req.query.limit || 50)));

    const col = adminDb.collection('cms').doc('root').collection('stores');
    const qSnap = await col.where('published', '==', true).get();

    const items = qSnap.docs.map((d) => {
      const x = d.data() as unknown;
      const createdAtMillis =
        typeof x.createdAtMillis === 'number'
          ? x.createdAtMillis
          : toMillis(x.createdAt) || null;

      return {
        id: d.id,
        slug: String(x.slug || ''),
        title: String(x.title || ''),
        name: x.name ? String(x.name) : undefined,
        address: x.address ? String(x.address) : undefined,
        description: String(x.description || ''),
        createdAtMillis,
        primaryMediaUrl: x.primaryMediaUrl ?? null,
        primaryMediaType: x.primaryMediaType ?? null,
        primaryMediaThumbUrl: x.primaryMediaThumbUrl ?? null,
        mediaCount: Number(x.mediaCount || 0),
        imageCount: Number(x.imageCount || 0),
        videoCount: Number(x.videoCount || 0),
      };
    });

    // Newest → oldest for UI default
    items.sort((a, b) => (b.createdAtMillis ?? 0) - (a.createdAtMillis ?? 0));

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json({ ok: true, items: items.slice(0, limit) });
  } catch (err: unknown) {
    console.error('GET /api/store/list:', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Server error' });
  }
}
