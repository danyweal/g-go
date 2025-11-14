import type { NextApiRequest, NextApiResponse } from 'next';
import { adminDb } from '@/lib/firebaseAdmin';
import admin from 'firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  // ADDED: videoUrl فقط
  const { title, dateISO, location = '', imageUrl = '', videoUrl = '', description = '', published = true } = req.body || {};
  if (!title || !dateISO) return res.status(400).json({ ok: false, error: 'title and dateISO are required' });

  const ref = adminDb.collection('cms').doc('root').collection('events').doc();
  await ref.set({
    title,
    dateISO,
    location,
    imageUrl,       
    videoUrl,       
    description,
    published: !!published,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return res.status(200).json({ ok: true, id: ref.id });
}
