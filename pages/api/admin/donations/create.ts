import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { adminDb } from '@/lib/firebaseAdmin';

function ensureAdmin(session: unknown) {
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role !== 'admin') throw Object.assign(new Error('Unauthorized'), { code: 401 });
}
const now = () => Date.now();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  try {
    ensureAdmin(session);
    if (req.method !== 'POST') { res.setHeader('Allow', ['POST']); return res.status(405).json({ ok: false, error: 'Method Not Allowed' }); }
    const body = req.body || {};
    const id = String(body.slug || body.id || '').trim() || String(Math.random()).slice(2);
    const payload = {
      ...body,
      id, slug: body.slug || id,
      totalDonated: 0, donorsCount: 0, lastDonors: [],
      createdAt: now(), updatedAt: now(), startAt: body.startAt || now(),
    };
    await adminDb.collection('campaigns').doc(id).set(payload, { merge: true });
    return res.status(200).json({ ok: true, id });
  } catch (e: unknown) {
    return res.status(e?.code === 401 ? 401 : 500).json({ ok: false, error: e?.message || 'Server error' });
  }
}
