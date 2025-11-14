// pages/api/media/comments/[mediaId]/[commentId]/replies.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { adminDb } from '@/lib/firebaseAdmin';
import admin from 'firebase-admin';

const sources = [
  () => adminDb.collection('cms').doc('root').collection('media'),
  () => adminDb.collection('cms').doc('root').collection('gallery'),
  () => adminDb.collection('media'),
  () => adminDb.collection('gallery'),
];

async function findCommentRefs(mediaId: string, commentId: string) {
  for (const getColl of sources) {
    const mediaRef = getColl().doc(mediaId);
    const mediaDoc = await mediaRef.get();
    if (mediaDoc.exists) {
      const commentRef = mediaRef.collection('comments').doc(commentId);
      const commentDoc = await commentRef.get();
      if (commentDoc.exists) return { mediaRef, commentRef };
    }
  }
  throw new Error('Comment not found');
}

function toMillis(v: unknown): number | null {
  try {
    if (!v) return null;
    if (typeof v?.toMillis === 'function') return v.toMillis();
    if (v instanceof Date) return v.getTime();
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const t = Date.parse(v);
      return isFinite(t) ? t : null;
    }
    return null;
  } catch { return null; }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { mediaId, commentId } = req.query as { mediaId: string; commentId: string };
  if (!mediaId || !commentId) return res.status(400).json({ ok: false, error: 'mediaId & commentId required' });

  try {
    const { commentRef } = await findCommentRefs(mediaId, commentId);
    const replies = commentRef.collection('replies');

    if (req.method === 'GET') {
      const snap = await replies.orderBy('createdAt', 'desc').limit(100).get();
      const items = snap.docs.map((d) => {
        const data = d.data() as unknown;
        return {
          id: d.id,
          text: String(data.text || ''),
          name: String(data.name || ''),
          createdAt: toMillis(data.createdAt),
        };
      });
      return res.status(200).json({ ok: true, items, count: snap.size });
    }

    if (req.method === 'POST') {
      const { text, name } = (req.body || {}) as { text?: string; name?: string };
      const clean = String(text || '').trim();
      if (!clean) return res.status(400).json({ ok: false, error: 'text required' });

      const ref = replies.doc();
      const payload = {
        text: clean.slice(0, 400),
        name: String(name || '').trim().slice(0, 60),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await adminDb.runTransaction(async (tx) => {
        tx.set(ref, payload);
        tx.set(commentRef, { repliesCount: admin.firestore.FieldValue.increment(1) }, { merge: true });
      });

      const saved = await ref.get();
      const data = saved.data() || {};
      return res.status(200).json({
        ok: true,
        item: {
          id: saved.id,
          text: data.text || clean,
          name: data.name || name || '',
          createdAt: Date.now(),
        },
      });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (e: unknown) {
    return res.status(500).json({ ok: false, error: e?.message || 'Server error' });
  }
}
