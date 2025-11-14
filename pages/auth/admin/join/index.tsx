// pages/auth/admin/join/index.tsx
import Head from 'next/head';
import type { GetServerSideProps } from 'next';
import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import useAdminGuard from '@/utils/useAdminGuard';

// Client table (shows avatar from JoinForm via app.photoUrl)
const JoinTable = dynamic(() => import('@/components/admin/JoinTable'), { ssr: false });

type Row = {
  app: any;            // shape from Firestore (joinApplications)
  member?: any | null; // linked member doc (if any)
  lastPay?: any | null;// last payment for this application (if any)
};

type Props = { rows: Row[]; justDeleted?: boolean };

const toMillis = (x: any) => (x?.toMillis ? x.toMillis() : x ?? null);

// ---- Filters / UI enums aligned with your current tiers ----
type StatusFilter = 'all' | 'approved' | 'submitted' | 'pending' | 'deleted' | 'rejected';
type Ternary = 'any' | 'yes' | 'no';
type FeeChoiceFilter = 'any' | 'free' | 'silver' | 'gold' | 'diamond';
type SortBy =
  | 'created_desc'
  | 'created_asc'
  | 'name_asc'
  | 'name_desc'
  | 'fee_desc'
  | 'fee_asc'
  | 'status_asc'
  | 'status_desc';

export default function AdminJoinIndex({ rows, justDeleted }: Props) {
  const { ready } = useAdminGuard();
  const router = useRouter();

  // ---- UI state (hooks must always run; don't early return before hooks) ----
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [hasPhoto, setHasPhoto] = useState<Ternary>('any');
  const [hasPayment, setHasPayment] = useState<Ternary>('any');
  const [feeChoiceFilter, setFeeChoiceFilter] = useState<FeeChoiceFilter>('any');
  const [minFee, setMinFee] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>(''); // YYYY-MM-DD
  const [dateTo, setDateTo] = useState<string>('');     // YYYY-MM-DD
  const [sortBy, setSortBy] = useState<SortBy>('created_desc');

  // Quick Actions panel
  const [qaOpen, setQaOpen] = useState(false);
  const [quickId, setQuickId] = useState('');
  const [quickStatus, setQuickStatus] = useState<'submitted' | 'approved' | 'pending' | 'rejected' | 'deleted'>('submitted');
  const [quickNote, setQuickNote] = useState('');

  // ---- Quick Delete (hard) ----
  const onQuickDelete = async () => {
    const id = prompt('اكتب Application ID للحذف النهائي:');
    if (!id) return;
    const sure = confirm(`سيتم حذف العضو ${id} نهائيًا — هل أنت متأكد؟`);
    if (!sure) return;
    try {
      const r = await fetch('/api/admin/join/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: id, hard: true }),
      });
      const j = await r.json();
      if (!r.ok || j?.ok === false) throw new Error(j?.error || 'Delete failed');
      router.replace('/auth/admin/join?deleted=1');
    } catch (e: any) {
      alert(e?.message || 'Failed to delete');
    }
  };

  // ---- Quick Actions helpers ----
  const openById = () => {
    const id = quickId.trim();
    if (!id) return;
    router.push(`/auth/admin/join/${encodeURIComponent(id)}`);
  };

  const qaApprove = async () => {
    const id = quickId.trim();
    if (!id) return alert('Enter Application ID');
    if (!confirm(`Approve application ${id}?`)) return;
    try {
      const r = await fetch('/api/admin/join/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: id }),
      });
      const j = await r.json();
      if (!r.ok || j?.ok === false) throw new Error(j?.error || 'Approve failed');
      alert('Approved ✓');
      router.replace(router.asPath);
    } catch (e: any) {
      alert(e?.message || 'Failed to approve');
    }
  };

  const qaSoftDelete = async () => {
    const id = quickId.trim();
    if (!id) return alert('Enter Application ID');
    if (!confirm(`Soft-delete application ${id}?`)) return;
    try {
      const r = await fetch('/api/admin/join/soft-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: id }),
      });
      const j = await r.json();
      if (!r.ok || j?.ok === false) throw new Error(j?.error || 'Soft delete failed');
      alert('Soft deleted ✓');
      router.replace(router.asPath);
    } catch (e: any) {
      alert(e?.message || 'Failed to soft delete');
    }
  };

  const qaHardDelete = async () => {
    const id = quickId.trim();
    if (!id) return alert('Enter Application ID');
    if (!confirm(`HARD delete application ${id}? This cannot be undone.`)) return;
    try {
      const r = await fetch('/api/admin/join/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: id, hard: true }),
      });
      const j = await r.json();
      if (!r.ok || j?.ok === false) throw new Error(j?.error || 'Delete failed');
      alert('Hard deleted ✓');
      router.replace('/auth/admin/join?deleted=1');
    } catch (e: any) {
      alert(e?.message || 'Failed to delete');
    }
  };

  const qaUpdate = async () => {
    const id = quickId.trim();
    if (!id) return alert('Enter Application ID');
    try {
      const r = await fetch('/api/admin/join/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: id,
          update: { status: quickStatus, note: quickNote ?? '' },
        }),
      });
      const j = await r.json();
      if (!r.ok || j?.ok === false) throw new Error(j?.error || 'Update failed');
      alert('Updated ✓');
      router.replace(router.asPath);
    } catch (e: any) {
      alert(e?.message || 'Failed to update');
    }
  };

  const resetFilters = () => {
    setQuery('');
    setStatus('all');
    setHasPhoto('any');
    setHasPayment('any');
    setFeeChoiceFilter('any');
    setMinFee('');
    setDateFrom('');
    setDateTo('');
    setSortBy('created_desc');
  };

  // ---- Filters ----
  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const fromMs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toMs = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;
    const minFeeNum = minFee ? Number(minFee) : null;

    return rows.filter(({ app, lastPay }) => {
      // status
      if (status !== 'all') {
        const s = (app?.status || '').toString().toLowerCase();
        if (!s.includes(status)) return false;
      }
      // photo
      if (hasPhoto !== 'any') {
        const present = !!(app?.photoUrl || app?.profilePhotoUrl);
        if (hasPhoto === 'yes' && !present) return false;
        if (hasPhoto === 'no' && present) return false;
      }
      // payment presence
      if (hasPayment !== 'any') {
        const present = !!lastPay;
        if (hasPayment === 'yes' && !present) return false;
        if (hasPayment === 'no' && present) return false;
      }
      // fee choice filter (free | silver | gold | diamond)
      if (feeChoiceFilter !== 'any') {
        if ((app?.feeChoice || '') !== feeChoiceFilter) return false;
      }
      // min fee
      if (minFeeNum != null && Number(app?.fee ?? 0) < minFeeNum) return false;
      // date range (createdAt as ms)
      const created = app?.createdAt ?? null;
      if (fromMs && (!created || created < fromMs)) return false;
      if (toMs && (!created || created > toMs)) return false;

      if (!q) return true;

      // search text
      const fullName = (app?.fullName || `${app?.firstName || ''} ${app?.lastName || ''}`).toLowerCase();
      const email = (app?.email || '').toLowerCase();
      const phone = (app?.phone || '').toLowerCase();
      const postcode = (app?.postcode || '').toLowerCase();
      const ukCity = (app?.ukCity || '').toLowerCase();
      const originAr = (app?.cityOfOriginAr || '').toLowerCase();
      const father = (app?.fatherName || '').toLowerCase();
      const grandfather = (app?.grandfatherName || '').toLowerCase();
      const id = (app?.id || '').toLowerCase();

      return (
        fullName.includes(q) ||
        email.includes(q) ||
        phone.includes(q) ||
        postcode.includes(q) ||
        ukCity.includes(q) ||
        originAr.includes(q) ||
        father.includes(q) ||
        grandfather.includes(q) ||
        id.includes(q)
      );
    });
  }, [rows, query, status, hasPhoto, hasPayment, feeChoiceFilter, minFee, dateFrom, dateTo]);

  // ---- Sorting ----
  const sortedRows = useMemo(() => {
    const arr = [...filteredRows];
    const nameOf = (r: Row) => (r.app?.fullName || `${r.app?.firstName || ''} ${r.app?.lastName || ''}`).trim().toLowerCase();
    const feeOf = (r: Row) => Number(r.app?.fee ?? 0);
    const statusOf = (r: Row) => (r.app?.status || '').toString().toLowerCase();
    const createdOf = (r: Row) => Number(r.app?.createdAt ?? 0);

    switch (sortBy) {
      case 'name_asc':
        arr.sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
        break;
      case 'name_desc':
        arr.sort((a, b) => nameOf(b).localeCompare(nameOf(a)));
        break;
      case 'fee_asc':
        arr.sort((a, b) => feeOf(a) - feeOf(b));
        break;
      case 'fee_desc':
        arr.sort((a, b) => feeOf(b) - feeOf(a));
        break;
      case 'status_asc':
        arr.sort((a, b) => statusOf(a).localeCompare(statusOf(b)));
        break;
      case 'status_desc':
        arr.sort((a, b) => statusOf(b).localeCompare(statusOf(a)));
        break;
      case 'created_asc':
        arr.sort((a, b) => createdOf(a) - createdOf(b));
        break;
      case 'created_desc':
      default:
        arr.sort((a, b) => createdOf(b) - createdOf(a));
        break;
    }
    return arr;
  }, [filteredRows, sortBy]);

  // ---- Stats ----
  const stats = useMemo(() => {
    const total = rows.length;
    const withPhoto = rows.filter((r) => r.app?.photoUrl || r.app?.profilePhotoUrl).length;
    const approved = rows.filter((r) => (r.app?.status || '').toLowerCase().includes('approved')).length;
    const submitted = rows.filter((r) => (r.app?.status || '').toLowerCase().includes('submitted')).length;
    const deleted = rows.filter((r) => (r.app?.status || '').toLowerCase().includes('deleted')).length;
    const paying = rows.filter((r) => r.lastPay).length;

    // Sum latest payment amounts by currency
    const payTotals: Record<string, number> = {};
    rows.forEach((r) => {
      if (!r.lastPay) return;
      const cur = (r.lastPay.currency || 'GBP').toUpperCase();
      payTotals[cur] = (payTotals[cur] ?? 0) + Number(r.lastPay.amount ?? 0);
    });

    return { total, withPhoto, approved, submitted, deleted, paying, payTotals };
  }, [rows]);

  // ---- CSV & JSON export ----
  const exportCSV = () => {
    const header = [
      'ApplicationID',
      'FullName',
      'Email',
      'Phone',
      'Postcode',
      'UK City',
      'Status',
      'Fee',
      'FeeChoice',
      'FatherName',
      'GrandfatherName',
      'OriginAR',
      'PhotoURL',
      'CreatedAt',
      'LastPaymentAmount',
      'LastPaymentCurrency',
      'LastPaymentAt',
    ];
    const lines = sortedRows.map(({ app, lastPay }) => {
      const fn = (app?.fullName || `${app?.firstName || ''} ${app?.lastName || ''}`).trim();
      const created = app?.createdAt ? new Date(app.createdAt).toISOString() : '';
      const cells = [
        app?.id ?? '',
        fn,
        app?.email ?? '',
        app?.phone ?? '',
        app?.postcode ?? '',
        app?.ukCity ?? '',
        app?.status ?? '',
        (app?.fee ?? 0).toString(),
        app?.feeChoice ?? '',
        app?.fatherName ?? '',
        app?.grandfatherName ?? '',
        app?.cityOfOriginAr ?? '',
        app?.photoUrl ?? '',
        created,
        lastPay?.amount ?? '',
        (lastPay?.currency || '').toUpperCase(),
        lastPay?.createdAt ? new Date(lastPay.createdAt).toISOString() : '',
      ];
      return cells
        .map((c: any) => {
          const s = String(c ?? '');
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(',');
    });
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `join-applications-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJSON = () => {
    const json = JSON.stringify(sortedRows, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `join-applications-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ---- Recent payments list (top 8) ----
  const recentPayments = useMemo(() => {
    const arr = rows
      .filter((r) => r.lastPay)
      .map((r) => ({
        ...r.lastPay,
        fullName: (r.app?.fullName || `${r.app?.firstName || ''} ${r.app?.lastName || ''}`).trim(),
        appId: r.app?.id,
      }))
      .sort((a: any, b: any) => Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0))
      .slice(0, 8);
    return arr as Array<{ id: string; amount: number; currency: string; createdAt: number; fullName: string; appId: string }>;
  }, [rows]);

  return (
    <>
      <Head><title>Join Applications • Admin</title></Head>

      {!ready ? (
        <div className="p-8">
          <div className="mx-auto max-w-4xl rounded-2xl border bg-white p-8 shadow-sm ring-1 ring-black/5">
            <div className="h-6 w-40 animate-pulse rounded bg-neutral-200" />
            <div className="mt-4 space-y-2">
              <div className="h-4 w-full animate-pulse rounded bg-neutral-200" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-neutral-200" />
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Header with subtle gradient */}
          <div className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-50 via-white to-emerald-50" />
            <div className="relative px-6 py-6 md:px-8 md:py-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Join Applications</h1>
                  <p className="mt-1 text-sm text-neutral-600">
                    Review applications, see avatars (from JoinForm uploads), manage status & payments, and export data.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => router.replace(router.asPath)}
                    className="rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-neutral-300 bg-white hover:bg-neutral-100"
                    title="Refresh"
                  >
                    Refresh
                  </button>
                  <button
                    onClick={exportJSON}
                    className="rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-neutral-300 bg-white hover:bg-neutral-100"
                    title="Export JSON"
                  >
                    Export JSON
                  </button>
                  <button
                    onClick={exportCSV}
                    className="rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-neutral-300 bg-white hover:bg-neutral-100"
                    title="Export CSV"
                  >
                    Export CSV
                  </button>
                  <button
                    onClick={onQuickDelete}
                    className="rounded-full bg-red-600 text-white px-4 py-2 text-sm font-semibold hover:bg-red-700"
                    title="Hard delete by ID"
                  >
                    Quick Delete…
                  </button>
                </div>
              </div>

              {/* Quick actions toggle */}
              <div className="mt-4">
                <button
                  onClick={() => setQaOpen((s) => !s)}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-neutral-300 bg-white hover:bg-neutral-100"
                >
                  {qaOpen ? 'Hide Quick Actions' : 'Show Quick Actions'}
                </button>
              </div>

              {/* Quick actions panel */}
              {qaOpen && (
                <div className="mt-4 rounded-2xl border bg-white p-4 shadow-sm ring-1 ring-black/5">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-neutral-600 mb-1">Application ID</label>
                      <input
                        type="text"
                        value={quickId}
                        onChange={(e) => setQuickId(e.target.value)}
                        placeholder="Paste Application ID…"
                        className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-neutral-600 mb-1">Status</label>
                        <select
                          value={quickStatus}
                          onChange={(e) => setQuickStatus(e.target.value as any)}
                          className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition"
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
                          value={quickNote}
                          onChange={(e) => setQuickNote(e.target.value)}
                          placeholder="Optional note…"
                          className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      onClick={openById}
                      disabled={!quickId.trim()}
                      className="rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-neutral-300 bg-white hover:bg-neutral-100 disabled:opacity-60"
                    >
                      View
                    </button>
                    <button
                      onClick={qaUpdate}
                      disabled={!quickId.trim()}
                      className="rounded-full px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60"
                    >
                      Update Status / Note
                    </button>
                    <button
                      onClick={qaApprove}
                      disabled={!quickId.trim()}
                      className="rounded-full px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60"
                    >
                      Approve
                    </button>
                    <button
                      onClick={qaSoftDelete}
                      disabled={!quickId.trim()}
                      className="rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-neutral-300 bg-white hover:bg-neutral-100 disabled:opacity-60"
                    >
                      Soft Delete
                    </button>
                    <button
                      onClick={qaHardDelete}
                      disabled={!quickId.trim()}
                      className="rounded-full px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60"
                    >
                      Hard Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* Success banner */}
            {justDeleted && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-800 px-3 py-2 text-sm">
                تم الحذف بنجاح.
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
              <StatCard label="Total" value={stats.total} hint="All applications" />
              <StatCard label="With Photo" value={stats.withPhoto} hint="Has avatar" />
              <StatCard label="Approved" value={stats.approved} hint="Activated members" />
              <StatCard label="Submitted" value={stats.submitted} hint="Awaiting review" />
              <StatCard label="Deleted" value={stats.deleted} hint="Soft or hard" />
              <StatCard
                label="With Payments"
                value={stats.paying}
                hint={Object.keys(stats.payTotals).length
                  ? `Totals: ${Object.entries(stats.payTotals)
                      .map(([c, v]) => `${c} ${v.toFixed(2)}`)
                      .join(' • ')}`
                  : 'No payments total'}
              />
            </div>

            {/* Filters */}
            <div className="rounded-2xl border bg-white p-4 md:p-5 shadow-sm ring-1 ring-black/5">
              <div className="grid gap-4 xl:grid-cols-4">
                {/* Search + sort */}
                <div className="xl:col-span-2 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">
                      Search (name, email, phone, postcode, city, origin, father/grandfather, ID)
                    </label>
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="w-full rounded-xl border border-neutral-300 px-3 py-2 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition"
                      placeholder="e.g., Ahmed, example@email.com, N1 0AA…"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Sort By</label>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as SortBy)}
                      className="w-full rounded-xl border border-neutral-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition"
                    >
                      <option value="created_desc">Newest</option>
                      <option value="created_asc">Oldest</option>
                      <option value="name_asc">Name A→Z</option>
                      <option value="name_desc">Name Z→A</option>
                      <option value="fee_desc">Fee High→Low</option>
                      <option value="fee_asc">Fee Low→High</option>
                      <option value="status_asc">Status A→Z</option>
                      <option value="status_desc">Status Z→A</option>
                    </select>
                  </div>
                </div>

                {/* Status / Photos / Payments / Fee choice */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as StatusFilter)}
                      className="w-full rounded-xl border border-neutral-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition"
                    >
                      <option value="all">All</option>
                      <option value="approved">Approved</option>
                      <option value="submitted">Submitted</option>
                      <option value="pending">Pending</option>
                      <option value="rejected">Rejected</option>
                      <option value="deleted">Deleted</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Photo</label>
                    <select
                      value={hasPhoto}
                      onChange={(e) => setHasPhoto(e.target.value as Ternary)}
                      className="w-full rounded-xl border border-neutral-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition"
                    >
                      <option value="any">Any</option>
                      <option value="yes">With Photo</option>
                      <option value="no">No Photo</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Payments</label>
                    <select
                      value={hasPayment}
                      onChange={(e) => setHasPayment(e.target.value as Ternary)}
                      className="w-full rounded-xl border border-neutral-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition"
                    >
                      <option value="any">Any</option>
                      <option value="yes">With Payment</option>
                      <option value="no">No Payment</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Plan (Fee Choice)</label>
                    <select
                      value={feeChoiceFilter}
                      onChange={(e) => setFeeChoiceFilter(e.target.value as FeeChoiceFilter)}
                      className="w-full rounded-xl border border-neutral-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition"
                    >
                      <option value="any">Any</option>
                      <option value="free">Free (£0)</option>
                      <option value="silver">Silver (£11.99)</option>
                      <option value="gold">Gold (£21.99)</option>
                      <option value="diamond">Diamond (£49.99)</option>
                    </select>
                  </div>
                </div>

                {/* Fee & Date range */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Minimum Fee</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={minFee}
                      onChange={(e) => setMinFee(e.target.value)}
                      className="w-full rounded-xl border border-neutral-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={resetFilters}
                      className="w-full rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-neutral-300 hover:bg-neutral-100"
                    >
                      Reset Filters
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Created From</label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-full rounded-xl border border-neutral-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Created To</label>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="w-full rounded-xl border border-neutral-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-3 text-xs text-neutral-500">
                Showing <span className="font-semibold text-neutral-700">{sortedRows.length}</span> of{' '}
                <span className="font-semibold text-neutral-700">{rows.length}</span> applications.
              </div>
            </div>

            {/* Recent payments */}
            <div className="grid lg:grid-cols-3 gap-3">
              <div className="lg:col-span-2 rounded-2xl border bg-white p-3 md:p-4 shadow-sm ring-1 ring-black/5">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-semibold text-neutral-700">Applications</div>
                  <div className="text-xs text-neutral-500">Click a row or the “View” chip to open details.</div>
                </div>
                {/* Table (shows avatar from JoinForm) */}
                <JoinTable rows={sortedRows as any} />
              </div>

              <div className="rounded-2xl border bg-white p-4 shadow-sm ring-1 ring-black/5">
                <div className="mb-2 text-sm font-semibold text-neutral-700">Recent Payments</div>
                {recentPayments.length ? (
                  <ul className="-my-2 divide-y divide-neutral-100">
                    {recentPayments.map((p) => (
                      <li key={p.id} className="py-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium">
                              {new Intl.NumberFormat('en-GB', {
                                style: 'currency',
                                currency: p.currency || 'GBP',
                              }).format(Number(p.amount || 0))}
                            </div>
                            <div className="text-xs text-neutral-600">
                              {p.fullName || '—'} • {p.createdAt ? new Date(p.createdAt).toLocaleString() : '—'}
                            </div>
                          </div>
                          <button
                            onClick={() => router.push(`/auth/admin/join/${encodeURIComponent(p.appId)}`)}
                            className="rounded-full px-2 py-1 text-xs font-semibold ring-1 ring-neutral-300 hover:bg-neutral-100"
                          >
                            View
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-neutral-600">No recent payments.</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function StatCard({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-neutral-500">{label}</div>
          <div className="mt-1 text-2xl font-semibold">{value}</div>
        </div>
        <div className="text-neutral-300">●</div>
      </div>
      {hint && <div className="mt-1 text-[11px] text-neutral-500">{hint}</div>}
    </div>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const { adminDb } = await import('@/lib/firebaseAdmin');

  const toMillis = (x: any) => (x?.toMillis ? x.toMillis() : x ?? null);

  const [appsSnap, membersSnap, paymentsSnap] = await Promise.all([
    adminDb
      .collection('joinApplications')
      .orderBy('createdAt', 'desc')
      .limit(800)
      .get()
      .catch(async (e: any) => {
        const msg = (e?.message || '').toLowerCase();
        const needsIndex = e?.code === 9 || msg.includes('requires an index');
        if (!needsIndex) throw e;
        const s = await adminDb.collection('joinApplications').limit(800).get();
        return {
          docs: s.docs.sort((a: any, b: any) => {
            const aTs = toMillis(a.data()?.createdAt) || 0;
            const bTs = toMillis(b.data()?.createdAt) || 0;
            return bTs - aTs;
          }),
        } as any;
      }),
    adminDb.collection('members').limit(1200).get(),
    adminDb
      .collection('payments')
      .orderBy('createdAt', 'desc')
      .limit(2000)
      .get()
      .catch(async () => {
        const s = await adminDb.collection('payments').limit(2000).get();
        return {
          docs: s.docs.sort((a: any, b: any) => {
            const aTs = toMillis(a.data()?.createdAt) || 0;
            const bTs = toMillis(b.data()?.createdAt) || 0;
            return bTs - aTs;
          }),
        } as any;
      }),
  ]);

  const normalizeAppOrMember = (d: any) => {
    const data = d.data() || {};
    return {
      id: d.id,
      ...data,
      createdAt: toMillis(data.createdAt),
      updatedAt: toMillis(data.updatedAt),
      lastPaymentAt: toMillis(data.lastPaymentAt),
      currentPeriodEnd: toMillis(data.currentPeriodEnd),
    };
  };

  const apps = appsSnap.docs.map(normalizeAppOrMember);
  const members = membersSnap.docs.map(normalizeAppOrMember);

  // IMPORTANT: Do NOT spread ...data here; map only JSON-safe fields and convert timestamps.
  const payments = paymentsSnap.docs.map((d: any) => {
    const data = d.data() || {};
    return {
      id: d.id,
      applicationId: data.applicationId ?? null,
      amount: typeof data.amount === 'number' ? data.amount : Number(data.amount ?? 0),
      currency: (data.currency || 'GBP').toUpperCase(),
      provider: data.provider ?? null,
      note: data.note ?? null,
      createdAt: toMillis(data.createdAt),
      updatedAt: toMillis(data.updatedAt),
      periodStart: toMillis(data.periodStart),
      periodEnd: toMillis(data.periodEnd),
    };
  });

  // Fast lookups
  const byApplicationId = new Map(members.map((m: any) => [m.applicationId, m]));

  const lastPaidByApplicationId = new Map<string, any>();
  for (const p of payments) {
    const aid = p.applicationId;
    if (!aid) continue;
    const prev = lastPaidByApplicationId.get(aid);
    if (!prev || (prev.createdAt ?? 0) < (p.createdAt ?? 0)) {
      lastPaidByApplicationId.set(aid, p);
    }
  }

  const rows: Row[] = apps.map((app: any) => ({
    app,
    member: byApplicationId.get(app.id) || null,
    lastPay: lastPaidByApplicationId.get(app.id) || null,
  }));

  const justDeleted = ctx.query?.deleted === '1';

  return { props: { rows, justDeleted: !!justDeleted } };
};

