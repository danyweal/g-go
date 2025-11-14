// pages/api/join/mark-paid.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import * as admin from 'firebase-admin';

if (!admin.apps.length) { try { admin.initializeApp(); } catch {} }
const db = admin.firestore();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  try {
    const { id, paid } = req.body || {};
    if (!id || typeof paid !== 'boolean') return res.status(400).json({ ok: false, error: 'id and paid are required' });
    await db.collection('joinApplications').doc(String(id)).update({ paid: !!paid });
    return res.json({ ok: true });
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ ok: false, error: e?.message || 'Server error' });
  }
}
