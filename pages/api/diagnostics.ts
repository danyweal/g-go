// pages/api/diagnostics.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { adminDb } from '@/lib/firebaseAdmin'; // you already export adminDb

type Data = { ok: true; wrote: boolean } | { ok: false; error: string };

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  try {
    const ref = adminDb.collection('_diagnostics').doc('ping');
    await ref.set({ ts: Date.now() }, { merge: true });
    return res.status(200).json({ ok: true, wrote: true });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
