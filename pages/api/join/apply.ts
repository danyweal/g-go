// pages/api/join/apply.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebaseAdmin';

type ApplyBody = {
  firstName: string;
  lastName: string;
  fatherName?: string;          // Arabic OR English OR "EN / AR"
  grandfatherName?: string;     // Arabic OR English OR "EN / AR"
  fullName?: string;
  dob: string;
  phone: string;
  email: string;
  address: string;
  postcode: string;
  ukCity: string;
  cityOfOriginAr: string;
  cityOfOrigin?: string;
  fee: number;
  feeChoice: '0' | '5' | '10' | 'custom';
  customFeeRaw?: string;
  note?: string;
  photoUrl?: string;
  photoPath?: string;
  paymentRequired?: boolean;
  status?: string;
};

type Ok = { ok: true; id: string };
type Err = { ok: false; error: string };

const AR_CHARS =
  '\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF';
const EN_PART = "([A-Za-z][A-Za-z\\s'\\.-]{0,60})";
const AR_PART = `([${AR_CHARS}\\s'\\u0640\\.-]{1,60})`;

// If a slash exists -> try strict split; else detect script and assign to EN or AR.
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
    // fallthrough to detection if slash but invalid strict pattern
  }

  const hasArabic = new RegExp('[' + AR_CHARS + ']').test(raw);
  if (hasArabic) {
    return { en: null, ar: raw, combined: raw };
  } else {
    return { en: raw, ar: null, combined: raw };
  }
}

// Remove any keys with value === undefined (Firestore disallows undefined)
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const entries = Object.entries(obj).filter(([, v]) => v !== undefined);
  return Object.fromEntries(entries) as T;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Ok | Err>
) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    }

    const b = req.body as ApplyBody;

    // Required validation (father & grandfather required)
    const required: (keyof ApplyBody)[] = [
      'firstName',
      'lastName',
      'fatherName',
      'grandfatherName',
      'dob',
      'phone',
      'email',
      'address',
      'postcode',
      'ukCity',
      'cityOfOriginAr',
      'fee',
      'feeChoice',
    ];
    for (const k of required) {
      const v = b[k];
      if (v === undefined || v === null || (typeof v === 'string' && !v.trim())) {
        return res.status(422).json({ ok: false, error: `Missing required field: ${String(k)}` });
      }
    }

    const father = smartSplitName(b.fatherName);
    const grand = smartSplitName(b.grandfatherName);

    const firstName = b.firstName.trim();
    const lastName = b.lastName.trim();
    const fullName = (b.fullName || `${firstName} ${lastName}`).trim();

    const email = b.email.trim().toLowerCase();
    const address = b.address.trim();
    const postcode = b.postcode.trim().toUpperCase();
    const ukCity = b.ukCity.trim();
    const cityOfOriginAr = b.cityOfOriginAr.trim();
    const cityOfOrigin = (b.cityOfOrigin || cityOfOriginAr).trim();
    const fee = Number.isFinite(b.fee) ? Number(b.fee) : 0;

    // Only set customFeeRaw when feeChoice === 'custom'
    // If custom but missing, store empty string (never undefined).
    const customFeeRaw =
      b.feeChoice === 'custom' ? String(b.customFeeRaw ?? '').trim() : undefined;

    const docRaw = {
      firstName,
      lastName,
      fullName,
      dob: b.dob,

      // Store combined and split
      fatherName: father.combined,
      fatherNameEn: father.en,
      fatherNameAr: father.ar,

      grandfatherName: grand.combined,
      grandfatherNameEn: grand.en,
      grandfatherNameAr: grand.ar,

      phone: b.phone.trim(),
      email,
      address,
      postcode,
      ukCity,

      cityOfOriginAr,
      cityOfOrigin,

      fee,
      feeChoice: b.feeChoice,
      customFeeRaw, // may be undefined -> stripped below

      note: b.note?.trim() || '',

      // Optional photo fields (strip if undefined)
      photoUrl: b.photoUrl ?? undefined,
      photoPath: b.photoPath ?? undefined,

      status: (b.status || 'submitted') as string,
      paymentRequired: !!b.paymentRequired,

      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const doc = stripUndefined(docRaw);

    const ref = await adminDb.collection('joinApplications').add(doc);
    return res.status(200).json({ ok: true, id: ref.id });
  } catch (err: unknown) {
    console.error('apply error', err);
    return res.status(500).json({ ok: false, error: 'Internal error' });
  }
}
