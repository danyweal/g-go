import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { adminDb } from '@/lib/firebaseAdmin';

/**
 * Recomputes totalDonated / donorsCount / lastDonors for all campaigns
 * from the canonical `donations` collection (status === 'confirmed').
 * Safe to run multiple times.
 */
function ensureAdmin(session: unknown) {
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role !== 'admin') throw Object.assign(new Error('Unauthorized'), { code: 401 });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  try {
    ensureAdmin(session);
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    }

    // Group confirmed donations by campaignId
    const snap = await adminDb.collection('donations').where('status', '==', 'confirmed').get();
    const groups: Record<string, Array<{ amount: number; donorName: string; createdAt: number }>> = {};
    for (const d of snap.docs) {
      const x = d.data() as any;
      const k = String(x.campaignId || '').trim();
      if (!k) continue;
      if (!groups[k]) groups[k] = [];
      groups[k].push({
        amount: Number(x.amount || 0),
        donorName: String(x.donorName || 'Anonymous'),
        createdAt: Number(x.createdAt || Date.now()),
      });
    }

    // Upsert aggregates per campaign
    const batch = adminDb.batch();
    const results: Record<string, { totalDonated: number; donorsCount: number }> = {};
    for (const [campaignId, arr] of Object.entries(groups)) {
      const total = arr.reduce((s, r) => s + (Number.isFinite(r.amount) ? r.amount : 0), 0);
      const donors = arr.length;
      const lastDonors = arr
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .slice(0, 10)
        .map((r) => ({ name: r.donorName || 'Anonymous', amount: r.amount, at: r.createdAt || Date.now() }));

      const ref = adminDb.collection('campaigns').doc(campaignId);
      batch.set(
        ref,
        { totalDonated: total, donorsCount: donors, lastDonors, updatedAt: Date.now() },
        { merge: true }
      );

      results[campaignId] = { totalDonated: total, donorsCount: donors };
    }

    await batch.commit();
    return res.status(200).json({ ok: true, results });
  } catch (e: any) {
    return res.status(e?.code === 401 ? 401 : 500).json({ ok: false, error: e?.message || 'Server error' });
  }
}
