// pages/api/admin/join/soft-delete.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebaseAdmin';

type Ok = { ok: true };
type Err = { ok: false; error: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<Ok | Err>) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    }

    const { applicationId } = req.body || {};
    if (!applicationId) {
      return res.status(422).json({ ok: false, error: 'Missing applicationId' });
    }

    const appRef = adminDb.collection('joinApplications').doc(String(applicationId));
    const appSnap = await appRef.get();
    if (!appSnap.exists) {
      return res.status(404).json({ ok: false, error: 'Application not found' });
    }

    await appRef.update({
      status: 'deleted',
      deletedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return res.status(200).json({ ok: true });
  } catch (err: unknown) {
    console.error('admin/join/soft-delete error', err);
    return res.status(500).json({ ok: false, error: 'Internal error' });
  }
}
