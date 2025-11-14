// pages/api/admin/news/delete.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { adminDb } from '@/lib/firebaseAdmin';
import admin from 'firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session || (session.user as unknown)?.role !== 'admin') {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ ok: false, error: 'method_not_allowed' });
    }
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ ok: false, error: 'missing_id' });

    // Delete global media docs + storage for this news item
    const mediaSnap = await adminDb.collection('cms').doc('root').collection('media')
      .where('groupId', '==', String(id))
      .where('contextType', '==', 'news')
      .get();

    const bucket = admin.storage().bucket();
    for (const d of mediaSnap.docs) {
      const x = d.data() as unknown;
      try {
        if (x?.url) {
          const url = new URL(String(x.url));
          const pathEnc = url.pathname.split('/o/')[1]?.split('?')[0];
          if (pathEnc) await bucket.file(decodeURIComponent(pathEnc)).delete({ ignoreNotFound: true });
        }
        if (x?.thumbUrl) {
          const url = new URL(String(x.thumbUrl));
          const pathEnc = url.pathname.split('/o/')[1]?.split('?')[0];
          if (pathEnc) await bucket.file(decodeURIComponent(pathEnc)).delete({ ignoreNotFound: true });
        }
      } catch {}
      await d.ref.delete();
    }

    await adminDb.collection('cms').doc('root').collection('news').doc(String(id)).delete();
    return res.status(200).json({ ok: true });
  } catch (err: unknown) {
    console.error('POST /api/admin/news/delete:', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Server error' });
  }
}
