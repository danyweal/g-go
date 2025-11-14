// pages/auth/admin/join/[applicationId].tsx
import Head from 'next/head';
import type { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { useMemo, useState } from 'react';
import useAdminGuard from '@/utils/useAdminGuard';

/* ----------------------------- Tiers (match JoinForm) ----------------------------- */
type Tier = 'free' | 'silver' | 'gold' | 'diamond';

const TIERS: Record<Tier, { label: string; monthly: number; emoji?: string }> = {
  free:    { label: 'Free',    monthly: 0 },
  silver:  { label: 'Silver',  monthly: 11.99, emoji: '🥈' },
  gold:    { label: 'Gold',    monthly: 21.99, emoji: '🥇' },
  diamond: { label: 'Diamond', monthly: 49.99, emoji: '💎' },
};

const isTierKey = (v: unknown): v is Tier =>
  v === 'free' || v === 'silver' || v === 'gold' || v === 'diamond';

type Status =
  | 'submitted'
  | 'approved'
  | 'pending'
  | 'rejected'
  | 'deleted';

type PageProps = {
  app: any | null;
  member: any | null;
  payments: any[];
};

const toMillis = (x: any) => (x?.toMillis ? x.toMillis() : x ?? null);

/* ------------------------------------ Page ------------------------------------ */
export default function AdminJoinDetail({ app, member, payments }: PageProps) {
  const { ready } = useAdminGuard();
  const router = useRouter();

  // ---- Local UI state (always declare hooks at the top; don't early-return) ----
  const [status, setStatus] = useState<Status>((app?.status as Status) || 'submitted');
  const [note, setNote] = useState<string>(app?.note || '');
  const [busy, setBusy] = useState<'idle' | 'saving' | 'deleting' | 'approving'>('idle');

  const hasPhoto = !!(app?.photoUrl || app?.profilePhotoUrl);
  const photoUrl = app?.photoUrl || app?.profilePhotoUrl || '';

  const fatherName = app?.fatherName || '';
  const fatherNameEn = app?.fatherNameEn || '';
  const fatherNameAr = app?.fatherNameAr || '';
  const grandName = app?.grandfatherName || '';
  const grandNameEn = app?.grandfatherNameEn || '';
  const grandNameAr = app?.grandfatherNameAr || '';

  const fullName =
    app?.fullName ||
    `${app?.firstName || ''} ${app?.lastName || ''}`.trim();

  const createdAt = app?.createdAt ? new Date(app.createdAt) : null;
  const updatedAt = app?.updatedAt ? new Date(app.updatedAt) : null;

  // Latest payment
  const lastPay = useMemo(() => {
    if (!payments?.length) return null;
    return [...payments].sort(
      (a, b) => Number(b?.createdAt ?? 0) - Number(a?.createdAt ?? 0)
    )[0];
  }, [payments]);

  // ---- Resolve plan safely (handles legacy values) ----
  const feeChoiceRaw = app?.feeChoice as unknown;
  const planCfg = isTierKey(feeChoiceRaw) ? TIERS[feeChoiceRaw] : undefined;
  const monthlyFee: number =
    typeof app?.fee === 'number'
      ? app.fee
      : planCfg?.monthly ?? 0;

  const planDisplay: string = planCfg
    ? `${planCfg.label} (£${planCfg.monthly.toFixed(2)})`
    : (typeof app?.fee === 'number'
        ? (app.fee > 0 ? `Custom (£${app.fee.toFixed(2)})` : 'Free')
        : '—');

  // ---- Actions ----
  const saveUpdate = async () => {
    try {
      setBusy('saving');
      const r = await fetch('/api/admin/join/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: app.id,
          update: { status, note },
        }),
      });
      const j = await r.json();
      if (!r.ok || j?.ok === false) throw new Error(j?.error || 'Update failed');
      alert('Saved ✓');
      router.replace(router.asPath);
    } catch (e: any) {
      alert(e?.message || 'Failed to save');
    } finally {
      setBusy('idle');
    }
  };

  const approveNow = async () => {
    try {
      if (!confirm('Approve this application?')) return;
      setBusy('approving');
      const r = await fetch('/api/admin/join/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: app.id }),
      });
      const j = await r.json();
      if (!r.ok || j?.ok === false) throw new Error(j?.error || 'Approve failed');
      alert('Approved ✓');
      router.replace(router.asPath);
    } catch (e: any) {
      alert(e?.message || 'Failed to approve');
    } finally {
      setBusy('idle');
    }
  };

  const softDelete = async () => {
    try {
      if (!confirm('Soft delete this application?')) return;
      setBusy('deleting');
      const r = await fetch('/api/admin/join/soft-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: app.id }),
      });
      const j = await r.json();
      if (!r.ok || j?.ok === false) throw new Error(j?.error || 'Soft delete failed');
      alert('Soft deleted ✓');
      router.replace(router.asPath);
    } catch (e: any) {
      alert(e?.message || 'Failed to soft delete');
    } finally {
      setBusy('idle');
    }
  };

  const restore = async () => {
    try {
      if (!confirm('Restore this application?')) return;
      setBusy('saving');
      const r = await fetch('/api/admin/join/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: app.id }),
      });
      const j = await r.json();
      if (!r.ok || j?.ok === false) throw new Error(j?.error || 'Restore failed');
      alert('Restored ✓');
      router.replace(router.asPath);
    } catch (e: any) {
      alert(e?.message || 'Failed to restore');
    } finally {
      setBusy('idle');
    }
  };

  const hardDelete = async () => {
    try {
      if (!confirm('HARD delete this application? This cannot be undone.')) return;
      setBusy('deleting');
      const r = await fetch('/api/admin/join/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: app.id, hard: true }),
      });
      const j = await r.json();
      if (!r.ok || j?.ok === false) throw new Error(j?.error || 'Delete failed');
      alert('Hard deleted ✓');
      router.push('/auth/admin/join?deleted=1');
    } catch (e: any) {
      alert(e?.message || 'Failed to delete');
    } finally {
      setBusy('idle');
    }
  };

  // ---- Skeleton while loading guard ----
  if (!ready) {
    return (
      <>
        <Head><title>Application • Admin</title></Head>
        <div className="p-8">
          <div className="mx-auto max-w-5xl space-y-4">
            <div className="h-10 w-64 animate-pulse rounded bg-neutral-200" />
            <div className="rounded-2xl border bg-white p-6 shadow-sm ring-1 ring-black/5">
              <div className="h-48 w-full animate-pulse rounded-xl bg-neutral-100" />
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!app) {
    return (
      <>
        <Head><title>Application Not Found • Admin</title></Head>
        <div className="p-6">
          <div className="mx-auto max-w-3xl rounded-2xl border bg-white p-6 shadow-sm ring-1 ring-black/5">
            <div className="text-lg font-semibold">Application not found</div>
            <p className="mt-1 text-sm text-neutral-600">
              The requested application does not exist. It may have been deleted.
            </p>
            <div className="mt-4">
              <button
                onClick={() => router.push('/auth/admin/join')}
                className="rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-neutral-300 hover:bg-neutral-100"
              >
                Back to list
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head><title>{fullName || 'Application'} • Admin</title></Head>

      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-50 via-white to-emerald-50" />
        <div className="relative px-6 py-6 md:px-8 md:py-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{fullName || '—'}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-600">
                <StatusChip value={app?.status} />
                {createdAt && <span>• Created: {createdAt.toLocaleString()}</span>}
                {updatedAt && <span>• Updated: {updatedAt.toLocaleString()}</span>}
                {member?.id && <span>• Member linked</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push('/auth/admin/join')}
                className="rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-neutral-300 bg-white hover:bg-neutral-100"
              >
                Back to list
              </button>
              <button
                onClick={() => navigator.clipboard.writeText(app.id)}
                className="rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-neutral-300 bg-white hover:bg-neutral-100"
                title="Copy Application ID"
              >
                Copy ID
              </button>
              {app?.email && (
                <a
                  href={`mailto:${encodeURIComponent(app.email)}?subject=Your%20Membership%20Application`}
                  className="rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-neutral-300 bg-white hover:bg-neutral-100"
                >
                  Email
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-5 max-w-6xl mx-auto">
        {/* Overview */}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-2xl border bg-white p-5 shadow-sm ring-1 ring-black/5">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-neutral-700">Applicant</div>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
              <div className="w-full md:w-44">
                <div className="aspect-square overflow-hidden rounded-xl border bg-neutral-50">
                  {hasPhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoUrl} alt="Profile photo" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-neutral-400 text-sm">
                      No photo
                    </div>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {hasPhoto && (
                    <a
                      href={photoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full px-3 py-1.5 text-xs text-center font-semibold ring-1 ring-neutral-300 hover:bg-neutral-100"
                    >
                      Open Photo
                    </a>
                  )}
                  <button
                    onClick={() => navigator.clipboard.writeText(photoUrl || '')}
                    className="rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-neutral-300 hover:bg-neutral-100 disabled:opacity-60"
                    disabled={!hasPhoto}
                  >
                    Copy URL
                  </button>
                </div>
              </div>

              <div className="flex-1 grid sm:grid-cols-2 gap-3">
                <Field label="Application ID">{app.id}</Field>
                <Field label="Status"><StatusChip value={app?.status} /></Field>

                <Field label="First Name">{app?.firstName || '—'}</Field>
                <Field label="Last Name">{app?.lastName || '—'}</Field>

                <Field label="Father’s Name (combined)">{fatherName || '—'}</Field>
                <Field label="Father’s Name (EN / AR)">
                  {(fatherNameEn || fatherNameAr) ? `${fatherNameEn || '—'} / ${fatherNameAr || '—'}` : '—'}
                </Field>

                <Field label="Grandfather’s Name (combined)">{grandName || '—'}</Field>
                <Field label="Grandfather’s Name (EN / AR)">
                  {(grandNameEn || grandNameAr) ? `${grandNameEn || '—'} / ${grandNameAr || '—'}` : '—'}
                </Field>

                <Field label="Date of Birth">{app?.dob || '—'}</Field>
                <Field label="Phone">{app?.phone || '—'}</Field>
                <Field label="Email">{app?.email || '—'}</Field>

                <Field label="UK Address">
                  {(app?.address || '—')}{app?.postcode ? `, ${app.postcode}` : ''}{app?.ukCity ? `, ${app.ukCity}` : ''}
                </Field>
                <Field label="Palestinian Origin (AR)">{app?.cityOfOriginAr || '—'}</Field>

                <Field label="Note">{app?.note || '—'}</Field>
              </div>
            </div>
          </div>

          {/* Admin actions */}
          <div className="rounded-2xl border bg-white p-5 shadow-sm ring-1 ring-black/5">
            <div className="text-sm font-semibold text-neutral-700 mb-3">Admin Actions</div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as Status)}
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition"
                >
                  <option value="submitted">Submitted</option>
                  <option value="approved">Approved</option>
                  <option value="pending">Pending</option>
                  <option value="rejected">Rejected</option>
                  <option value="deleted">Deleted</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Note</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Internal note…"
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={saveUpdate}
                  disabled={busy !== 'idle'}
                  className="rounded-full px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60"
                >
                  {busy === 'saving' ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={approveNow}
                  disabled={busy !== 'idle'}
                  className="rounded-full px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60"
                >
                  {busy === 'approving' ? 'Approving…' : 'Approve'}
                </button>
                {app?.status === 'deleted' ? (
                  <button
                    onClick={restore}
                    disabled={busy !== 'idle'}
                    className="rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-neutral-300 hover:bg-neutral-100 disabled:opacity-60"
                  >
                    Restore
                  </button>
                ) : (
                  <button
                    onClick={softDelete}
                    disabled={busy !== 'idle'}
                    className="rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-neutral-300 hover:bg-neutral-100 disabled:opacity-60"
                  >
                    Soft Delete
                  </button>
                )}
                <button
                  onClick={hardDelete}
                  disabled={busy !== 'idle'}
                  className="rounded-full px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60"
                >
                  {busy === 'deleting' ? 'Deleting…' : 'Hard Delete'}
                </button>
              </div>

              <div className="mt-2 text-[11px] text-neutral-500">
                Approve will mark as <span className="font-semibold">approved</span>. Soft Delete marks status as{' '}
                <span className="font-semibold">deleted</span> but keeps the record. Hard Delete removes it permanently.
              </div>
            </div>
          </div>
        </div>

        {/* Billing / Payments */}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border bg-white p-5 shadow-sm ring-1 ring-black/5">
            <div className="mb-3 text-sm font-semibold text-neutral-700">Membership & Billing</div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Plan (Fee Choice)">{planDisplay}</Field>
              <Field label="Monthly Fee">
                {new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(Number(monthlyFee || 0))}
              </Field>
              <Field label="Payment Confirmed">{app?.paymentConfirmed ? 'Yes' : 'No'}</Field>
              <Field label="Last Payment">
                {lastPay
                  ? `${new Intl.NumberFormat(undefined, {
                      style: 'currency',
                      currency: (lastPay.currency || 'GBP').toUpperCase(),
                    }).format(Number(lastPay.amount || 0))} • ${new Date(lastPay.createdAt).toLocaleString()}`
                  : '—'}
              </Field>
            </div>
          </div>

          <div className="lg:col-span-2 rounded-2xl border bg-white p-5 shadow-sm ring-1 ring-black/5">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-neutral-700">Payments</div>
            </div>

            {payments?.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-neutral-500">
                      <th className="py-2 pr-3">ID</th>
                      <th className="py-2 pr-3">Amount</th>
                      <th className="py-2 pr-3">Currency</th>
                      <th className="py-2 pr-3">Provider</th>
                      <th className="py-2 pr-3">Created</th>
                      <th className="py-2 pr-3">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <td className="py-2 pr-3 font-mono text-xs">{p.id}</td>
                        <td className="py-2 pr-3">
                          {new Intl.NumberFormat(undefined, {
                            style: 'currency',
                            currency: (p.currency || 'GBP').toUpperCase(),
                          }).format(Number(p.amount || 0))}
                        </td>
                        <td className="py-2 pr-3">{(p.currency || 'GBP').toUpperCase()}</td>
                        <td className="py-2 pr-3">{p.provider || '—'}</td>
                        <td className="py-2 pr-3">{p.createdAt ? new Date(p.createdAt).toLocaleString() : '—'}</td>
                        <td className="py-2 pr-3">{p.note || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-sm text-neutral-600">No payments found.</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/** Small label/value pair */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="text-sm font-medium text-neutral-900">{children}</div>
    </div>
  );
}

/** Status badge */
function StatusChip({ value }: { value?: string }) {
  const v = (value || '').toLowerCase();
  const map: Record<string, string> = {
    approved: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
    submitted: 'bg-blue-100 text-blue-800 ring-blue-200',
    pending: 'bg-amber-100 text-amber-800 ring-amber-200',
    rejected: 'bg-rose-100 text-rose-800 ring-rose-200',
    deleted: 'bg-neutral-100 text-neutral-800 ring-neutral-200',
  };
  const cls = map[v] || 'bg-neutral-100 text-neutral-800 ring-neutral-200';
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${cls}`}>
      {value || '—'}
    </span>
  );
}

/* --------------------------------- GSSP --------------------------------- */
export const getServerSideProps: GetServerSideProps<PageProps> = async (ctx) => {
  const { adminDb } = await import('@/lib/firebaseAdmin');
  const applicationId = String(ctx.query.applicationId || '');

  if (!applicationId) {
    return { props: { app: null, member: null, payments: [] } };
  }

  // App
  const appDoc = await adminDb.collection('joinApplications').doc(applicationId).get();
  const appData = appDoc.exists ? appDoc.data() : null;

  const app = appData
    ? {
        id: appDoc.id,
        ...appData,
        createdAt: toMillis(appData?.createdAt),
        updatedAt: toMillis(appData?.updatedAt),
        lastPaymentAt: toMillis(appData?.lastPaymentAt),
        currentPeriodEnd: toMillis(appData?.currentPeriodEnd),
      }
    : null;

  // Member (by applicationId)
  const memberSnap = await adminDb
    .collection('members')
    .where('applicationId', '==', applicationId)
    .limit(1)
    .get();
  const member = memberSnap.docs[0]
    ? {
        id: memberSnap.docs[0].id,
        ...memberSnap.docs[0].data(),
        createdAt: toMillis(memberSnap.docs[0].data()?.createdAt),
        updatedAt: toMillis(memberSnap.docs[0].data()?.updatedAt),
      }
    : null;

  // Payments (by applicationId, with index fallback)
  let paymentsDocs: any[] = [];
  try {
    const ps = await adminDb
      .collection('payments')
      .where('applicationId', '==', applicationId)
      .orderBy('createdAt', 'desc')
      .limit(200)
      .get();
    paymentsDocs = ps.docs;
  } catch (e: any) {
    // Fallback: no index → fetch a chunk and filter client side
    const ps = await adminDb.collection('payments').limit(2000).get();
    paymentsDocs = ps.docs
      .filter((d) => (d.data()?.applicationId || '') === applicationId)
      .sort((a, b) => {
        const aTs = toMillis(a.data()?.createdAt) || 0;
        const bTs = toMillis(b.data()?.createdAt) || 0;
        return bTs - aTs;
      });
  }

  const payments = paymentsDocs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      createdAt: toMillis(data?.createdAt),
      periodStart: toMillis(data?.periodStart),
      periodEnd: toMillis(data?.periodEnd),
    };
  });

  return { props: { app, member, payments } };
};
