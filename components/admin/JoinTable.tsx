// components/admin/JoinTable.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/** ===== Keep tiers aligned with JoinForm ===== */
type Tier = 'free' | 'silver' | 'gold' | 'diamond';

const TIERS: Record<Tier, { label: string; monthly: number; emoji?: string; note?: string }> = {
  free:    { label: 'Free',    monthly: 0,      note: 'ابدأ بلا رسوم الآن' },
  silver:  { label: 'Silver',  monthly: 11.99,  note: 'Monthly', emoji: '🥈' },
  gold:    { label: 'Gold',    monthly: 21.99,  note: 'Monthly', emoji: '🥇' },
  diamond: { label: 'Diamond', monthly: 49.99,  note: 'Monthly', emoji: '💎' },
};

type Audience = 'palestinian' | 'nonPalestinian';

export type AppRow = {
  id: string;
  // Personal
  firstName?: string;
  lastName?: string;
  fullName?: string;
  dob?: string;

  // Contact / address
  phone?: string;
  email?: string;
  address?: string;
  postcode?: string;
  ukCity?: string;

  // Origin
  cityOfOriginAr?: string;
  cityOfOrigin?: string;

  // Fees & plan
  feeChoice?: Tier;
  fee?: number;

  // Photo
  photoUrl?: string | null;
  profilePhotoUrl?: string | null; // fallback (older records)

  // Status / flags
  status?: string;
  paymentRequired?: boolean;

  // Times (ms)
  createdAt?: number | null;
  updatedAt?: number | null;
  lastPaymentAt?: number | null;

  // Misc
  note?: string | null;

  // Optional audience marker
  audience?: Audience;
};

type PaymentDoc = {
  id: string;
  applicationId?: string;
  amount?: number;
  currency?: string;
  createdAt?: any;     // Firestore Timestamp | number | string
  periodStart?: any;
  periodEnd?: any;
  provider?: string;
  note?: string;
};

/** Money formatting helper (major units expected) */
function formatMoney(amount?: number, currency: string = 'GBP') {
  if (amount == null) return '£0.00';
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
  } catch {
    return `£${Number(amount).toFixed(2)}`;
  }
}

function toDate(d: any): Date | null {
  if (!d) return null;
  if (d?.toDate) return d.toDate();
  const t = new Date(d);
  return Number.isFinite(t.getTime()) ? t : null;
}

/** Lazy payment summary per application to avoid heavy initial loads */
function usePaymentSummary(applicationId?: string) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<{ total: number; count: number; lastPaidAt: Date | null; currency: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!applicationId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const qy = query(
          collection(db, 'payments'),
          where('applicationId', '==', applicationId),
          orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(qy);
        let total = 0;
        let count = 0;
        let currency = 'GBP';
        let lastPaidAt: Date | null = null;

        snap.forEach(doc => {
          const p = doc.data() as PaymentDoc;
          if (typeof p.amount === 'number') total += p.amount;
          if (p.currency) currency = p.currency;
          if (!lastPaidAt) lastPaidAt = toDate(p.createdAt) || null;
          count += 1;
        });

        if (!cancelled) setSummary({ total, count, lastPaidAt, currency });
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load payments');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [applicationId]);

  return { summary, loading, error };
}

/** Quick chip helpers */
function StatusChip({ status }: { status?: string }) {
  const s = (status || 'submitted').toLowerCase();
  let cls = 'bg-neutral-100 text-neutral-700';
  if (s.includes('approved') || s.includes('active')) cls = 'bg-emerald-100 text-emerald-700';
  else if (s.includes('pending') || s.includes('submitted')) cls = 'bg-blue-100 text-blue-700';
  else if (s.includes('rejected') || s.includes('failed')) cls = 'bg-red-100 text-red-700';
  else if (s.includes('deleted')) cls = 'bg-amber-100 text-amber-700';
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{status || 'submitted'}</span>;
}

function PlanBadge({ feeChoice }: { feeChoice?: Tier }) {
  if (!feeChoice) return <span className="text-xs text-neutral-500">—</span>;
  const cfg = TIERS[feeChoice];
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      {cfg?.emoji && <span aria-hidden>{cfg.emoji}</span>}
      <span>{cfg?.label || feeChoice}</span>
    </span>
  );
}

/** Row actions (Approve / Soft Delete / View) using your existing API routes */
function RowActions({ id, onChanged }: { id: string; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);

  const call = async (url: string, body: unknown) => {
    setBusy(url);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok || j?.ok === false) throw new Error(j?.error || 'Action failed');
      onChanged();
    } catch (e: any) {
      alert(e?.message || 'Action failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex items-center justify-end gap-2">
      <button
        className="rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-neutral-300 hover:bg-neutral-100 disabled:opacity-60"
        onClick={() => call('/api/admin/join/approve', { applicationId: id })}
        disabled={!!busy}
      >
        {busy === '/api/admin/join/approve' ? 'Approving…' : 'Approve'}
      </button>
      <button
        className="rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-neutral-300 hover:bg-neutral-100 disabled:opacity-60"
        onClick={() => call('/api/admin/join/soft-delete', { applicationId: id })}
        disabled={!!busy}
      >
        {busy === '/api/admin/join/soft-delete' ? 'Deleting…' : 'Soft Delete'}
      </button>
      <Link
        href={`/auth/admin/join/${encodeURIComponent(id)}`}
        className="rounded-full px-2.5 py-1 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800"
      >
        View
      </Link>
    </div>
  );
}

/** Fallback date display */
function Dt({ ms }: { ms?: number | null }) {
  if (!ms) return <span className="text-xs text-neutral-500">—</span>;
  return <span className="text-xs text-neutral-700">{new Date(ms).toLocaleString()}</span>;
}

/** ====== PROPS SHAPE FIX ======
 * Your page passes: rows: Array<{ app, member, lastPay }>
 * This table now consumes that exact shape.
 */
type RowFromPage = {
  app: AppRow;
  member?: unknown | null;
  lastPay?: PaymentDoc | null;
};

type Props = { rows: RowFromPage[] } | Record<string, never>;

/**
 * Admin Join Table
 * - If `rows` prop provided (as from admin page), renders those
 * - Else (rare), it can fetch from a GET /api/admin/join you might implement
 * - Adds a Payments column with lazy summary per row (total, count, badge)
 */
export default function JoinTable(props: Props) {
  const router = useRouter();

  const passedRows = (props as any)?.rows as RowFromPage[] | undefined;
  const [rows, setRows] = useState<RowFromPage[]>(Array.isArray(passedRows) ? passedRows : []);
  const [loading, setLoading] = useState(!Array.isArray(passedRows));
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/admin/join', { method: 'GET' });
      const data = await res.json();
      if (!res.ok || data?.ok === false) throw new Error(data?.error || 'Failed to load join applications');

      const items: RowFromPage[] = Array.isArray(data?.items)
        ? data.items
        : (Array.isArray(data) ? data : []);

      // Sort by created desc if not already
      items.sort((a, b) => ((a.app?.createdAt || 0) < (b.app?.createdAt || 0) ? 1 : -1));
      setRows(items);
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (Array.isArray(passedRows)) return; // external rows provided by page
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onChanged = () => {
    if (Array.isArray(passedRows)) {
      // Parent controls rows → ask it to refresh via route
      router.replace(router.asPath);
    } else {
      refresh();
    }
  };

  return (
    <div className="rounded-2xl border border-neutral-200 overflow-hidden bg-white">
      <div className="flex items-center justify-between gap-3 px-3 py-2 bg-neutral-50 border-b border-neutral-200">
        <div className="text-sm font-semibold text-neutral-800">Join Applications</div>
        <div className="text-xs text-neutral-600">
          {loading ? 'Loading…' : `${rows.length} total`}
        </div>
      </div>

      {error && (
        <div className="px-3 py-2 text-sm text-red-700 bg-red-50 border-b border-red-200">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-[960px] w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-600">
            <tr>
              <th className="px-3 py-2 text-left">Applicant</th>
              <th className="px-3 py-2 text-left">Plan</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Payments</th>
              <th className="px-3 py-2 text-left">Submitted</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className="border-t border-neutral-100">
                <td colSpan={6} className="px-3 py-6 text-center text-neutral-500">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr className="border-t border-neutral-100">
                <td colSpan={6} className="px-3 py-6 text-center text-neutral-500">
                  No applications found.
                </td>
              </tr>
            ) : (
              rows.map((row) => <Row key={row.app.id} row={row} onChanged={onChanged} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({ row, onChanged }: { row: RowFromPage; onChanged: () => void }) {
  const app = row.app;

  const name =
    (app.fullName || `${app.firstName ?? ''} ${app.lastName ?? ''}`.trim()) || '—';

  const avatar = app.photoUrl || app.profilePhotoUrl || '';
  const { summary, loading } = usePaymentSummary(app.id);

  // Payment badge logic
  const required =
    typeof app.fee === 'number'
      ? app.fee
      : (app.feeChoice ? TIERS[app.feeChoice]?.monthly ?? 0 : 0);

  const paid = summary?.total ?? 0;
  let badge = 'Unpaid';
  if (paid > 0 && required > 0) {
    badge = paid >= required ? 'Paid' : 'Partially Paid';
  } else if (paid > 0 && required === 0) {
    badge = 'Paid';
  }
  const badgeClass =
    badge === 'Paid'
      ? 'bg-emerald-100 text-emerald-700'
      : badge === 'Partially Paid'
      ? 'bg-amber-100 text-amber-700'
      : 'bg-neutral-100 text-neutral-700';

  return (
    <tr className="border-t border-neutral-100 hover:bg-neutral-50/40">
      {/* Applicant */}
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg overflow-hidden bg-neutral-100 ring-1 ring-black/5">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full grid place-items-center text-[10px] text-neutral-400">—</div>
            )}
          </div>
          <div className="min-w-0">
            <div className="font-medium text-neutral-900 truncate max-w-[220px]">{name}</div>
            <div className="text-xs text-neutral-500 truncate max-w-[220px]">
              {app.email || '—'}{app.ukCity ? ` · ${app.ukCity}` : ''}
            </div>
            <div className="text-[10px] text-neutral-400 font-mono truncate max-w-[220px]">{app.id}</div>
          </div>
        </div>
      </td>

      {/* Plan */}
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <PlanBadge feeChoice={app.feeChoice} />
          <span className="text-xs text-neutral-600">
            {formatMoney(app.fee ?? (app.feeChoice ? TIERS[app.feeChoice].monthly : 0))}
          </span>
        </div>
      </td>

      {/* Status */}
      <td className="px-3 py-2">
        <StatusChip status={app.status} />
      </td>

      {/* Payments */}
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          {loading ? (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-neutral-100 text-neutral-600">Loading…</span>
          ) : (
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${badgeClass}`}>{badge}</span>
          )}
          {!loading && summary && (
            <span className="text-xs text-neutral-600">
              {formatMoney(summary.total, summary.currency)}{summary.count ? ` · ×${summary.count}` : ''}
            </span>
          )}
        </div>
      </td>

      {/* Created */}
      <td className="px-3 py-2">
        <Dt ms={app.createdAt} />
      </td>

      {/* Actions */}
      <td className="px-3 py-2">
        <RowActions id={app.id} onChanged={onChanged} />
      </td>
    </tr>
  );
}
