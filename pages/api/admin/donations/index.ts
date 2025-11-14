import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { adminDb } from '@/lib/firebaseAdmin';

function ensureAdmin(session: unknown) {
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role !== 'admin') throw Object.assign(new Error('Unauthorized'), { code: 401 });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  try {
    ensureAdmin(session);
    if (req.method === 'GET') {
      const qs = await adminDb.collection('campaigns').orderBy('startAt', 'desc').get();
      return res.status(200).json({ ok: true, items: qs.docs.map((d) => ({ id: d.id, ...(d.data() as unknown) })) });
    }
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  } catch (e: unknown) {
    return res.status(e?.code === 401 ? 401 : 500).json({ ok: false, error: e?.message || 'Server error' });
  }
}
