// pages/api/admin/store/delete.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { adminDb } from '@/lib/firebaseAdmin';
import admin from 'firebase-admin';

async function deleteInBatches(docs: FirebaseFirestore.QueryDocumentSnapshot[]) {
  const batch = adminDb.batch();
  for (const d of docs) batch.delete(d.ref);
  await batch.commit();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session || (session.user as unknown)?.role !== 'admin') {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'method_not_allowed' }); }

    const { id } = req.body || {};
    if (!id) return res.status(400).json({ ok: false, error: 'missing_id' });

    const albumRef = adminDb.collection('cms').doc('root').collection('stores').doc(String(id));
    const albumDoc = await albumRef.get();
    if (!albumDoc.exists) return res.status(404).json({ ok: false, error: 'not_found' });

    // 1) Delete all storage files under the album prefix
    const bucket = admin.storage().bucket();
    const prefix = `cms/root/store/${id}/`;
    try { await bucket.deleteFiles({ prefix }); } catch {}

    // 2) Delete all media docs linked to this album
    let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    while (true) {
      let q = adminDb.collection('cms').doc('root').collection('media')
        .where('groupId', '==', String(id))
        .orderBy('createdAt', 'desc')
        .limit(400);
      if (cursor) q = q.startAfter(cursor);
      const snap = await q.get();
      if (snap.empty) break;
      const docs = snap.docs;
      await deleteInBatches(docs);
      cursor = docs[docs.length - 1];
      if (docs.length < 400) break;
    }

    // 3) Delete the album itself
    await albumRef.delete();

    return res.status(200).json({ ok: true });
  } catch (err: unknown) {
    console.error('POST /api/admin/store/delete:', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Server error' });
  }
}
