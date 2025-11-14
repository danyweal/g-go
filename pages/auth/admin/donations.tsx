import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import useAdminGuard from '@/utils/useAdminGuard';

type Campaign = {
  id: string;
  title_ar: string;
  status: string;
  totalDonated: number;
  donorsCount: number;
  currency: string;
  updatedAt?: number;
};

async function fetchJSON(url: string, init?: RequestInit) {
  const res = await fetch(url, { credentials: 'include', ...init });
  const tx = await res.text();
  let data: any = null;
  try { data = JSON.parse(tx); } catch {}
  if (!res.ok || data?.ok === false) throw new Error(data?.error || tx || `HTTP ${res.status}`);
  return data ?? {};
}

function formatMoney(n: number, ccy: string) {
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: (ccy || 'GBP').toUpperCase() as any }).format(n || 0);
  } catch {
    return `${(n || 0).toFixed ? (n || 0).toFixed(2) : (n || 0)} ${ccy || ''}`;
  }
}

function toNum(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeCampaign(raw: any): Campaign {
  return {
    id: String(raw?.id || ''),
    title_ar: String(raw?.title_ar || ''),
    status: String(raw?.status || ''),
    totalDonated: toNum(raw?.totalDonated, 0),
    donorsCount: toNum(raw?.donorsCount, 0),
    currency: String(raw?.currency || 'GBP').toUpperCase(),
    updatedAt: toNum(raw?.updatedAt || raw?.updated_at, 0),
  };
}

export default function AdminDonationsPage() {
  const { ready } = useAdminGuard();
  const [items, setItems] = React.useState<Campaign[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [recomputing, setRecomputing] = React.useState(false);

  // Keep a ref of current items so we can merge without stale closures
  const itemsRef = React.useRef<Campaign[]>(items);
  React.useEffect(() => { itemsRef.current = items; }, [items]);

  const mergeMonotonic = React.useCallback((nextRaw: Campaign[]) => {
    // Normalize all incoming first
    const next = nextRaw.map(normalizeCampaign);

    const prevById = new Map(itemsRef.current.map(i => [i.id, i]));
    const merged = next.map(n => {
      const p = prevById.get(n.id);
      if (!p) return n;
      return {
        ...n,
        // never regress on aggregates
        totalDonated: Math.max(toNum(p.totalDonated), toNum(n.totalDonated)),
        donorsCount: Math.max(toNum(p.donorsCount), toNum(n.donorsCount)),
        // preserve a non-empty currency if server returned blank for any reason
        currency: String(n.currency || p.currency || 'GBP').toUpperCase(),
        // keep the latest updatedAt
        updatedAt: Math.max(toNum(p.updatedAt), toNum(n.updatedAt)),
      };
    });

    // Keep a stable sort (most recently updated first, then title)
    merged.sort((a, b) => {
      const t = toNum(b.updatedAt) - toNum(a.updatedAt);
      if (t !== 0) return t;
      return String(a.title_ar).localeCompare(String(b.title_ar));
    });

    setItems(merged);
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await fetchJSON('/api/admin/donations/list');
      const arr: Campaign[] = Array.isArray(data.items) ? data.items.map(normalizeCampaign) : [];
      // Sort for consistent UI (server order may vary)
      arr.sort((a, b) => {
        const t = toNum(b.updatedAt) - toNum(a.updatedAt);
        if (t !== 0) return t;
        return String(a.title_ar).localeCompare(String(b.title_ar));
      });
      mergeMonotonic(arr);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [mergeMonotonic]);

  // delete handler
  const deleteCampaign = async (id: string) => {
    const target = itemsRef.current.find(i => i.id === id);
    const name = target?.title_ar ? `«${target.title_ar}»` : id;

    if (!window.confirm(`هل أنت متأكد من حذف الحملة ${name}؟ لا يمكن التراجع.`)) return;

    setDeletingId(id);
    setError(null);

    // optimistic remove
    const prev = itemsRef.current;
    setItems(prev.filter(i => i.id !== id));

    try {
      await fetchJSON('/api/admin/donations/delete', {
        method: 'POST', // keep as POST to match your API
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
    } catch (e: any) {
      // revert on failure
      setItems(prev);
      setError(e.message || String(e));
    } finally {
      setDeletingId(null);
    }
  };

  // Optional admin action: force recompute in case totals drift
  const recomputeTotals = async () => {
    if (!window.confirm('سيتم إعادة احتساب الإجماليات من سجلات التبرعات المؤكدة. هل تريد المتابعة؟')) return;
    setRecomputing(true);
    setError(null);
    try {
      await fetchJSON('/api/admin/donations/recompute-aggregates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      await load(); // refresh view after recompute
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setRecomputing(false);
    }
  };

  // initial + auto refresh every 10s (cleared on unmount)
  React.useEffect(() => {
    if (!ready) return;
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [ready, load]);

  if (!ready) return null;

  return (
    <>
      <Head><title>Admin · Donations</title></Head>
      <div className="max-w-6xl mx-auto px-4 py-10 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">حملات التبرع</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="rounded-xl border px-4 py-2 hover:bg-neutral-50 disabled:opacity-50"
              aria-label="تحديث القائمة"
            >
              {loading ? 'يتم التحديث…' : 'تحديث'}
            </button>

            <button
              type="button"
              onClick={recomputeTotals}
              disabled={recomputing || loading}
              className="rounded-xl border px-4 py-2 hover:bg-neutral-50 disabled:opacity-50"
              aria-label="إعادة احتساب الإجماليات"
              title="إعادة احتساب الإجماليات من سجلات التبرعات المؤكدة"
            >
              {recomputing ? 'جارٍ إعادة الاحتساب…' : 'إعادة احتساب الإجماليات'}
            </button>

            <Link href="/auth/admin/donations/new" className="rounded-xl bg-palestine-green text-white px-4 py-2">
              + حملة جديدة
            </Link>
          </div>
        </div>

        {error && <div className="p-3 rounded bg-red-50 border text-red-700">{String(error)}</div>}

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="p-2">العنوان</th>
                <th className="p-2">الحالة</th>
                <th className="p-2">إجمالي</th>
                <th className="p-2">المتبرعون</th>
                <th className="p-2">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 && (
                <tr><td className="p-4 text-gray-500" colSpan={5}>جاري التحميل…</td></tr>
              )}

              {items.map((x) => (
                <tr key={x.id} className="border-b">
                  <td className="p-2">{x.title_ar}</td>
                  <td className="p-2">{x.status}</td>
                  <td className="p-2">{formatMoney(Number(x.totalDonated || 0), x.currency)}</td>
                  <td className="p-2">{Number(x.donorsCount || 0)}</td>
                  <td className="p-2 flex items-center gap-3">
                    <Link
                      href={`/auth/admin/donations/${x.id}`}
                      className="text-palestine-green hover:underline"
                    >
                      تعديل
                    </Link>

                    <button
                      type="button"
                      onClick={() => deleteCampaign(x.id)}
                      disabled={!!deletingId}
                      className="rounded-lg px-3 py-1 border text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label={`حذف الحملة ${x.title_ar}`}
                    >
                      {deletingId === x.id ? 'جارٍ الحذف…' : 'حذف'}
                    </button>
                  </td>
                </tr>
              ))}

              {!loading && items.length === 0 && (
                <tr><td className="p-4 text-gray-500" colSpan={5}>لا توجد حملات بعد.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
