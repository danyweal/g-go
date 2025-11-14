// pages/api/news/media-list.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { adminDb } from '@/lib/firebaseAdmin';

type RawMedia = Record<string, unknown>;

type MediaItem = {
  id: string;
  groupId: string | null;
  contentType: string | null;
  type: 'image' | 'video' | 'other';
  downloadUrl: string | null;
  url?: string | null; // alias for clients expecting "url"
  thumbUrl: string | null;
  title: string;
  createdAtMillis: number | null;
};

const CMS = ['cms', 'root'] as const;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ ok: false, error: 'method_not_allowed' });
    }

    const groupId = typeof req.query.groupId === 'string' ? req.query.groupId : '';
    if (!groupId) return res.status(400).json({ ok: false, error: 'missing_groupId' });

    const include =
      (typeof req.query.include === 'string' ? req.query.include : 'images') as
        | 'images'
        | 'all';

    const limRaw = typeof req.query.limit === 'string' ? req.query.limit : '400';
    const lim = Number(limRaw) > 0 ? Number(limRaw) : 400;

    // 1) المصدر الأساسي: /cms/root/news/{groupId}/media
    const newsMediaCol = adminDb
      .collection(CMS[0]).doc(CMS[1])
      .collection('news').doc(groupId)
      .collection('media');

    let snap = await newsMediaCol.limit(lim).get();

    // 2) رجوع لنظام قديم (legacy) إن ما فيه نتائج:
    //    /cms/root/media where groupId == {groupId}
    if (snap.empty) {
      const legacy = adminDb
        .collection(CMS[0]).doc(CMS[1])
        .collection('media')
        .where('groupId', '==', groupId)
        .limit(lim);
      snap = await legacy.get();
    }

    const dedup = new Map<string, MediaItem>();

    snap.forEach((doc) => {
      const d = (doc.data() || {}) as RawMedia;

      const createdAtMillis =
        typeof d.createdAtMillis === 'number'
          ? d.createdAtMillis
          : d.createdAt?.toDate?.()
          ? d.createdAt.toDate().getTime()
          : 0;

      const rawType = String(d.type || '');
      const type: MediaItem['type'] =
        rawType === 'video' ? 'video' : rawType === 'image' ? 'image' : 'other';

      const dl =
        (d.url as string) ??
        (d.downloadUrl as string) ??
        null;

      const item: MediaItem = {
        id: doc.id,
        groupId,
        contentType: (d.contentType as string) ?? null,
        type,
        downloadUrl: dl,
        url: dl, // alias للانسجام مع الواجهة
        thumbUrl: (d.thumbUrl as string) ?? null,
        title: (d.title as string) ?? '',
        createdAtMillis,
      };

      // احتفظ فقط بما له رابط تنزيل
      if (item.downloadUrl) dedup.set(item.id, item);
    });

    let items = Array.from(dedup.values());
    items =
      include === 'all'
        ? items.filter((i) => i.type === 'image' || i.type === 'video')
        : items.filter((i) => i.type === 'image');

    // من الأقدم للأحدث (مطابقة لسلوك المعرض)
    items.sort((a, b) => (a.createdAtMillis ?? 0) - (b.createdAtMillis ?? 0));

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json({ ok: true, items });
  } catch (err: unknown) {
    console.error('GET /api/news/media-list:', err);
    return res
      .status(500)
      .json({ ok: false, error: 'internal', message: String(err?.message || '') });
  }
}
