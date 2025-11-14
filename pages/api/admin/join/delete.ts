// pages/api/admin/join/delete.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getStorage } from 'firebase-admin/storage';
import { adminDb } from '@/lib/firebaseAdmin';

const bucket = getStorage(adminDb.app).bucket();

type Ok = { ok: true };
type Err = { ok: false; error: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<Ok | Err>) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });

    const { applicationId, hard } = req.body || {};
    if (!applicationId) return res.status(422).json({ ok: false, error: 'Missing applicationId' });

    const appRef = adminDb.collection('joinApplications').doc(String(applicationId));
    const appSnap = await appRef.get();
    if (!appSnap.exists) {
      return res.status(404).json({ ok: false, error: 'Application not found' });
    }
    const appData = appSnap.data() || {};
    const photoPath: string | null = appData.photoPath || null;

    const membersSnap = await adminDb.collection('members').where('applicationId', '==', applicationId).get();
    const paymentsSnap = await adminDb.collection('payments').where('applicationId', '==', applicationId).get();

    const batch = adminDb.batch();
    batch.delete(appRef);
    membersSnap.forEach((d) => batch.delete(d.ref));
    if (hard) paymentsSnap.forEach((d) => batch.delete(d.ref));
    await batch.commit();

    if (hard && photoPath) {
      try {
        await bucket.file(photoPath).delete({ ignoreNotFound: true });
      } catch {
        // ignore storage delete errors
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err: unknown) {
    console.error('admin/join/delete error', err);
    return res.status(500).json({ ok: false, error: 'Internal error' });
  }
}
