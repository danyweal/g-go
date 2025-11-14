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
    if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'method_not_allowed' });

    const groupId = String(req.query.groupId || '');
    if (!groupId) return res.status(400).json({ ok: false, error: 'missing_groupId' });
    const limit = Math.min(600, Math.max(1, Number(req.query.limit || 400)));

    // No orderBy -> avoid composite index; sort in memory
    const qs = await adminDb.collection('cms').doc('root').collection('media')
      .where('groupId', '==', groupId)
      .get();

    const items = qs.docs.map((d) => {
      const x: unknown = d.data() || {};
      const createdAtMillis = x.createdAt?.toDate?.() ? x.createdAt.toDate().getTime() : 0;
      return {
        id: d.id,
        url: String(x.url || ''),
        type: x.type === 'video' ? 'video' as const : 'image' as const,
        thumbUrl: x.thumbUrl || null,
        title: x.title || '',
        createdAtMillis,
      };
    }).sort((a, b) => (b.createdAtMillis || 0) - (a.createdAtMillis || 0)) // newest first
      .slice(0, limit);

    return res.status(200).json({ ok: true, items });
  } catch (err: unknown) {
    const msg = String(err?.message || '');
    const createLinkMatch = msg.match(/https?:\/\/[^\s'"]+/);
    if (msg.includes('requires an index')) {
      return res.status(400).json({
        ok: false,
        error: 'index_required',
        message: 'This query needs a composite index.',
        createIndexUrl: createLinkMatch ? createLinkMatch[0] : null,
      });
    }
    return res.status(500).json({ ok: false, error: 'internal', message: msg });
  }
}
