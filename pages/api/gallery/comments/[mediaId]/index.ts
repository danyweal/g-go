// pages/api/media/comments/[mediaId]/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { adminDb } from '@/lib/firebaseAdmin';
import admin from 'firebase-admin';

const sources = [
  () => adminDb.collection('cms').doc('root').collection('media'),
  () => adminDb.collection('cms').doc('root').collection('gallery'),
  () => adminDb.collection('media'),
  () => adminDb.collection('gallery'),
];

async function findMediaDocById(id: string) {
  for (const getColl of sources) {
    const ref = getColl().doc(id);
    const doc = await ref.get();
    if (doc.exists) return ref;
  }
  throw new Error('Media not found');
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
  const { mediaId } = req.query as { mediaId: string };
  if (!mediaId) return res.status(400).json({ ok: false, error: 'mediaId required' });

  try {
    const mediaRef = await findMediaDocById(mediaId);
    const comments = mediaRef.collection('comments');

    if (req.method === 'GET') {
      const snap = await comments.orderBy('createdAt', 'desc').limit(100).get();
      const items = snap.docs.map((d) => {
        const data = d.data() as unknown;
        return {
          id: d.id,
          text: String(data.text || ''),
          name: String(data.name || ''),
          createdAt: toMillis(data.createdAt),
          repliesCount: typeof data?.repliesCount === 'number' ? data.repliesCount : 0,
        };
      });
      const mediaSnap = await mediaRef.get();
      const m = mediaSnap.data() || {};
      const count = typeof m.commentsCount === 'number' ? m.commentsCount : snap.size;
      return res.status(200).json({ ok: true, items, count });
    }

    if (req.method === 'POST') {
      const { text, name } = (req.body || {}) as { text?: string; name?: string };
      const clean = String(text || '').trim();
      if (!clean) return res.status(400).json({ ok: false, error: 'text required' });

      const itemRef = comments.doc();
      const payload = {
        text: clean.slice(0, 500),
        name: String(name || '').trim().slice(0, 60),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        repliesCount: 0,
      };

      let newCount = 0;
      await adminDb.runTransaction(async (tx) => {
        tx.set(itemRef, payload);
        tx.set(mediaRef, { commentsCount: admin.firestore.FieldValue.increment(1), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        const after = await tx.get(mediaRef);
        const d = after.data() || {};
        newCount = typeof d.commentsCount === 'number' ? d.commentsCount : 0;
      });

      const saved = await itemRef.get();
      const data = saved.data() || {};
      return res.status(200).json({
        ok: true,
        item: {
          id: saved.id,
          text: data.text || clean,
          name: data.name || name || '',
          createdAt: Date.now(),
          repliesCount: 0,
        },
        count: newCount,
      });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (e: unknown) {
    return res.status(500).json({ ok: false, error: e?.message || 'Server error' });
  }
}
