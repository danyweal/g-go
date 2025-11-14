import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { adminDb } from '@/lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';

function ensureAdmin(session: unknown) {
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role !== 'admin') throw Object.assign(new Error('Unauthorized'), { code: 401 });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  try {
    if (req.method === 'GET') {
      ensureAdmin(session);
      const snap = await adminDb
        .collection('events')
        .orderBy('createdAt', 'desc')
        .limit(200).get();
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      return res.status(200).json({ ok:true, items });
    }
    if (req.method === 'POST' || req.method === 'PATCH') {
      ensureAdmin(session);
      const { title, dateISO='', location='', startTime='', endTime='', imageUrl='', description='', published=false } = req.body as Record<string, unknown>;
      if (!title) return res.status(400).json({ ok:false, error:'Missing title' });
      const now = Timestamp.now();
      const payload:unknown = { title, dateISO, location, startTime, endTime, imageUrl, description, published, updatedAt: now };
      if (req.method === 'POST') {
        payload.createdAt = now;
        const ref = await adminDb.collection('events').add(payload);
        return res.status(200).json({ ok:true, id: ref.id });
      } else {
        // PATCH without id not allowed here
        return res.status(400).json({ ok:false, error:'Use PATCH /api/admin/events/{id}' });
      }
    }
    res.setHeader('Allow', ['GET','POST','PATCH']);
    return res.status(405).json({ ok:false, error: 'Method Not Allowed' });
  } catch (e:unknown) {
    const code = e?.code === 401 ? 401 : 500;
    return res.status(code).json({ ok:false, error: e?.message || 'Server error' });
  }
}
