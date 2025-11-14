import type { NextApiRequest, NextApiResponse } from 'next';
import { adminDb } from '@/lib/firebaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Preserve your original contract: read from req.query.slug
    const raw = Array.isArray(req.query.slug) ? req.query.slug[0] : req.query.slug;
    const slug = String(raw || '').trim();
    if (!slug) return res.status(400).json({ ok: false, error: 'Missing slug' });

    // 1) Try exact match on 'slug' (your original behavior)
    let qs = await adminDb.collection('campaigns').where('slug', '==', slug).limit(1).get();
    let doc = qs.empty ? null : qs.docs[0];

    // 2) If not found, try a common variant: 'slugLower' against lowercased value
    if (!doc) {
      const lower = slug.toLowerCase();
      const qs2 = await adminDb.collection('campaigns').where('slugLower', '==', lower).limit(1).get();
      doc = qs2.empty ? null : qs2.docs[0];
    }

    // 3) Last resort: if the provided slug looks like a document id, try direct fetch
    if (!doc && /^[A-Za-z0-9_-]{18,}$/.test(slug)) {
      const snap = await adminDb.collection('campaigns').doc(slug).get();
      if (snap.exists) {
        // @ts-expect-error Firestore types differ for doc vs query doc; both have .id/.data()
        doc = snap;
      }
    }

    if (!doc) return res.status(404).json({ ok: false, error: 'Not found' });

    const data = (doc.data() as any) || {};
    // Normalize numeric fields so the UI doesn't break if they were missing
    const item = {
      id: doc.id,
      ...data,
      totalDonated: Number.isFinite(Number(data.totalDonated)) ? Number(data.totalDonated) : 0,
      donorsCount: Number.isFinite(Number(data.donorsCount)) ? Number(data.donorsCount) : 0,
    };

    return res.status(200).json({ ok: true, item });
  } catch (e: unknown) {
    const message = (e as any)?.message || 'Server error';
    return res.status(500).json({ ok: false, error: message });
  }
}
