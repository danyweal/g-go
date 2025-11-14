import type { NextApiRequest, NextApiResponse } from 'next';
import { adminDb } from '@/lib/firebaseAdmin';
import admin from 'firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const { id, ...body } = req.body || {};
  if (!id) return res.status(400).json({ ok: false, error: 'id is required' });

  // ADDED: 'videoUrl'
  const allowed = ['title','dateISO','location','imageUrl','videoUrl','description','published'];
  const patch: Record<string, unknown> = {};
  for (const k of allowed) if (k in body) patch[k] = body[k];
  patch.updatedAt = admin.firestore.FieldValue.serverTimestamp();

  await adminDb.collection('cms').doc('root').collection('events').doc(id).set(patch, { merge: true });
  return res.status(200).json({ ok: true });
}
