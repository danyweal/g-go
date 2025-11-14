// pages/api/admin/join/approve.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebaseAdmin';

type Ok = { ok: true; memberId: string; applicationId: string };
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
    const app = appSnap.data() || {};

    // Already a member?
    const existing = await adminDb.collection('members').where('applicationId', '==', applicationId).limit(1).get();
    if (!existing.empty) {
      await appRef.update({ status: 'approved', updatedAt: FieldValue.serverTimestamp() });
      return res.status(200).json({ ok: true, memberId: existing.docs[0].id, applicationId });
    }

    const memberDoc = {
      applicationId: String(applicationId),
      fullName: (app.fullName || `${app.firstName || ''} ${app.lastName || ''}`.trim()) || null,
      email: app.email || null,
      phone: app.phone || null,
      address: app.address || null,
      postcode: app.postcode || null,
      ukCity: app.ukCity || null,

      fee: app.fee ?? null,
      feeChoice: app.feeChoice ?? null,

      photoUrl: app.photoUrl || null,
      photoPath: app.photoPath || null,

      status: 'active',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      currentPeriodEnd: app.currentPeriodEnd || null,
    };

    const ref = await adminDb.collection('members').add(memberDoc);

    await appRef.update({
      status: 'approved',
      updatedAt: FieldValue.serverTimestamp(),
    });

    return res.status(200).json({ ok: true, memberId: ref.id, applicationId });
  } catch (err: unknown) {
    console.error('admin/join/approve error', err);
    return res.status(500).json({ ok: false, error: 'Internal error' });
  }
}
