// pages/api/store/media-list.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { adminDb } from '@/lib/firebaseAdmin';
import type { Timestamp } from 'firebase-admin/firestore';

function toMillis(t?: Timestamp | null): number | null {
  try { return t ? (t as unknown).toMillis?.() ?? null : null; } catch { return null; }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ ok: false, error: 'method_not_allowed' });
    }

    const slug = String(req.query.slug || '').trim().toLowerCase();
    const all = String(req.query.all || '0') === '1'
      || String(req.query.all || '').toLowerCase() === 'true';

    // Resolve groupId (store doc id) from slug unless provided
    let groupId = String(req.query.groupId || '');
    if (!groupId) {
      if (!slug) return res.status(400).json({ ok: false, error: 'missing_slug' });
      const stCol = adminDb.collection('cms').doc('root').collection('stores');
      const sSnap = await stCol.where('slug', '==', slug).limit(1).get();
      if (sSnap.empty) return res.status(404).json({ ok: false, error: 'store_not_found' });
      const store = sSnap.docs[0].data() as unknown;
      if (!store?.published) return res.status(404).json({ ok: false, error: 'store_not_found' });
      groupId = sSnap.docs[0].id;
    }

    // Pull media linked by groupId
    const mediaCol = adminDb.collection('cms').doc('root').collection('media');
    const mSnap = await mediaCol.where('groupId', '==', groupId).get();

    let items = mSnap.docs.map((d) => {
      const x = d.data() as unknown;
      const inferredType =
        x.type === 'video' ? 'video' :
        x.type === 'image' ? 'image' :
        (x.contentType || '').startsWith('video') ? 'video' :
        (x.contentType || '').startsWith('image') ? 'image' : 'other';

      const url = x.url ?? x.downloadUrl ?? null;
      const downloadUrl = x.downloadUrl ?? x.url ?? null;

      return {
        id: d.id,
        groupId: String(x.groupId || ''),
        contentType: x.contentType ?? null,
        type: inferredType as 'image' | 'video' | 'other',
        url,
        downloadUrl,
        thumbUrl: x.thumbUrl ?? null,
        title: String(x.title || ''),
        note: x.note ? String(x.note) : undefined,
        createdAtMillis:
          typeof x.createdAtMillis === 'number'
            ? x.createdAtMillis
            : toMillis(x.createdAt) || null,
      };
    });

    // Filter by requested visibility
    items = all
      ? items.filter((i) => i.type === 'image' || i.type === 'video')
      : items.filter((i) => i.type === 'image');

    // Oldest → newest (UI can re-sort)
    items.sort((a, b) => (a.createdAtMillis ?? 0) - (b.createdAtMillis ?? 0));

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json({ ok: true, items });
  } catch (err: unknown) {
    console.error('GET /api/store/media-list:', err);
    return res.status(500).json({ ok: false, error: 'internal', message: String(err?.message || '') });
  }
}
