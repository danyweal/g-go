// pages/api/join/upload-photo.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getStorage } from 'firebase-admin/storage';
import { adminDb } from '@/lib/firebaseAdmin'; // reuse existing Admin app (Firestore export)
import formidable from 'formidable';
import fs from 'fs';
import fsp from 'fs/promises';
import { randomUUID } from 'crypto';
import path from 'path';

export const config = {
  api: { bodyParser: false }, // REQUIRED for formidable (multipart)
};

// ----- Resolve Storage bucket (fallback to env if default isn't set) -----
const storage = getStorage(adminDb.app);
const bucket =
  process.env.FIREBASE_STORAGE_BUCKET
    ? storage.bucket(process.env.FIREBASE_STORAGE_BUCKET)
    : storage.bucket(); // requires storageBucket configured in firebaseAdmin init

type UploadOk = {
  ok: true;
  path: string;
  url: string;
};

type UploadErr = {
  ok: false;
  error: string;
};

type ParsedFile = {
  filePath: string;
  originalName: string;
  mimeType: string;
  size: number;
};

/** Map MIME → extension (prefer mime over user-supplied name) */
function extFromMime(mime: string): string {
  if (mime === 'image/jpeg' || mime === 'image/jpg') return '.jpg';
  if (mime === 'image/png') return '.png';
  if (mime === 'image/webp') return '.webp';
  if (mime === 'image/gif') return '.gif';
  if (mime === 'image/heic') return '.heic';
  if (mime === 'image/heif') return '.heif';
  return '';
}

/** Parse multipart form and return the uploaded file info */
function parseForm(req: NextApiRequest): Promise<ParsedFile> {
  const form = formidable({
    multiples: false,
    // 8MB max (keep aligned with client)
    maxFileSize: 8 * 1024 * 1024,
    // Optional: ensure we only accept images as they're streamed
    filter: ({ mimetype }) => (mimetype ? mimetype.startsWith('image/') : false),
  });

  return new Promise((resolve, reject) => {
    form.parse(req, (err, _fields, files) => {
      if (err) return reject(err);

      // Accept common field names: file / photo / upload
      const anyFile =
        (files.file as formidable.File | formidable.File[] | undefined) ??
        (files.photo as formidable.File | formidable.File[] | undefined) ??
        (files.upload as formidable.File | formidable.File[] | undefined);

      const file = Array.isArray(anyFile) ? anyFile[0] : anyFile;
      if (!file) return reject(new Error('No file provided (expected field "file")'));

      // compat across formidable versions: filepath vs path
      const tmpPath =
        (file as unknown).filepath ||
        (file as unknown).filePath ||
        (file as unknown).path;

      if (!tmpPath || typeof tmpPath !== 'string') {
        return reject(new Error('Failed to read uploaded file path'));
      }

      resolve({
        filePath: tmpPath,
        originalName: (file as formidable.File).originalFilename || 'photo.jpg',
        mimeType: (file as formidable.File).mimetype || 'image/jpeg',
        size: Number((file as formidable.File).size || 0),
      });
    });
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UploadOk | UploadErr>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  let filePathToCleanup: string | null = null;

  try {
    // Ensure bucket is available
    if (!bucket?.name) {
      return res.status(500).json({
        ok: false,
        error:
          'Storage bucket not configured. Set FIREBASE_STORAGE_BUCKET or configure storageBucket in Firebase Admin.',
      });
    }

    const { filePath, originalName, mimeType, size } = await parseForm(req);
    filePathToCleanup = filePath;

    // Validate type & size (defense-in-depth)
    if (!mimeType.startsWith('image/')) {
      await fsp.unlink(filePath).catch(() => {});
      return res.status(415).json({ ok: false, error: 'Only image uploads are allowed' });
    }
    if (size > 8 * 1024 * 1024) {
      await fsp.unlink(filePath).catch(() => {});
      return res.status(413).json({ ok: false, error: 'Image is too large (max 8MB)' });
    }

    // Decide extension: prefer MIME; fallback to original name; default .jpg
    const mimeExt = extFromMime(mimeType);
    const safeNameExt = (path.extname(originalName || '') || '').toLowerCase();
    const ext = mimeExt || safeNameExt || '.jpg';

    // Save under members/photos/<uuid>.<ext>
    const id = randomUUID();
    const destPath = `members/photos/${id}${ext}`;

    // Token for direct download URL
    const token = randomUUID();

    await bucket.upload(filePath, {
      destination: destPath,
      metadata: {
        contentType: mimeType,
        cacheControl: 'public, max-age=31536000, immutable',
        metadata: {
          firebaseStorageDownloadTokens: token,
        },
      },
    });

    // Clean up tmp file
    await fsp.unlink(filePath).catch(() => {});
    filePathToCleanup = null;

    // Public download URL with access token
    const bucketName = bucket.name;
    const url = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(
      destPath
    )}?alt=media&token=${token}`;

    return res.status(200).json({ ok: true, path: destPath, url });
  } catch (err: unknown) {
    console.error('upload-photo error', err);
    // Best-effort cleanup
    if (filePathToCleanup) {
      try { await fsp.unlink(filePathToCleanup); } catch {}
    }
    const msg =
      err?.code === 'LIMIT_FILE_SIZE'
        ? 'Image is too large (max 8MB)'
        : err?.message || 'Failed to upload photo';
    const status =
      err?.code === 'LIMIT_FILE_SIZE' ? 413 :
      err?.message?.toLowerCase?.().includes('image') ? 415 :
      500;
    return res.status(status).json({ ok: false, error: msg });
  }
}
