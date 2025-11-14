// components/JoinForm.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';

type Audience = 'palestinian' | 'nonPalestinian';
type Tier = 'free' | 'silver' | 'gold' | 'diamond';

const TIERS: Record<Tier, { label: string; monthly: number; note?: string; emoji?: string }> = {
  free:    { label: 'Free',    monthly: 0,      note: 'ابدأ بلا رسوم الآن' },
  silver:  { label: 'Silver',  monthly: 11.99,  note: 'Monthly', emoji: '🥈' },
  gold:    { label: 'Gold',    monthly: 21.99,  note: 'Monthly', emoji: '🥇' },
  diamond: { label: 'Diamond', monthly: 49.99,  note: 'Monthly', emoji: '💎' },
};

type FormData = {
  firstName: string;
  lastName: string;

  fatherName: string;
  grandfatherName: string;

  dob: string;
  phone: string;
  email: string;
  address: string;
  postcode: string;
  ukCity: string;

  // Keep same backend keys (used for both audiences)
  cityOfOriginAr: string;

  // New tier model
  feeChoice: Tier;
  fee: number;

  paymentConfirmed: boolean;
  note?: string;
};

type SubmitState = 'idle' | 'busy' | 'ok' | 'error';

type Props = {
  defaultFee?: number; // optional override; otherwise we use TIERS[feeChoice].monthly
  PaymentWidget?: React.ComponentType<{
    applicationId?: string;
    formSnapshot?: unknown;
    defaultAmount?: number;
    currency?: 'GBP' | 'USD' | 'EUR';
    onApplicationCreated?: (id: string) => void;
  }>;
  initialApplicationId?: string;
  audienceDefault?: Audience | null;
};

const emailRx = /\S+@\S+\.\S+/;

const initForm: FormData = {
  firstName: '',
  lastName: '',
  fatherName: '',
  grandfatherName: '',
  dob: '',
  phone: '',
  email: '',
  address: '',
  postcode: '',
  ukCity: '',
  cityOfOriginAr: '',
  feeChoice: 'free',
  fee: TIERS.free.monthly,
  paymentConfirmed: false,
  note: '',
};

const inputBase =
  'w-full rounded-xl border border-neutral-300 px-3 py-2 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition';

function Field({
  label,
  required,
  children,
  hint,
  id,
}: {
  label: string | React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
  hint?: string | React.ReactNode;
  id?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-neutral-800">
        {label} {required && <span className="text-red-600">*</span>}
      </label>
      {children}
      {hint ? <div className="text-xs text-neutral-500">{hint}</div> : null}
    </div>
  );
}

export default function JoinForm({
  defaultFee,
  PaymentWidget,
  initialApplicationId = '',
  audienceDefault = null,
}: Props) {
  // Audience chooser
  const [audience, setAudience] = useState<Audience | null>(audienceDefault);

  const [form, setForm] = useState<FormData>({
    ...initForm,
    // If a defaultFee is explicitly passed, use it initially; once the user clicks a tier, we switch to that tier's amount.
    fee: defaultFee ?? TIERS[initForm.feeChoice].monthly,
  });
  const [state, setState] = useState<SubmitState>('idle');
  const [message, setMessage] = useState<string | null>(null);

  // Photo state
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [photoRemoteUrl, setPhotoRemoteUrl] = useState<string | null>(null);
  const [photoRemotePath, setPhotoRemotePath] = useState<string | null>(null);
  const [photoUploadState, setPhotoUploadState] = useState<'idle' | 'uploading' | 'ok' | 'error'>('idle');
  const [photoError, setPhotoError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    };
  }, [photoPreviewUrl]);

  // Existing application id (rare)
  const [applicationId, setApplicationId] = useState<string>(initialApplicationId);

  const setFeeChoice = (choice: Tier) => {
    const fee = TIERS[choice].monthly;
    setForm((f) => ({
      ...f,
      feeChoice: choice,
      fee,
      paymentConfirmed: fee > 0 ? f.paymentConfirmed : false,
    }));
  };

  const update = <K extends keyof FormData>(key: K, value: FormData[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const canSubmit = useMemo(() => {
    if (!form.firstName.trim()) return false;
    if (!form.lastName.trim()) return false;
    if (!form.fatherName.trim()) return false;
    if (!form.grandfatherName.trim()) return false;
    if (!form.dob) return false;
    if (!emailRx.test(form.email.trim())) return false;
    if (!form.phone.trim()) return false;
    if (!form.address.trim()) return false;
    if (!form.postcode.trim()) return false;
    if (!form.ukCity.trim()) return false;
    if (!form.cityOfOriginAr.trim()) return false;
    return true;
  }, [form]);

  const formSnapshot = useMemo(() => {
    return {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      fatherName: form.fatherName.trim(),
      grandfatherName: form.grandfatherName.trim(),
      fullName: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
      dob: form.dob,
      phone: form.phone.trim(),
      email: form.email.trim().toLowerCase(),
      address: form.address.trim(),
      postcode: form.postcode.trim().toUpperCase(),
      ukCity: form.ukCity.trim(),
      cityOfOriginAr: form.cityOfOriginAr.trim(),
      cityOfOrigin: form.cityOfOriginAr.trim(),

      // Pricing — BOTH values so backend knows exactly what was chosen.
      fee: Number(form.fee || 0),
      feeChoice: form.feeChoice,

      note: form.note?.trim() || '',

      // Photo
      photoUrl: photoRemoteUrl || undefined,
      photoPath: photoRemotePath || undefined,

      // Audience marker (optional analytics)
      audience: audience || undefined,
    };
  }, [form, photoRemoteUrl, photoRemotePath, audience]);

  const uploadPhoto = async (file: File) => {
    setPhotoUploadState('uploading');
    setPhotoError(null);
    try {
      if (!file.type.startsWith('image/')) {
        throw new Error('Only image files are allowed');
      }
      if (file.size > 8 * 1024 * 1024) {
        throw new Error('Image is too large (max 8MB)');
      }
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch('/api/join/upload-photo', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok || j?.ok === false) throw new Error(j?.error || 'Upload failed');
      setPhotoRemoteUrl(j.url);
      setPhotoRemotePath(j.path);
      setPhotoUploadState('ok');
    } catch (e: any) {
      setPhotoUploadState('error');
      setPhotoError(e?.message || 'Failed to upload image');
      setPhotoRemoteUrl(null);
      setPhotoRemotePath(null);
    }
  };

  const onPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhoto(file);
    setPhotoRemoteUrl(null);
    setPhotoRemotePath(null);
    setPhotoError(null);
    setPhotoUploadState(file ? 'uploading' : 'idle');
    setPhotoPreviewUrl(file ? URL.createObjectURL(file) : null);
    if (file) uploadPhoto(file);
  };

  const submitFree = async () => {
    setState('busy');
    setMessage(null);
    try {
      if (photo && photoUploadState === 'uploading') {
        throw new Error('Please wait for the photo to finish uploading');
      }
      const r = await fetch('/api/join/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formSnapshot,
          paymentRequired: false,
          status: 'submitted',
        }),
      });
      const data = await r.json();
      if (!r.ok || data?.ok === false) throw new Error(data?.error || 'Error');
      setApplicationId(data.id);
      setState('ok');
      setMessage('تم استلام طلبك بنجاح. شكرًا لانضمامك ♥');
      resetFormState();
    } catch (e: any) {
      setState('error');
      setMessage(e?.message || 'حدث خطأ غير متوقع');
    } finally {
      setState((s) => (s === 'busy' ? 'idle' : s));
    }
  };

  const resetFormState = () => {
    setForm({
      ...initForm,
      fee: TIERS[initForm.feeChoice].monthly,
    });
    setPhoto(null);
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoPreviewUrl(null);
    setPhotoRemoteUrl(null);
    setPhotoRemotePath(null);
    setPhotoUploadState('idle');
    setPhotoError(null);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || state === 'busy') return;
    if (form.fee <= 0) {
      await submitFree();
    } else {
      if (photo && photoUploadState === 'uploading') {
        setMessage('الرجاء الانتظار لحين اكتمال رفع الصورة.');
        return;
      }
      setMessage('الرجاء إتمام الدفع أدناه لإكمال الانضمام.');
    }
  };

  // Audience chooser (before showing the form)
  if (!audience) {
    return (
      <div className="grid gap-6" dir="ltr">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight">Choose Your Form</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Please select whether you are Palestinian or Non-Palestinian to continue.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
          <button
            type="button"
            onClick={() => setAudience('palestinian')}
            className="rounded-2xl border bg-white p-6 text-left shadow-sm ring-1 ring-black/5 hover:bg-neutral-50 transition"
          >
            <div className="text-lg font-semibold">I am Palestinian</div>
            <p className="text-sm text-neutral-500 mt-1">
              Continue with the Palestinian membership form.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setAudience('nonPalestinian')}
            className="rounded-2xl border bg-white p-6 text-left shadow-sm ring-1 ring-black/5 hover:bg-neutral-50 transition"
          >
            <div className="text-lg font-semibold">I am Non-Palestinian Friend</div>
            <p className="text-sm text-neutral-500 mt-1">
              Continue with the Non-Palestinian Friend membership form.
            </p>
          </button>
        </div>
      </div>
    );
  }

  const isPalestinian = audience === 'palestinian';

  return (
    <form onSubmit={onSubmit} className="grid gap-6" dir="ltr">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold tracking-tight">Join Membership</h2>
        <p className="mt-1 text-sm text-neutral-600">
          اختر خطة مجانية أو خطة شهرية ثم أكمل الدفع — Stripe.
        </p>
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setAudience(null)}
            className="text-xs font-medium text-neutral-600 underline underline-offset-4 hover:text-neutral-900"
            aria-label="Change audience"
            title="Change audience"
          >
            {isPalestinian ? 'Not Palestinian? Switch form' : 'Are you Palestinian? Switch form'}
          </button>
        </div>
      </div>

      {/* Personal Info */}
      <section className="rounded-2xl border bg-white p-5 md:p-6 shadow-sm ring-1 ring-black/5">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Personal Information</h3>
          <p className="text-xs text-neutral-500">املأ بياناتك بدقة للتواصل معك.</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="First Name / الاسم الأول" required id="firstName">
            <input
              id="firstName"
              type="text"
              value={form.firstName}
              onChange={(e) => update('firstName', e.target.value)}
              className={inputBase}
              autoComplete="given-name"
            />
          </Field>

          <Field label="Last Name / اسم العائلة" required id="lastName">
            <input
              id="lastName"
              type="text"
              value={form.lastName}
              onChange={(e) => update('lastName', e.target.value)}
              className={inputBase}
              autoComplete="family-name"
            />
          </Field>
        </div>

        {/* Father & Grandfather */}
        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <Field
            label="Father's Name / اسم الأب"
            required
            id="fatherName"
            hint="You can write in Arabic or English / يمكنك الكتابة بالعربية أو بالإنجليزية"
          >
            <input
              id="fatherName"
              type="text"
              value={form.fatherName}
              onChange={(e) => update('fatherName', e.target.value)}
              className={inputBase}
              dir="auto"
              placeholder="Ahmed or أحمد"
            />
          </Field>

          <Field
            label="Grandfather's Name / اسم الجد"
            required
            id="grandfatherName"
            hint="You can write in Arabic or English / يمكنك الكتابة بالعربية أو بالإنجليزية"
          >
            <input
              id="grandfatherName"
              type="text"
              value={form.grandfatherName}
              onChange={(e) => update('grandfatherName', e.target.value)}
              className={inputBase}
              dir="auto"
              placeholder="Mahmoud or محمود"
            />
          </Field>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <Field label="Date of Birth / تاريخ الميلاد" required hint="Format: YYYY-MM-DD" id="dob">
            <input id="dob" type="date" value={form.dob} onChange={(e) => update('dob', e.target.value)} className={inputBase} />
          </Field>
        </div>
      </section>

      {/* UK Address */}
      <section className="rounded-2xl border bg-white p-5 md:p-6 shadow-sm ring-1 ring-black/5">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">UK Address</h3>
          <p className="text-xs text-neutral-500">عنوانك الحالي في المملكة المتحدة.</p>
        </div>

        <Field label="Address / العنوان الحالي" required id="address">
          <input id="address" type="text" value={form.address} onChange={(e) => update('address', e.target.value)} className={inputBase} autoComplete="street-address" />
        </Field>

        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <Field label="Postcode / الرمز البريدي" required id="postcode">
            <input id="postcode" type="text" value={form.postcode} onChange={(e) => update('postcode', e.target.value)} className={`${inputBase} uppercase`} />
          </Field>

          <Field label="City / المدينة (UK)" required id="ukCity">
            <input id="ukCity" type="text" value={form.ukCity} onChange={(e) => update('ukCity', e.target.value)} className={inputBase} placeholder="e.g., Manchester, Liverpool…" />
          </Field>
        </div>
      </section>

      {/* Contact */}
      <section className="rounded-2xl border bg-white p-5 md:p-6 shadow-sm ring-1 ring-black/5">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Contact Details / بيانات التواصل</h3>
          <p className="text-xs text-neutral-500">سيتم استخدام هذه البيانات للتواصل معك بشأن العضوية.</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Email / البريد الإلكتروني" required id="email">
            <input id="email" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} className={inputBase} autoComplete="email" spellCheck={false} />
          </Field>

          <Field label="Phone Number / رقم الهاتف" required id="phone">
            <input id="phone" type="tel" inputMode="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} className={inputBase} autoComplete="tel" />
          </Field>
        </div>
      </section>

      {/* Photo */}
      <section className="rounded-2xl border bg-white p-5 md:p-6 shadow-sm ring-1 ring-black/5">
        <div className="mb-3">
          <h3 className="text-lg font-semibold">Personal Photo / صورة شخصية</h3>
        </div>

        <Field label="Upload a personal photo / ارفع صورة شخصية" id="profilePhoto">
          <input
            id="profilePhoto"
            type="file"
            accept="image/*"
            onChange={onPhotoChange}
            className="block w-full text-sm text-neutral-700 file:mr-4 file:rounded-md file:border-0 file:bg-neutral-900 file:px-3 file:py-2 file:text-white hover:file:bg-neutral-800"
          />
        </Field>

        {photoPreviewUrl && (
          <div className="mt-3 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoPreviewUrl}
              alt="Profile preview"
              className="h-36 w-36 object-cover rounded-xl border"
            />
            <div className="text-xs text-neutral-600">
              {photoUploadState === 'uploading' && 'Uploading… / جارٍ رفع الصورة…'}
              {photoUploadState === 'ok' && 'Uploaded ✓ / تم الرفع ✓'}
              {photoUploadState === 'error' && (
                <span className="text-red-600">Failed to upload image / فشل رفع الصورة: {photoError}</span>
              )}
            </div>
          </div>
        )}

        <p className="mt-2 text-xs text-neutral-600">
          Add your personal photo with a white background to get the membership card.
          <br />
          أضف صورتك الشخصية بخلفية بيضاء للحصول على بطاقة العضوية.
        </p>
      </section>

      {/* Origin (audience-aware) */}
      <section className="rounded-2xl border bg-white p-5 md:p-6 shadow-sm ring-1 ring-black/5">
        <div className="mb-3">
          <h3 className="text-lg font-semibold">
            {isPalestinian ? 'Palestinian Origin / الأصل الفلسطيني' : 'Origin / بلد/مدينة الأصل'}
          </h3>
          <p className="text-xs text-neutral-500">
            {isPalestinian
              ? 'البلدة/المدينة الأصلية في فلسطين (يمكنك الكتابة بالعربية أو بالإنجليزية).'
              : 'City & country of origin (you can write in Arabic or English).'}
          </p>
        </div>

        <Field
          label={isPalestinian ? 'البلدة/المدينة الأصلية' : 'City & Country of Origin'}
          required
          id="originAr"
        >
          <input
            id="originAr"
            type="text"
            value={form.cityOfOriginAr}
            onChange={(e) => update('cityOfOriginAr', e.target.value)}
            className={inputBase}
            dir="auto"
            placeholder={isPalestinian ? 'مثال: غزة، نابلس، الخليل…' : 'e.g., Cairo, Egypt / Paris, France'}
          />
        </Field>
      </section>

      {/* Membership Tiers */}
      <section className="rounded-2xl border bg-white p-5 md:p-6 shadow-sm ring-1 ring-black/5">
        <div className="mb-3">
          <h3 className="text-lg font-semibold">Membership Plan / خطة العضوية</h3>
          <p className="text-xs text-neutral-500">اختر خطة مجانية أو شهرية.</p>
        </div>

        <div className="grid md:grid-cols-4 gap-3 max-w-5xl">
          {(['free', 'silver', 'gold', 'diamond'] as Tier[]).map((t) => {
            const cfg = TIERS[t];
            const checked = form.feeChoice === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setFeeChoice(t)}
                className={`text-left rounded-xl border px-4 py-3 transition focus:outline-none focus:ring-2 focus:ring-emerald-600
                ${checked ? 'border-neutral-900 bg-neutral-900/5' : 'hover:bg-neutral-50'}`}
                aria-pressed={checked}
              >
                <div className="font-medium flex items-center gap-2">
                  {cfg.emoji && <span aria-hidden>{cfg.emoji}</span>}
                  {cfg.label}
                </div>
                <div className="text-sm mt-0.5">
                  £{cfg.monthly.toFixed(2)} {cfg.monthly === 0 ? '' : '/ Month'}
                </div>
                {cfg.note && <div className="text-xs text-neutral-500 mt-0.5">{cfg.note}</div>}
              </button>
            );
          })}
        </div>
      </section>

      {/* Optional Note */}
      <section className="rounded-2xl border bg-neutral-50 p-5 md:p-6">
        <Field label="Note (optional) / ملاحظة (اختياري)">
          <textarea
            value={form.note}
            onChange={(e) => update('note', e.target.value)}
            placeholder="Reference, bank, or any note / مرجع التحويل، البنك…"
            className={`${inputBase} min-h-[88px]`}
          />
        </Field>
      </section>

      {/* Alerts */}
      {state === 'error' && message && (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">{message}</div>
      )}
      {message && state !== 'error' && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 px-3 py-2 text-sm">{message}</div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => {
            resetFormState();
            setState('idle');
            setMessage(null);
          }}
          className="rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-neutral-300 hover:bg-neutral-100"
          disabled={state === 'busy'}
        >
          Clear
        </button>
        <button
          type="submit"
          disabled={!canSubmit || state === 'busy'}
          className="rounded-full px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60"
        >
          {state === 'busy'
            ? 'Processing…'
            : form.fee > 0
            ? 'Continue to Payment'
            : 'Submit (Free)'}
        </button>
      </div>

      {/* Payments */}
      {form.fee > 0 && canSubmit && (
        <section className="rounded-2xl border bg-white p-5 md:p-6 shadow-sm ring-1 ring-black/5">
          <div className="mb-3">
            <h3 className="text-lg font-semibold">الدفع لتفعيل العضوية</h3>
            <p className="text-xs text-neutral-500">
              الرجاء إتمام الدفع عبر Stripe. سيتم إنشاء رقم الطلب تلقائيًا بعد نجاح الدفع.
            </p>
          </div>

          {PaymentWidget ? (
            <PaymentWidget
              applicationId={applicationId || undefined}
              formSnapshot={formSnapshot}
              defaultAmount={form.fee}  // <-- passes the exact plan price picked
              currency="GBP"
              onApplicationCreated={(id) => {
                setApplicationId(id);
                setState('ok');
                setMessage(`تم إنشاء طلبك بنجاح. رقم الطلب: ${id}`);
                resetFormState();
              }}
            />
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-800 px-4 py-3 text-sm">
              لم يتم تمرير PaymentWidget للنموذج. تأكّد من تمريره من الصفحة.
            </div>
          )}
        </section>
      )}
    </form>
  );
}
