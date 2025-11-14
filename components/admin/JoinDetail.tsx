// components/admin/JoinDetail.tsx
'use client';

import * as React from 'react';
import { useRouter } from 'next/router';

// ===== Match JoinForm's models =====
type Audience = 'palestinian' | 'nonPalestinian';
type Tier = 'free' | 'silver' | 'gold' | 'diamond';

const TIERS: Record<Tier, { label: string; monthly: number; note?: string; emoji?: string }> = {
  free:    { label: 'Free',    monthly: 0,      note: 'ابدأ بلا رسوم الآن' },
  silver:  { label: 'Silver',  monthly: 11.99,  note: 'Monthly', emoji: '🥈' },
  gold:    { label: 'Gold',    monthly: 21.99,  note: 'Monthly', emoji: '🥇' },
  diamond: { label: 'Diamond', monthly: 49.99,  note: 'Monthly', emoji: '💎' },
};

// ===== Data types coming from backend =====
export type AppDoc = {
  id: string;

  // person
  firstName?: string;
  lastName?: string;
  fullName?: string;
  dob?: string;

  // father / grandfather (combined + split)
  fatherName?: string | null;
  fatherNameEn?: string | null;
  fatherNameAr?: string | null;

  grandfatherName?: string | null;
  grandfatherNameEn?: string | null;
  grandfatherNameAr?: string | null;

  // contact / address
  phone?: string;
  email?: string;
  address?: string;
  postcode?: string;
  ukCity?: string;

  // origin
  cityOfOriginAr?: string;
  cityOfOrigin?: string;

  // fees (aligned with JoinForm)
  fee?: number;
  feeChoice?: Tier;
  customFeeRaw?: string | null; // kept for compatibility if present

  // photo
  photoUrl?: string | null;
  profilePhotoUrl?: string | null; // legacy fallback
  photoPath?: string | null;

  // status
  status?: string;
  paymentRequired?: boolean;

  // timestamps (ms)
  createdAt?: number | null;
  updatedAt?: number | null;
  lastPaymentAt?: number | null;
  currentPeriodEnd?: number | null;

  // misc
  note?: string | null;

  // audience (optional, from formSnapshot if stored)
  audience?: Audience;
};

export type MemberDoc = {
  id: string;
  applicationId?: string;
  createdAt?: number | null;
  updatedAt?: number | null;
  currentPeriodEnd?: number | null;
  status?: string;
} | null;

export type PaymentDoc = {
  id: string;
  applicationId?: string;
  amount?: number;         // major units (e.g., GBP)
  currency?: string;       // e.g., 'GBP'
  createdAt?: number | null;
  periodStart?: number | null;
  periodEnd?: number | null;
  provider?: string;       // 'card' | 'manual' | 'bank' etc.
  note?: string;
};

type Props = {
  application: AppDoc;
  member: MemberDoc;
  payments: PaymentDoc[];
};

// ===== UI helpers =====
const Section: React.FC<{ title: string; children: React.ReactNode; right?: React.ReactNode }> = ({ title, children, right }) => (
  <section className="rounded-2xl border bg-white p-5 md:p-6 shadow-sm ring-1 ring-black/5">
    <div className="mb-4 flex items-center justify-between gap-3">
      <h3 className="text-lg font-semibold">{title}</h3>
      {right}
    </div>
    {children}
  </section>
);

const Badge: React.FC<{ children: React.ReactNode; color?: 'emerald' | 'amber' | 'red' | 'neutral' | 'blue' }> = ({
  children,
  color = 'neutral',
}) => {
  const map: Record<string, string> = {
    emerald: 'bg-emerald-100 text-emerald-800',
    amber: 'bg-amber-100 text-amber-800',
    red: 'bg-red-100 text-red-800',
    neutral: 'bg-neutral-100 text-neutral-800',
    blue: 'bg-blue-100 text-blue-800',
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[color]}`}>{children}</span>;
};

const LabelVal: React.FC<{ label: string; children?: React.ReactNode; dirAuto?: boolean }> = ({ label, children, dirAuto }) => (
  <div className="space-y-1">
    <div className="text-xs font-medium text-neutral-500">{label}</div>
    <div className="text-sm text-neutral-900" dir={dirAuto ? 'auto' : undefined}>{children ?? '—'}</div>
  </div>
);

const Money: React.FC<{ amount?: number; currency?: string }> = ({ amount, currency }) => {
  if (amount == null) return <>—</>;
  try {
    return <>{new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency || 'GBP' }).format(amount)}</>;
  } catch {
    return <>£{Number(amount).toFixed(2)}</>;
  }
};

const dt = (ms?: number | null) => (ms ? new Date(ms).toLocaleString() : '—');

// ===== Buttons =====
const ActionButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = '', ...props }) => (
  <button
    {...props}
    className={
      'rounded-full px-3 py-2 text-sm font-semibold ring-1 ring-neutral-300 hover:bg-neutral-100 disabled:opacity-60 ' +
      className
    }
  />
);

const PrimaryButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = '', ...props }) => (
  <button
    {...props}
    className={'rounded-full px-3 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 ' + className}
  />
);

const DangerButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = '', ...props }) => (
  <button
    {...props}
    className={'rounded-full px-3 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 ' + className}
  />
);

/** Small inline editable block for admin updates (status, note, parent names) */
function UpdateForm({ app, onSaved }: { app: AppDoc; onSaved: () => void }) {
  const [status, setStatus] = React.useState(app.status || 'submitted');
  const [note, setNote] = React.useState(app.note || '');
  const [fatherName, setFatherName] = React.useState(app.fatherName || '');
  const [grandfatherName, setGrandfatherName] = React.useState(app.grandfatherName || '');
  const [saving, setSaving] = React.useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        status: status || 'submitted',
        note: note ?? '',
        // These combined fields will be split server-side if needed
        fatherName: fatherName || null,
        grandfatherName: grandfatherName || null,
      };
      const r = await fetch('/api/admin/join/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: app.id, update: payload }),
      });
      const j = await r.json();
      if (!r.ok || j?.ok === false) throw new Error(j?.error || 'Update failed');
      onSaved();
    } catch (e: any) {
      alert(e?.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full rounded-xl border border-neutral-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition"
        >
          <option value="submitted">Submitted</option>
          <option value="approved">Approved</option>
          <option value="pending">Pending</option>
          <option value="rejected">Rejected</option>
          <option value="deleted">Deleted</option>
        </select>
      </div>

      <div className="md:col-span-2">
        <label className="block text-xs font-medium text-neutral-600 mb-1">
          Father&apos;s Name / اسم الأب (EN/AR or either)
        </label>
        <input
          type="text"
          value={fatherName}
          onChange={(e) => setFatherName(e.target.value)}
          className="w-full rounded-xl border border-neutral-300 px-3 py-2 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition"
          placeholder="e.g., Ahmed / أحمد"
        />
      </div>

      <div className="md:col-span-2">
        <label className="block text-xs font-medium text-neutral-600 mb-1">
          Grandfather&apos;s Name / اسم الجد (EN/AR or either)
        </label>
        <input
          type="text"
          value={grandfatherName}
          onChange={(e) => setGrandfatherName(e.target.value)}
          className="w-full rounded-xl border border-neutral-300 px-3 py-2 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition"
          placeholder="e.g., Mahmoud / محمود"
        />
      </div>

      <div className="md:col-span-2">
        <label className="block text-xs font-medium text-neutral-600 mb-1">Note</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full rounded-xl border border-neutral-300 px-3 py-2 min-h-[88px] placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition"
          placeholder="Internal admin note…"
        />
      </div>

      <div className="md:col-span-2 flex items-center justify-end gap-2">
        <ActionButton onClick={() => { setStatus(app.status || 'submitted'); setNote(app.note || ''); setFatherName(app.fatherName || ''); setGrandfatherName(app.grandfatherName || ''); }} disabled={saving}>
          Reset
        </ActionButton>
        <PrimaryButton onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save Changes'}
        </PrimaryButton>
      </div>
    </div>
  );
}

/** Small form to mark a payment */
function MarkPaymentForm({ applicationId, onSaved }: { applicationId: string; onSaved: () => void }) {
  const [amount, setAmount] = React.useState<string>('11.99'); // default to Silver plan, no £5
  const [currency, setCurrency] = React.useState('GBP');
  const [provider, setProvider] = React.useState('manual');
  const [periodStart, setPeriodStart] = React.useState<string>('');
  const [periodEnd, setPeriodEnd] = React.useState<string>('');
  const [note, setNote] = React.useState<string>('');
  const [saving, setSaving] = React.useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        applicationId,
        amount: Number(amount),
        currency,
        provider,
        note: note ?? '',
      };
      if (periodStart) (payload as any).periodStart = new Date(periodStart).toISOString();
      if (periodEnd) (payload as any).periodEnd = new Date(periodEnd).toISOString();

      const r = await fetch('/api/admin/join/mark-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok || j?.ok === false) throw new Error(j?.error || 'Payment save failed');
      onSaved();
    } catch (e: any) {
      alert(e?.message || 'Failed to mark payment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Amount</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full rounded-xl border border-neutral-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Currency</label>
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className="w-full rounded-xl border border-neutral-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition"
        >
          <option value="GBP">GBP</option>
          <option value="EUR">EUR</option>
          <option value="USD">USD</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Provider</label>
        <input
          type="text"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="w-full rounded-xl border border-neutral-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition"
          placeholder="Stripe, PayPal, manual…"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Note</label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full rounded-xl border border-neutral-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition"
          placeholder="e.g., first month"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Period start</label>
        <input
          type="datetime-local"
          value={periodStart}
          onChange={(e) => setPeriodStart(e.target.value)}
          className="w-full rounded-xl border border-neutral-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Period end</label>
        <input
          type="datetime-local"
          value={periodEnd}
          onChange={(e) => setPeriodEnd(e.target.value)}
          className="w-full rounded-xl border border-neutral-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition"
        />
      </div>

      <div className="md:col-span-2 flex items-center justify-end gap-2">
        <ActionButton
          onClick={() => {
            setAmount('11.99');
            setCurrency('GBP');
            setProvider('manual');
            setPeriodStart('');
            setPeriodEnd('');
            setNote('');
          }}
          disabled={saving}
        >
          Reset
        </ActionButton>
        <PrimaryButton onClick={save} disabled={saving || !amount}>
          {saving ? 'Saving…' : 'Mark Payment'}
        </PrimaryButton>
      </div>
    </div>
  );
}

export default function JoinDetail({ application, member, payments }: Props) {
  const router = useRouter();

  const status = (application.status || 'submitted').toLowerCase();
  const statusColor: 'blue' | 'emerald' | 'amber' | 'red' | 'neutral' =
    status.includes('active') || status.includes('approved')
      ? 'emerald'
      : status.includes('pending') || status.includes('submitted')
      ? 'blue'
      : status.includes('failed') || status.includes('rejected')
      ? 'red'
      : status.includes('deleted')
      ? 'amber'
      : 'neutral';

  const lastPayment = payments[0] || null;
  const totalPaid = payments.reduce((sum, p) => sum + (typeof p.amount === 'number' ? p.amount : 0), 0);
  const name = application.fullName || `${application.firstName ?? ''} ${application.lastName ?? ''}`.trim();

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(application.id);
      alert('Copied Application ID');
    } catch {
      alert('Failed to copy');
    }
  };

  const refresh = () => router.replace(router.asPath);

  const approve = async () => {
    if (!confirm('Approve and create / activate member?')) return;
    try {
      const r = await fetch('/api/admin/join/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: application.id }),
      });
      const j = await r.json();
      if (!r.ok || j?.ok === false) throw new Error(j?.error || 'Approve failed');
      refresh();
    } catch (e: any) {
      alert(e?.message || 'Failed to approve');
    }
  };

  const softDelete = async () => {
    if (!confirm('Soft delete this application?')) return;
    try {
      const r = await fetch('/api/admin/join/soft-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: application.id }),
      });
      const j = await r.json();
      if (!r.ok || j?.ok === false) throw new Error(j?.error || 'Soft delete failed');
      refresh();
    } catch (e: any) {
      alert(e?.message || 'Failed to soft delete');
    }
  };

  const hardDelete = async () => {
    if (!confirm('Hard delete this application, its payments and photo? This cannot be undone.')) return;
    try {
      const r = await fetch('/api/admin/join/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: application.id, hard: true }),
      });
      const j = await r.json();
      if (!r.ok || j?.ok === false) throw new Error(j?.error || 'Delete failed');
      router.replace('/auth/admin/join?deleted=1');
    } catch (e: any) {
      alert(e?.message || 'Failed to delete');
    }
  };

  const avatarUrl = application.photoUrl || application.profilePhotoUrl || null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-r from-emerald-50 to-white p-5 md:p-6 ring-1 ring-black/5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-white ring-1 ring-black/5 overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt="avatar" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full grid place-items-center text-neutral-400 text-[11px]">No Photo</div>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{name || '—'}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-neutral-600">
                <Badge color={statusColor}>{application.status || 'submitted'}</Badge>
                <span className="text-neutral-400">•</span>
                <span>ID:</span>
                <code className="rounded-md bg-white/60 px-1.5 py-0.5 ring-1 ring-black/5">{application.id}</code>
                <button
                  onClick={copyId}
                  className="rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-neutral-300 bg-white hover:bg-neutral-50"
                >
                  Copy
                </button>
                {avatarUrl && (
                  <>
                    <span className="text-neutral-400">•</span>
                    <a
                      href={avatarUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-neutral-300 bg-white hover:bg-neutral-50"
                    >
                      Open Photo
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <PrimaryButton onClick={approve}>Approve</PrimaryButton>
            <ActionButton onClick={softDelete}>Soft Delete</ActionButton>
            <DangerButton onClick={hardDelete}>Hard Delete</DangerButton>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          <Section title="Personal">
            <div className="grid sm:grid-cols-2 gap-4">
              <LabelVal label="Full Name">{name || '—'}</LabelVal>
              <LabelVal label="Date of Birth">{application.dob || '—'}</LabelVal>

              <LabelVal label="Father's Name (Combined) / اسم الأب">{application.fatherName || '—'}</LabelVal>
              <LabelVal label="Father (Split EN/AR)">
                {application.fatherNameEn || application.fatherNameAr ? (
                  <span>
                    {application.fatherNameEn ?? ''}
                    {application.fatherNameEn && application.fatherNameAr ? ' / ' : ''}
                    {application.fatherNameAr ?? ''}
                  </span>
                ) : (
                  '—'
                )}
              </LabelVal>

              <LabelVal label="Grandfather's Name (Combined) / اسم الجد">{application.grandfatherName || '—'}</LabelVal>
              <LabelVal label="Grandfather (Split EN/AR)">
                {application.grandfatherNameEn || application.grandfatherNameAr ? (
                  <span>
                    {application.grandfatherNameEn ?? ''}
                    {application.grandfatherNameEn && application.grandfatherNameAr ? ' / ' : ''}
                    {application.grandfatherNameAr ?? ''}
                  </span>
                ) : (
                  '—'
                )}
              </LabelVal>
            </div>
          </Section>

          <Section title="Contact & Address">
            <div className="grid sm:grid-cols-2 gap-4">
              <LabelVal label="Email">{application.email || '—'}</LabelVal>
              <LabelVal label="Phone">{application.phone || '—'}</LabelVal>
              <LabelVal label="Address">{application.address || '—'}</LabelVal>
              <LabelVal label="Postcode">{application.postcode || '—'}</LabelVal>
              <LabelVal label="City (UK)">{application.ukCity || '—'}</LabelVal>
              <LabelVal label="Origin (AR)" dirAuto>{application.cityOfOriginAr || '—'}</LabelVal>
            </div>
          </Section>

          <Section
            title="Fees & Plan"
            right={
              <div className="text-xs text-neutral-600">
                Total Paid: <strong><Money amount={totalPaid} currency={payments[0]?.currency || 'GBP'} /></strong>
              </div>
            }
          >
            <div className="grid sm:grid-cols-3 gap-4">
              <LabelVal label="Selected Plan">
                {application.feeChoice ? (
                  <span className="inline-flex items-center gap-1">
                    {TIERS[application.feeChoice]?.emoji && <span aria-hidden>{TIERS[application.feeChoice].emoji}</span>}
                    <span>{TIERS[application.feeChoice]?.label || application.feeChoice}</span>
                  </span>
                ) : (
                  '—'
                )}
              </LabelVal>
              <LabelVal label="Monthly Fee">
                <Money amount={application.fee ?? (application.feeChoice ? TIERS[application.feeChoice].monthly : 0)} currency="GBP" />
              </LabelVal>
              <LabelVal label="Plan Note">
                {application.feeChoice ? (TIERS[application.feeChoice]?.note || '—') : '—'}
              </LabelVal>
            </div>

            <div className="mt-4">
              <LabelVal label="Application Note">
                {application.note ? <span className="whitespace-pre-wrap">{application.note}</span> : '—'}
              </LabelVal>
            </div>

            <div className="mt-4">
              <LabelVal label="Audience">
                {application.audience === 'palestinian'
                  ? 'Palestinian'
                  : application.audience === 'nonPalestinian'
                  ? 'Non-Palestinian Friend'
                  : '—'}
              </LabelVal>
            </div>
          </Section>

          <Section title="Edit / Update">
            <UpdateForm app={application} onSaved={refresh} />
          </Section>

          <Section title="Timestamps" right={<div className="text-xs text-neutral-500">All times are local.</div>}>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <LabelVal label="Created">{dt(application.createdAt)}</LabelVal>
              <LabelVal label="Updated">{dt(application.updatedAt)}</LabelVal>
              <LabelVal label="Last Payment At">{dt(application.lastPaymentAt)}</LabelVal>
              <LabelVal label="Current Period End">{dt(application.currentPeriodEnd)}</LabelVal>
            </div>
          </Section>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <Section title="Member">
            {member ? (
              <div className="grid gap-3">
                <LabelVal label="Member ID">{member.id}</LabelVal>
                <LabelVal label="Status">{member.status || '—'}</LabelVal>
                <LabelVal label="Created">{dt(member.createdAt)}</LabelVal>
                <LabelVal label="Updated">{dt(member.updatedAt)}</LabelVal>
                <LabelVal label="Current Period End">{dt(member.currentPeriodEnd)}</LabelVal>
              </div>
            ) : (
              <div className="text-sm text-neutral-600">No member record linked to this application.</div>
            )}
          </Section>

          <Section title="Mark Payment">
            <MarkPaymentForm applicationId={application.id} onSaved={refresh} />
          </Section>

          <Section title="Latest Payment">
            {payments.length ? (
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    <Money amount={lastPayment?.amount} currency={lastPayment?.currency || 'GBP'} />
                  </div>
                  <Badge color="emerald">{lastPayment?.provider || 'Payment'}</Badge>
                </div>
                <div className="text-xs text-neutral-600">
                  {dt(lastPayment?.createdAt)}
                  {lastPayment?.periodStart || lastPayment?.periodEnd ? (
                    <div>Period: {dt(lastPayment?.periodStart)} → {dt(lastPayment?.periodEnd)}</div>
                  ) : null}
                </div>
                {lastPayment?.note && <div className="text-xs text-neutral-600 whitespace-pre-wrap">Note: {lastPayment.note}</div>}
              </div>
            ) : (
              <div className="text-sm text-neutral-600">No payments yet.</div>
            )}
          </Section>

          <Section title="All Payments">
            {payments.length ? (
              <div className="flow-root">
                <ul role="list" className="-my-2 divide-y divide-neutral-100">
                  {payments.map((p) => (
                    <li key={p.id} className="py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium">
                            <Money amount={p.amount} currency={p.currency || 'GBP'} />
                          </div>
                          <div className="text-xs text-neutral-600">{dt(p.createdAt)}</div>
                          {p.note && <div className="text-xs text-neutral-600 whitespace-pre-wrap mt-1">{p.note}</div>}
                        </div>
                        <div className="text-xs text-neutral-500 text-right">
                          {p.provider || '—'}
                          {(p.periodStart || p.periodEnd) && (
                            <div className="mt-1">
                              {dt(p.periodStart)} → {dt(p.periodEnd)}
                            </div>
                          )}
                          <div className="mt-1 text-[11px] text-neutral-400">#{p.id}</div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="text-sm text-neutral-600">—</div>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
