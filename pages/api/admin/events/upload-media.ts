// pages/api/admin/events/upload-media.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebaseAdmin';
import { randomUUID } from 'crypto';

export const config = { api: { bodyParser: { sizeLimit: '64mb' } } };

function safe(name: string) {
  return String(name || 'file').replace(/[^\w.\-]+/g, '_');
}

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

    const {
      eventId, type, title = '', filename: rawFilename, contentType, data,
      thumbData, thumbContentType = 'image/jpeg', setAsPrimary = false,
    } = req.body || {};

    if (!eventId) return res.status(400).json({ ok: false, error: 'missing_eventId' });
    const isVideo = type === 'video';
    if (!isVideo && type !== 'image') return res.status(400).json({ ok: false, error: 'bad_type' });
    if (!contentType || !data) return res.status(400).json({ ok: false, error: 'missing_file' });

    const eventRef = adminDb.collection('cms').doc('root').collection('events').doc(String(eventId));
    const eventDoc = await eventRef.get();
    if (!eventDoc.exists) return res.status(404).json({ ok: false, error: 'event_not_found' });

    const bucket = admin.storage().bucket();
    const filename = safe(rawFilename || (isVideo ? `video_${Date.now()}` : `image_${Date.now()}`));
    const objectPath = `cms/root/events/${eventId}/${filename}`;
    const buffer = Buffer.from(String(data), 'base64');
    const token = randomUUID();

    await bucket.file(objectPath).save(buffer, {
      contentType,
      metadata: { metadata: { firebaseStorageDownloadTokens: token } },
      resumable: false,
      public: false,
      validation: isVideo ? false : 'md5',
    });

    const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`;

    let thumbUrl: string | null = null;
    if (thumbData) {
      const thumbName = safe(`thumb_${filename.replace(/\.[^.]+$/, '')}.jpg`);
      const thumbPath = `cms/root/events/${eventId}/${thumbName}`;
      const tbuf = Buffer.from(String(thumbData), 'base64');
      const tkn = randomUUID();
      await bucket.file(thumbPath).save(tbuf, {
        contentType: thumbContentType,
        metadata: { metadata: { firebaseStorageDownloadTokens: tkn } },
        resumable: false,
        public: false,
        validation: 'md5',
      });
      thumbUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(thumbPath)}?alt=media&token=${tkn}`;
    }

    // Create media doc (reusing global 'media' collection)
    const mediaDoc = {
      groupId: String(eventId),
      contextType: 'event' as const,
      url: downloadUrl,
      type: isVideo ? ('video' as const) : ('image' as const),
      storagePath: objectPath,
      thumbUrl: thumbUrl ?? null,
      title: String(title || ''),
      approved: true,
      createdAt: FieldValue.serverTimestamp(),
    };

    const mediaRef = await adminDb.collection('cms').doc('root').collection('media').add(mediaDoc);

    // Update event counters & maybe primary
    const updates: unknown = {
      mediaCount: FieldValue.increment(1),
      imageCount: FieldValue.increment(isVideo ? 0 : 1),
      videoCount: FieldValue.increment(isVideo ? 1 : 0),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const ev = eventDoc.data() as unknown;
    if (setAsPrimary || !ev?.primaryMediaUrl) {
      updates.primaryMediaId = mediaRef.id;
      updates.primaryMediaUrl = downloadUrl;
      updates.primaryMediaType = isVideo ? 'video' : 'image';
      updates.primaryMediaThumbUrl = thumbUrl ?? null;
    }

    await eventRef.set(updates, { merge: true });

    return res.status(200).json({ ok: true, id: mediaRef.id, downloadUrl, thumbUrl });
  } catch (err: unknown) {
    console.error('POST /api/admin/events/upload-media:', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Server error' });
  }
}
