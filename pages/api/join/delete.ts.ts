// pages/api/admin/join/delete.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getApps, initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

if (!getApps().length) {
  initializeApp({
    credential: applicationDefault(),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET, // e.g. "your-project.appspot.com"
  });
}
const db = getFirestore();
const bucket = getStorage().bucket();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });

    const { applicationId, hard } = req.body || {};
    if (!applicationId) return res.status(422).json({ ok: false, error: 'Missing applicationId' });

    const appRef = db.collection('joinApplications').doc(String(applicationId));
    const appSnap = await appRef.get();
    if (!appSnap.exists) {
      return res.status(404).json({ ok: false, error: 'Application not found' });
    }

    const appData = appSnap.data() || {};
    const photoPath: string | null = appData.photoPath || null;

    // delete related members by applicationId (if any)
    const membersSnap = await db.collection('members').where('applicationId', '==', applicationId).get();
    const paymentsSnap = await db.collection('payments').where('applicationId', '==', applicationId).get();

    const batch = db.batch();
    batch.delete(appRef);
    membersSnap.forEach((d) => batch.delete(d.ref));
    if (hard) {
      // If hard delete, also remove payments (optional by your policy)
      paymentsSnap.forEach((d) => batch.delete(d.ref));
    }
    await batch.commit();

    // delete photo from storage if known
    if (hard && photoPath) {
      try {
        await bucket.file(photoPath).delete({ ignoreNotFound: true });
      } catch (e) {
        // ignore errors deleting photo
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err: unknown) {
    console.error('admin/join/delete error', err);
    return res.status(500).json({ ok: false, error: 'Internal error' });
  }
}
