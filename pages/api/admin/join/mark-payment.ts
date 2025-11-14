// pages/api/admin/join/mark-payment.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebaseAdmin';

type Ok = { ok: true; paymentId: string };
type Err = { ok: false; error: string };

function toTimestampOrNull(input?: string | number | null) {
  if (input == null) return null;
  if (typeof input === 'number' && Number.isFinite(input)) {
    return Timestamp.fromMillis(input);
  }
  if (typeof input === 'string') {
    const d = new Date(input);
    if (!isNaN(d.getTime())) return Timestamp.fromMillis(d.getTime());
  }
  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Ok | Err>) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    }

    const {
      applicationId,
      amount,
      currency = 'GBP',
      provider = 'manual',
      periodStart,
      periodEnd,
      note,
    } = req.body || {};

    if (!applicationId) return res.status(422).json({ ok: false, error: 'Missing applicationId' });
    if (amount == null || isNaN(Number(amount))) {
      return res.status(422).json({ ok: false, error: 'Missing/invalid amount' });
    }

    const appRef = adminDb.collection('joinApplications').doc(String(applicationId));
    const appSnap = await appRef.get();
    if (!appSnap.exists) {
      return res.status(404).json({ ok: false, error: 'Application not found' });
    }

    const tsStart = toTimestampOrNull(periodStart);
    const tsEnd = toTimestampOrNull(periodEnd);

    const payDoc = {
      applicationId: String(applicationId),
      amount: Number(amount),
      currency: String(currency || 'GBP'),
      provider: String(provider || 'manual'),
      note: (note ?? '').toString(),
      createdAt: FieldValue.serverTimestamp(),
      periodStart: tsStart,
      periodEnd: tsEnd,
    };

    const payRef = await adminDb.collection('payments').add(payDoc);

    const updates: unknown = {
      lastPaymentAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (tsEnd) updates.currentPeriodEnd = tsEnd;

    await appRef.update(updates);

    const membersSnap = await adminDb.collection('members').where('applicationId', '==', applicationId).limit(1).get();
    if (!membersSnap.empty) {
      const memberRef = membersSnap.docs[0].ref;
      const mu: unknown = { updatedAt: FieldValue.serverTimestamp() };
      if (tsEnd) mu.currentPeriodEnd = tsEnd;
      await memberRef.update(mu);
    }

    return res.status(200).json({ ok: true, paymentId: payRef.id });
  } catch (err: unknown) {
    console.error('admin/join/mark-payment error', err);
    return res.status(500).json({ ok: false, error: 'Internal error' });
  }
}
