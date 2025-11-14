// pages/api/admin/join/list.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { db } from '@/lib/firebase';
import {
  collection, getDocs, orderBy, query, where, limit as qlimit, startAfter,
} from 'firebase/firestore';
import { authOptions } from '../auth/[...nextauth]'; // عدّل المسار لو مختلف

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Auth check
    const session = await getServerSession(req, res, authOptions as unknown);
    const role = (session?.user as unknown)?.role;
    if (!session || role !== 'admin') return res.status(401).json({ ok: false, error: 'Unauthorized' });

    const { status = 'all', q: qStr = '', limit = '200' } = req.query as unknown;
    const col = collection(db, 'joinApplications');

    // حاول فلترة على الخادم قدر الإمكان
    let baseQuery: unknown = query(col, orderBy('createdAt', 'desc'));
    if (status === 'free') baseQuery = query(col, where('fee', '==', 0), orderBy('createdAt', 'desc'));
    if (status === 'paid_pending') baseQuery = query(col, where('fee', '>', 0), where('paymentConfirmed', '==', false), orderBy('createdAt', 'desc'));
    if (status === 'paid_confirmed') baseQuery = query(col, where('fee', '>', 0), where('paymentConfirmed', '==', true), orderBy('createdAt', 'desc'));

    const snap = await getDocs(baseQuery);
    let items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as unknown) }));

    // بحث بسيط على الخادم (اسم/إيميل/أصل)
    const qLower = String(qStr || '').trim().toLowerCase();
    if (qLower) {
      items = items.filter((it) => {
        const s = `${it.firstName} ${it.lastName} ${it.email} ${it.cityOfOrigin} ${it.cityOfOriginEn} ${it.cityOfOriginAr} ${it.postcode}`.toLowerCase();
        return s.includes(qLower);
      });
    }

    res.status(200).json({ ok: true, items });
  } catch (e: unknown) {
    console.error('admin/join/list error', e);
    res.status(500).json({ ok: false, error: e?.message || 'Internal error' });
  }
}
