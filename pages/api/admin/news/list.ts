import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { adminDb } from '@/lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';

const CMS = ['cms', 'root'] as const;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session || (session.user as unknown)?.role !== 'admin') {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ ok: false, error: 'method_not_allowed' });
    }

    const limitRaw = typeof req.query.limit === 'string' ? req.query.limit : '50';
    const limit = Math.min(Math.max(Number(limitRaw) || 50, 1), 200);

    const afterRaw = typeof req.query.after === 'string' ? req.query.after : '';
    const after = afterRaw ? Number(afterRaw) : null;

    let q = adminDb
      .collection(CMS[0]).doc(CMS[1])
      .collection('news')
      .orderBy('createdAtMillis', 'desc')
      .limit(limit);

    if (after) {
      q = q.where('createdAtMillis', '<', after);
    }

    const snap = await q.get();
    const items = snap.docs.map(d => {
      const data = d.data() || {};
      const createdAtMillis =
        typeof data.createdAtMillis === 'number'
          ? data.createdAtMillis
          : data.createdAt?.toDate?.()
          ? data.createdAt.toDate().getTime()
          : null;

      return {
        id: d.id,
        title: data.title || '',
        slug: data.slug || null,
        excerpt: data.excerpt || null,
        content: data.content || null,
        published: !!data.published,
        primaryMediaId: data.primaryMediaId || null,
        primaryMediaUrl: data.primaryMediaUrl || '',
        createdAtMillis,
        mediaCount: data.mediaCount || 0,
        imageCount: data.imageCount || 0,
        videoCount: data.videoCount || 0,
        tags: Array.isArray(data.tags) ? data.tags : [],
      };
    });

    const nextAfter =
      items.length > 0 ? (items[items.length - 1].createdAtMillis || null) : null;

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');
    return res.status(200).json({ ok: true, items, nextAfter });
  } catch (err: unknown) {
    console.error('GET /api/admin/news/list:', err);
    return res.status(500).json({ ok: false, error: 'internal', message: String(err?.message || '') });
  }
}
