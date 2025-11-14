// pages/api/admin/news/update-media.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { adminDb } from '@/lib/firebaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session || (session.user as unknown)?.role !== 'admin') {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ ok: false, error: 'method_not_allowed' });
    }

    const { mediaId, title } = req.body || {};
    if (!mediaId) return res.status(400).json({ ok: false, error: 'missing_mediaId' });

    await adminDb.collection('cms').doc('root').collection('media')
      .doc(String(mediaId))
      .set({ title: String(title || '') }, { merge: true });

    return res.status(200).json({ ok: true });
  } catch (err: unknown) {
    console.error('POST /api/admin/news/update-media:', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Server error' });
  }
}
