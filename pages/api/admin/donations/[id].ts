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
    const { id } = req.query as { id: string };
    if (!id) return res.status(400).json({ ok: false, error: 'Missing id' });

    if (req.method === 'GET') {
      const doc = await adminDb.collection('campaigns').doc(id).get();
      if (!doc.exists) return res.status(404).json({ ok: false, error: 'Not found' });
      return res.status(200).json({ ok: true, item: { id: doc.id, ...(doc.data() as unknown) } });
    }

    if (req.method === 'DELETE') {
      await adminDb.collection('campaigns').doc(id).delete();
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', ['GET', 'DELETE']);
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  } catch (e: unknown) {
    return res.status(e?.code === 401 ? 401 : 500).json({ ok: false, error: e?.message || 'Server error' });
  }
}
