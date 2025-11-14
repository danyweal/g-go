import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { adminDb } from '@/lib/firebaseAdmin';
import admin from 'firebase-admin';

const CMS = ['cms', 'root'] as const;

function slugify(s: string) {
  return (s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

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

    const { title, slug, excerpt, content, published, tags } = req.body || {};
    if (!title || typeof title !== 'string') {
      return res.status(400).json({ ok: false, error: 'missing_title' });
    }

    const normSlug =
      typeof slug === 'string' && slug.trim() ? slugify(slug) : slugify(title);
    if (!normSlug) return res.status(400).json({ ok: false, error: 'invalid_slug' });

    const nowTS = admin.firestore.FieldValue.serverTimestamp();
    const nowMs = Date.now();

    const ref = await adminDb
      .collection(CMS[0]).doc(CMS[1])
      .collection('news')
      .add({
        title,
        slug: normSlug,
        excerpt: typeof excerpt === 'string' ? excerpt : null,
        content: typeof content === 'string' ? content : null,
        published: !!published,
        primaryMediaId: null,
        primaryMediaUrl: '',
        createdAt: nowTS,
        updatedAt: nowTS,
        createdAtMillis: nowMs,
        updatedAtMillis: nowMs,
        mediaCount: 0,
        imageCount: 0,
        videoCount: 0,
        tags: Array.isArray(tags)
          ? tags.map((t: unknown) => String(t)).filter(Boolean)
          : [],
      });

    return res.status(200).json({ ok: true, id: ref.id });
  } catch (err: unknown) {
    console.error('POST /api/admin/news/create:', err);
    return res.status(500).json({ ok: false, error: 'internal', message: String(err?.message || '') });
  }
}
