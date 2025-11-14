// pages/api/admin/join/update.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebaseAdmin';

type Ok = { ok: true };
type Err = { ok: false; error: string };

const AR_CHARS =
  '\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF';
const EN_PART = "([A-Za-z][A-Za-z\\s'\\.-]{0,60})";
const AR_PART = `([${AR_CHARS}\\s'\\u0640\\.-]{1,60})`;

function smartSplitName(input?: string | null) {
  if (!input) return { en: null, ar: null, combined: null };
  const raw = String(input).trim();
  if (!raw) return { en: null, ar: null, combined: null };
  if (raw.includes('/')) {
    const rx = new RegExp(`^\\s*${EN_PART}\\s*/\\s*${AR_PART}\\s*$`);
    const m = raw.match(rx);
    if (m) {
      const [, en, ar] = m;
      return { en: en.trim(), ar: ar.trim(), combined: raw };
    }
  }
  const hasArabic = new RegExp('[' + AR_CHARS + ']').test(raw);
  return hasArabic ? { en: null, ar: raw, combined: raw } : { en: raw, ar: null, combined: raw };
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const entries = Object.entries(obj).filter(([, v]) => v !== undefined);
  return Object.fromEntries(entries) as T;
}

const ALLOWED_FIELDS = new Set([
  'firstName',
  'lastName',
  'fullName',
  'dob',
  'phone',
  'email',
  'address',
  'postcode',
  'ukCity',
  'cityOfOriginAr',
  'cityOfOrigin',
  'fee',
  'feeChoice',
  'customFeeRaw',
  'note',
  'photoUrl',
  'photoPath',
  'status',
  'paymentRequired',
  'fatherName',
  'grandfatherName',
]);

export default async function handler(req: NextApiRequest, res: NextApiResponse<Ok | Err>) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    }

    const { applicationId, update } = req.body || {};
    if (!applicationId) return res.status(422).json({ ok: false, error: 'Missing applicationId' });
    if (!update || typeof update !== 'object') return res.status(422).json({ ok: false, error: 'Missing update payload' });

    const u: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(update)) {
      if (ALLOWED_FIELDS.has(k)) u[k] = v;
    }

    if ('fatherName' in u) {
      const s = smartSplitName(u.fatherName);
      u.fatherName = s.combined;
      u.fatherNameEn = s.en;
      u.fatherNameAr = s.ar;
    }
    if ('grandfatherName' in u) {
      const s = smartSplitName(u.grandfatherName);
      u.grandfatherName = s.combined;
      u.grandfatherNameEn = s.en;
      u.grandfatherNameAr = s.ar;
    }

    const payload = stripUndefined({
      ...u,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const appRef = adminDb.collection('joinApplications').doc(String(applicationId));
    const appSnap = await appRef.get();
    if (!appSnap.exists) {
      return res.status(404).json({ ok: false, error: 'Application not found' });
    }

    await appRef.update(payload);
    return res.status(200).json({ ok: true });
  } catch (err: unknown) {
    console.error('admin/join/update error', err);
    return res.status(500).json({ ok: false, error: 'Internal error' });
  }
}
