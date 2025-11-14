import type { NextApiRequest, NextApiResponse } from 'next';
import { rateLimit } from '../_rateLimit';
import { adminDb, admin } from '@/lib/firebaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  const rl = rateLimit(req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'anon', 40, 60_000);
  if (!rl.ok) return res.status(429).json({ ok: false, error: 'Too many requests' });

  const { mediaId } = req.body || {};
  if (!mediaId) return res.status(400).json({ ok: false, error: 'Missing mediaId' });

  await adminDb.collection('cms').doc('root').collection('media').doc(String(mediaId))
    .update({ likesCount: admin.firestore.FieldValue.increment(1) }).catch(() => {});

  return res.status(200).json({ ok: true });
}
