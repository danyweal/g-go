    import React from 'react';
    import Head from 'next/head';
    import useAdminGuard from '@/utils/useAdminGuard';

    async function fetchJSON(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const text = await res.text();
  let json: unknown = null;
  try { json = JSON.parse(text); } catch {}
  if (!res.ok || (json && json.ok === false)) {
    const msg = (json?.error || json?.message || text || `HTTP ${res.status}`);
    throw new Error(`${res.status} ${res.statusText} – ${msg}`);
  }
  return json || {};
}


    export default function AdminComments() {
      const { ready } = useAdminGuard();
      const [items, setItems] = React.useState<unknown[]>([]);
      const [loading, setLoading] = React.useState(true);
      const [error, setError] = React.useState<string | null>(null);

      const load = async () => {
        setLoading(true); setError(null);
        try {
          const data = await fetchJSON('/api/admin/comments/list');
          if (data.ok) setItems(data.items);
        } catch (e:unknown) { setError(e.message); }
        finally { setLoading(false); }
      };

      React.useEffect(() => { if (ready) load(); }, [ready]);

      const approve = async (path: string) => {
        await fetchJSON('/api/admin/comments/approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path, approved: true }) });
        await load();
      };
      const remove = async (path: string) => {
        if (!confirm('Delete?')) return;
        await fetchJSON('/api/admin/comments/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path }) });
        await load();
      };

      if (!ready) return null;

      return (
        <>
          <Head><title>Admin · Comments</title></Head>
          <div className="max-w-5xl mx-auto px-4 py-10">
            <h2 className="text-xl font-semibold mb-6">Pending Comments</h2>
            {loading ? <p>Loading…</p> : error ? <p className="text-red-600">{error}</p> : (
              <ul className="space-y-3">
                {items.map((it:unknown) => (
                  <li key={it.id} className="border rounded-lg p-4 bg-white flex items-center justify-between gap-4">
                    <div>
                      <div className="font-semibold">{it.authorName || 'Anonymous'}</div>
                      <div className="text-neutral-700">{it.content}</div>
                      <div className="text-xs text-neutral-400">{it.path}</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={()=>approve(it.path)} className="px-3 py-1.5 rounded bg-black text-white">Approve</button>
                      <button onClick={()=>remove(it.path)} className="px-3 py-1.5 rounded border">Delete</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      );
    }
