// pages/api/admin/gallery/add-media.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebaseAdmin';

const CMS = ['cms', 'root'] as const;

function extractObjectPathFromDownloadURL(url: string): string | null {
  try {
    const u = new URL(String(url));
    const p = u.searchParams.get('o');
    return p ? decodeURIComponent(p) : null;
  } catch { return null; }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });

    const { albumId, type, downloadUrl, thumbUrl = null, title = '', setAsPrimary = false } = req.body || {};
    if (!albumId) return res.status(400).json({ ok: false, error: 'missing_albumId' });

    const isVideo = type === 'video';
    if (!isVideo && type !== 'image') return res.status(400).json({ ok: false, error: 'bad_type' });
    if (!downloadUrl) return res.status(400).json({ ok: false, error: 'missing_downloadUrl' });

    const albumRef = adminDb.collection(CMS[0]).doc(CMS[1]).collection('galleries').doc(String(albumId));
    const albumDoc = await albumRef.get();
    if (!albumDoc.exists) return res.status(404).json({ ok: false, error: 'album_not_found' });

    const storagePath = extractObjectPathFromDownloadURL(downloadUrl);

    const media = {
      groupId: String(albumId),
      url: String(downloadUrl),
      type: isVideo ? ('video' as const) : ('image' as const),
      storagePath: storagePath ?? null,
      thumbUrl: thumbUrl ?? null,
      title: String(title || ''),
      approved: true,
      createdAt: FieldValue.serverTimestamp(),
    };

    const mediaRef = await adminDb.collection(CMS[0]).doc(CMS[1]).collection('media').add(media);

    const updates: unknown = {
      mediaCount: FieldValue.increment(1),
      imageCount: FieldValue.increment(isVideo ? 0 : 1),
      videoCount: FieldValue.increment(isVideo ? 1 : 0),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const a: unknown = albumDoc.data() || {};
    if (setAsPrimary || !a.primaryMediaUrl) {
      updates.primaryMediaId = mediaRef.id;
      updates.primaryMediaUrl = downloadUrl;
      updates.primaryMediaType = isVideo ? 'video' : 'image';
      updates.primaryMediaThumbUrl = thumbUrl ?? null;
    }

    await albumRef.set(updates, { merge: true });
    return res.status(200).json({ ok: true, id: mediaRef.id });
  } catch (err: unknown) {
    return res.status(500).json({ ok: false, error: 'internal', message: String(err?.message || '') });
  }
}
