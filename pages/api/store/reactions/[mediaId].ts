// pages/api/media/reactions/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { adminDb } from '@/lib/firebaseAdmin';
import admin from 'firebase-admin';

type Body =
  | { action: 'like' | 'dislike'; delta: 1 | -1; undoOpposite?: boolean }
  | { action: 'emoji'; emoji: string; delta: 1 | -1 };

const sources = [
  () => adminDb.collection('cms').doc('root').collection('media'),
  () => adminDb.collection('cms').doc('root').collection('gallery'),
  () => adminDb.collection('media'),
  () => adminDb.collection('gallery'),
];

async function findMediaDocById(id: string) {
  for (const getColl of sources) {
    const coll = getColl();
    const doc = await coll.doc(id).get();
    if (doc.exists) return coll.doc(id);
  }
  throw new Error('Media not found');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const { id } = req.query as { id: string };
    const body = req.body as Body;
    if (!id || !body || !('action' in body)) return res.status(400).json({ ok: false, error: 'Invalid payload' });

    const ref = await findMediaDocById(id);

    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error('Media not found');

      const inc = admin.firestore.FieldValue.increment((body as unknown).delta || 0);

      if (body.action === 'like') {
        tx.set(ref, { likes: inc }, { merge: true });
        if ((body as unknown).undoOpposite) tx.set(ref, { dislikes: admin.firestore.FieldValue.increment(-1) }, { merge: true });
      } else if (body.action === 'dislike') {
        tx.set(ref, { dislikes: inc }, { merge: true });
        if ((body as unknown).undoOpposite) tx.set(ref, { likes: admin.firestore.FieldValue.increment(-1) }, { merge: true });
      } else if (body.action === 'emoji') {
        const key = String((body as unknown).emoji || '');
        if (!key) throw new Error('emoji is required');
        tx.set(ref, { emojis: { [key]: inc } }, { merge: true });
      }
      tx.set(ref, { updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    });

    const fresh = await ref.get();
    const d = fresh.data() || {};
    return res.status(200).json({
      ok: true,
      likes: typeof d.likes === 'number' ? d.likes : 0,
      dislikes: typeof d.dislikes === 'number' ? d.dislikes : 0,
      emojis: d.emojis || {},
    });
  } catch (e: unknown) {
    return res.status(500).json({ ok: false, error: e?.message || 'Server error' });
  }
}
