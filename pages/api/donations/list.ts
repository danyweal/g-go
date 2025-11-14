import type { NextApiRequest, NextApiResponse } from 'next';
import { adminDb } from '@/lib/firebaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const snap = await adminDb.collection('campaigns').orderBy('startAt', 'desc').get();
    const items = snap.docs
      .map(d => ({ id: d.id, ...(d.data() as unknown) }))
      .filter((x: unknown) => ['active', 'paused'].includes(String(x.status || 'active')));
    return res.status(200).json({ ok: true, items });
  } catch (e: unknown) {
    return res.status(500).json({ ok: false, error: e?.message || 'Server error' });
  }
}
