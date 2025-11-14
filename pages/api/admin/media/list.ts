import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { adminDb } from '@/lib/firebaseAdmin';

const GALLERIES = ['cms', 'root', 'galleries'] as const;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session || (session.user as unknown)?.role !== 'admin') {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

    const col = adminDb
      .collection(GALLERIES[0])
      .doc(GALLERIES[1])
      .collection(GALLERIES[2]);

    const snap = await col.orderBy('createdAt', 'desc').get();
    const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));

    return res.status(200).json({ ok: true, items });
  } catch (err: unknown) {
    console.error('GET /api/admin/gallery/list:', err);
    return res.status(500).json({ ok: false, error: 'Failed to list galleries' });
  }
}
