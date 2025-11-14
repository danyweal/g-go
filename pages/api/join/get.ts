// pages/api/admin/join/get.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { authOptions } from '../auth/[...nextauth]'; // عدّل المسار لو مختلف

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getServerSession(req, res, authOptions as unknown);
    const role = (session?.user as unknown)?.role;
    if (!session || role !== 'admin') return res.status(401).json({ ok: false, error: 'Unauthorized' });

    const { id } = req.query as unknown;
    if (!id) return res.status(400).json({ ok: false, error: 'Missing id' });

    const ref = doc(db, 'joinApplications', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return res.status(404).json({ ok: false, error: 'Not found' });

    res.status(200).json({ ok: true, item: { id: snap.id, ...(snap.data() as unknown) } });
  } catch (e: unknown) {
    console.error('admin/join/get error', e);
    res.status(500).json({ ok: false, error: e?.message || 'Internal error' });
  }
}
