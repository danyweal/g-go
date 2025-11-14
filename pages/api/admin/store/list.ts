// pages/api/admin/store/list.ts
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
    if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

    const rawLimit = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
    const limit = Math.max(1, Math.min(60, Number(rawLimit ?? 24) || 24));
    const afterParam = Array.isArray(req.query.after) ? req.query.after[0] : req.query.after;
    const afterMillis = afterParam ? Number(afterParam) : null;

    let q = adminDb.collection(CMS[0]).doc(CMS[1]).collection('stores')
      .orderBy('createdAt', 'desc')
      .limit(limit);

    if (Number.isFinite(afterMillis)) q = q.startAfter(Timestamp.fromMillis(afterMillis as number));

    const snap = await q.get();
    const items = snap.docs.map((d) => {
      const x: unknown = d.data() || {};
      const createdAtMillis = x.createdAt?.toDate?.() ? x.createdAt.toDate().getTime() : null;
      return {
        id: d.id,
        title: x.title ?? '',
        slug: x.slug ?? '',
        description: x.description ?? '',
        published: !!x.published,
        primaryMediaId: x.primaryMediaId ?? null,
        primaryMediaUrl: x.primaryMediaUrl ?? '',
        createdAtMillis,
        mediaCount: x.mediaCount || 0,
        imageCount: x.imageCount || 0,
        videoCount: x.videoCount || 0,
      };
    });

    const nextAfter = items.length === limit && items[items.length - 1].createdAtMillis
      ? items[items.length - 1].createdAtMillis : null;

    return res.status(200).json({ ok: true, items, nextAfter });
  } catch (err: unknown) {
    console.error('GET /api/admin/store/list:', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Server error' });
  }
}
