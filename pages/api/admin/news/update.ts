import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { adminDb } from '@/lib/firebaseAdmin';
import admin from 'firebase-admin';

const CMS = ['cms', 'root'] as const;

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

    const { id, title, slug, excerpt, content, published, primaryMediaId, primaryMediaUrl, tags } = req.body || {};
    if (!id || typeof id !== 'string') return res.status(400).json({ ok: false, error: 'missing_id' });

    const patch: unknown = {};
    if (typeof title === 'string') patch.title = title;
    if (typeof slug === 'string') patch.slug = slug || null;
    if (typeof excerpt === 'string') patch.excerpt = excerpt;
    if (typeof content === 'string') patch.content = content;
    if (typeof published === 'boolean') patch.published = published;
    if (typeof primaryMediaId === 'string') patch.primaryMediaId = primaryMediaId || null;
    if (typeof primaryMediaUrl === 'string') patch.primaryMediaUrl = primaryMediaUrl || '';
    if (Array.isArray(tags)) patch.tags = tags;

    patch.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    patch.updatedAtMillis = Date.now();

    await adminDb
      .collection(CMS[0]).doc(CMS[1])
      .collection('news').doc(id)
      .update(patch);

    return res.status(200).json({ ok: true });
  } catch (err: unknown) {
    console.error('POST /api/admin/news/update:', err);
    return res.status(500).json({ ok: false, error: 'internal', message: String(err?.message || '') });
  }
}
