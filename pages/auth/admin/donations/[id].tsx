import React from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import useAdminGuard from '@/utils/useAdminGuard';

async function fetchJSON<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...init });
  const tx = await res.text();
  let data: any = null; try { data = JSON.parse(tx); } catch {}
  if (!res.ok || data?.ok === false) throw new Error(data?.error || tx || `HTTP ${res.status}`);
  return (data ?? {}) as T;
}

type MediaItem = { id: string; type: 'image'|'video'|'youtube'; url: string; title?: string; isPrimary?: boolean };
type Campaign = {
  id: string; slug: string; status: 'draft'|'active'|'paused'|'closed';
  title_ar: string; bannerUrl?: string|null;
  goalAmount: number; currency: 'GBP'|'USD'|'EUR'|string;
  why_ar: string; spendingPlan_ar?: string|null;
  contact?: { phone?: string; email?: string; whatsapp?: string; link?: string }|null;
  media: MediaItem[];
  allowPublicDonorList: boolean;
  totalDonated: number; donorsCount: number;
  startAt?: number; endAt?: number|null;
};

export default function AdminDonationEdit() {
  const { ready } = useAdminGuard();
  const router = useRouter();
  const id = String(router.query.id || 'new');
  const isNew = id === 'new';

  const [f, setF] = React.useState<Partial<Campaign>>({
    status: 'draft',
    currency: 'GBP',
    media: [],
    contact: {},
    allowPublicDonorList: true,
    totalDonated: 0,
    donorsCount: 0,
  } as Partial<Campaign>);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string|null>(null);

  // media state
  const [upBusy, setUpBusy] = React.useState(false);
  const [ytURL, setYtURL] = React.useState('');

  // keep a ref of current state for monotonic merges / optimistic updates
  const fRef = React.useRef<Partial<Campaign>>(f);
  React.useEffect(() => { fRef.current = f; }, [f]);

  const num = (v: unknown, def = 0) => {
    const n = typeof v === 'string' ? Number(v) : (typeof v === 'number' ? v : NaN);
    return Number.isFinite(n) ? n : def;
  };

  const mergeMonotonic = React.useCallback((incoming: Partial<Campaign>) => {
    const prev = fRef.current || {};
    const inTotal = num(incoming.totalDonated, num(prev.totalDonated, 0));
    const inDonors = num(incoming.donorsCount, num(prev.donorsCount, 0));
    const merged: Partial<Campaign> = {
      ...prev,
      ...incoming,
      // never regress key aggregates
      totalDonated: Math.max(num(prev.totalDonated, 0), inTotal),
      donorsCount: Math.max(num(prev.donorsCount, 0), inDonors),
      // keep media safe
      media: Array.isArray(incoming.media) ? incoming.media : (Array.isArray(prev.media) ? prev.media : []),
      // normalize currency for UI consistency
      currency: String((incoming.currency ?? prev.currency ?? 'GBP')).toUpperCase(),
    };
    setF(merged);
  }, []);

  const load = React.useCallback(async () => {
    if (isNew) return;
    setLoading(true);
    setErr(null);
    try {
      const data = await fetchJSON<{ item: Partial<Campaign> }>(`/api/admin/donations/${encodeURIComponent(id)}`);
      mergeMonotonic({ ...(data.item || {}), media: Array.isArray(data.item?.media) ? data.item.media : [] });
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [id, isNew, mergeMonotonic]);

  React.useEffect(() => {
    if (!ready) return;
    if (isNew) return;
    load();
  }, [ready, isNew, load]);

  const fileToDataURL = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const addUploadedMedia = (mi: MediaItem) => {
    const media = Array.isArray(fRef.current.media) ? [...fRef.current.media] : [];
    media.push(mi);
    setF({ ...fRef.current, media });
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setUpBusy(true);
    try {
      for (const file of Array.from(files)) {
        const dataURL = await fileToDataURL(file);
        const resp = await fetch('/api/admin/donations/upload-media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ dataURL, filename: file.name }),
        });
        const data = await resp.json();
        if (!resp.ok || data?.ok === false) throw new Error(data?.error || 'Upload failed');

        const mediaItem: MediaItem = {
          id: cryptoRandomId(),
          type: data.type as any,
          url: data.downloadUrl as string,
          title: '',
          isPrimary: false,
        };
        addUploadedMedia(mediaItem);
      }
    } catch (e: any) {
      alert(e?.message || 'Upload error');
    } finally { setUpBusy(false); }
  };

  const normalizeYouTube = (input: string) => {
    try {
      const u = new URL(input);
      if (u.hostname.includes('youtube.com') && u.searchParams.get('v')) return `https://www.youtube.com/embed/${u.searchParams.get('v')!}`;
      if (u.hostname === 'youtu.be') return `https://www.youtube.com/embed/${u.pathname.replace('/','')}`;
      if (u.pathname.includes('/embed/')) return input;
      return null;
    } catch { return null; }
  };

  const addYouTube = () => {
    const url = ytURL.trim();
    if (!url) return;
    const embed = normalizeYouTube(url);
    if (!embed) { alert('رابط يوتيوب غير صالح'); return; }
    const media = Array.isArray(fRef.current.media) ? [...fRef.current.media] : [];
    media.push({ id: cryptoRandomId(), type: 'youtube', url: embed, title: '', isPrimary: false });
    setF({ ...fRef.current, media });
    setYtURL('');
  };

  const setPrimary = (idx: number) => {
    const media = (Array.isArray(fRef.current.media) ? [...fRef.current.media] : []).map((m, i) => ({ ...m, isPrimary: i === idx }));
    setF({ ...fRef.current, media, bannerUrl: media[idx]?.url || fRef.current.bannerUrl });
  };

  const removeMedia = (idx: number) => {
    const media = (Array.isArray(fRef.current.media) ? [...fRef.current.media] : []);
    const wasPrimary = !!media[idx]?.isPrimary;
    media.splice(idx, 1);

    let bannerUrl = fRef.current.bannerUrl ?? null;
    if (wasPrimary) {
      const nextPrimaryIndex = media.findIndex(m => m.isPrimary);
      if (nextPrimaryIndex >= 0) {
        media.forEach((m, i) => (m.isPrimary = i === nextPrimaryIndex));
        bannerUrl = media[nextPrimaryIndex]?.url || null;
      } else {
        bannerUrl = media[0]?.url ?? null;
        if (bannerUrl) {
          media.forEach((m, i) => (m.isPrimary = i === 0));
        }
      }
    }
    setF({ ...fRef.current, media, bannerUrl });
  };

  const moveMedia = (idx: number, dir: -1|1) => {
    const media = (Array.isArray(fRef.current.media) ? [...fRef.current.media] : []);
    const ni = idx + dir; if (ni < 0 || ni >= media.length) return;
    [media[idx], media[ni]] = [media[ni], media[idx]];
    setF({ ...fRef.current, media });
  };

  const updateMediaTitle = (idx: number, title: string) => {
    const media = (Array.isArray(fRef.current.media) ? [...fRef.current.media] : []);
    media[idx] = { ...media[idx], title };
    setF({ ...fRef.current, media });
  };

  const save = async () => {
    setSaving(true); setErr(null);
    try {
      const media = Array.isArray(fRef.current.media) ? fRef.current.media : [];
      const primary = media.find(m => m.isPrimary) || media.find(m => m.type === 'image') || media[0];
      const payload = {
        ...fRef.current,
        id: isNew ? undefined : fRef.current.id, // keep id on update
        goalAmount: num((fRef.current as any).goalAmount, 0),
        currency: String(fRef.current.currency || 'GBP').toUpperCase(),
        bannerUrl: primary ? primary.url : (fRef.current.bannerUrl ?? null),
        media,
      };
      const res = await fetch(isNew ? '/api/admin/donations/create' : '/api/admin/donations/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data?.ok === false) throw new Error(data?.error || 'Save failed');
      if (isNew) router.replace(`/auth/admin/donations/${data.id}`); else alert('تم الحفظ');
      // After saving, refresh once to ensure we have latest totals and fields from server
      if (!isNew) await load();
    } catch (e: any) { setErr(e?.message || String(e)); }
    finally { setSaving(false); }
  };

  const addManualDonation = async () => {
    if (!fRef.current?.id) { alert('احفظ الحملة أولاً'); return; }
    const donorName = prompt('اسم المتبرّع (اتركه فارغًا للمجهول)') || '';
    const amountVal = Number(prompt('المبلغ') || '0');
    const amount = isFinite(amountVal) && amountVal > 0 ? amountVal : 0;
    if (amount <= 0) { alert('مبلغ غير صالح'); return; }
    const isAnonymous = !donorName;

    // optimistic bump
    setF((prev) => ({
      ...prev,
      totalDonated: num(prev?.totalDonated, 0) + amount,
      donorsCount: num(prev?.donorsCount, 0) + 1,
    }));

    try {
      const payload = {
        campaignId: fRef.current.id!,
        donorName: isAnonymous ? undefined : donorName,
        amount,
        currency: String(fRef.current.currency || 'GBP').toUpperCase(),
        message: '',
        isAnonymous,
        status: 'confirmed',
        method: 'offline',
      };
      const res = await fetch('/api/admin/donations/add-donation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data?.ok === false) throw new Error(data?.error || 'Error');

      alert('تم إدخال التبرع');
      await load(); // reconcile from server
    } catch (e: any) {
      // revert optimistic bump if failed
      setF((prev) => ({
        ...prev,
        totalDonated: Math.max(0, num(prev?.totalDonated, 0) - amount),
        donorsCount: Math.max(0, num(prev?.donorsCount, 0) - 1),
      }));
      alert(e?.message || 'Error');
    }
  };

  if (!ready) return null;

  const refresh = () => load();

  return (
    <>
      <Head><title>{isNew ? 'حملة جديدة' : `تعديل: ${f?.title_ar || ''}`} · Admin</title></Head>
      <div className="max-w-6xl mx-auto px-4 py-10 space-y-6">
        {err && <div className="p-3 rounded bg-red-50 border text-red-700">{err}</div>}

        <section className="p-6 border rounded-xl bg-white space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xl font-semibold">{isNew ? 'إنشاء حملة' : 'تعديل الحملة'}</h2>
            {!isNew && (
              <div className="text-sm flex items-center gap-2">
                <div className="rounded-lg border px-2 py-1 bg-neutral-50">
                  إجمالي: <b>{num(f?.totalDonated, 0)}</b> {String(f?.currency || 'GBP')}
                  &nbsp;· المتبرعون: <b>{num(f?.donorsCount, 0)}</b>
                </div>
                <button className="rounded-lg border px-3 py-1 hover:bg-neutral-50" onClick={refresh}>
                  تحديث
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-1"><span className="text-sm">عنوان الحملة (AR)</span>
              <input className="border p-2 rounded w-full" value={f.title_ar || ''} onChange={e => setF({ ...f, title_ar: e.target.value })} />
            </label>
            <label className="space-y-1"><span className="text-sm">Slug</span>
              <input className="border p-2 rounded w-full" value={f.slug || ''} onChange={e => setF({ ...f, slug: e.target.value })} placeholder="winter-relief-2025" />
            </label>
            <label className="space-y-1"><span className="text-sm">الهدف</span>
              <input
                type="number"
                className="border p-2 rounded w-full"
                value={num((f as any).goalAmount, 0)}
                onChange={e => setF({ ...f, goalAmount: num(e.target.value, 0) })}
              />
            </label>
            <label className="space-y-1"><span className="text-sm">العملة</span>
              <select
                className="border p-2 rounded w-full"
                value={String(f.currency || 'GBP').toUpperCase()}
                onChange={e => setF({ ...f, currency: e.target.value as any })}
              >
                <option value="GBP">GBP</option><option value="USD">USD</option><option value="EUR">EUR</option>
              </select>
            </label>
            <label className="md:col-span-2 space-y-1"><span className="text-sm">لماذا نجمع؟</span>
              <textarea className="border p-2 rounded w-full min-h-[120px]" value={f.why_ar || ''} onChange={e => setF({ ...f, why_ar: e.target.value })} />
            </label>
            <label className="md:col-span-2 space-y-1"><span className="text-sm">كيف سيتم الصرف؟ (Markdown بسيط)</span>
              <textarea className="border p-2 rounded w-full min-h-[120px]" value={f.spendingPlan_ar || ''} onChange={e => setF({ ...f, spendingPlan_ar: e.target.value })} />
            </label>
            <label className="space-y-1"><span className="text-sm">تاريخ الانتهاء (اختياري)</span>
              <input
                type="datetime-local"
                className="border p-2 rounded w-full"
                onChange={e => {
                  const v = e.target.value;
                  setF({ ...f, endAt: v ? new Date(v).getTime() : null });
                }}
              />
            </label>
            <label className="space-y-1"><span className="text-sm">الحالة</span>
              <select className="border p-2 rounded w-full" value={String(f.status || 'draft')} onChange={e => setF({ ...f, status: e.target.value as any })}>
                <option value="draft">مسودة</option><option value="active">نشطة</option><option value="paused">موقوفة مؤقتاً</option><option value="closed">مغلقة</option>
              </select>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <input id="allow" type="checkbox" checked={!!f.allowPublicDonorList} onChange={e => setF({ ...f, allowPublicDonorList: e.target.checked })} />
            <label htmlFor="allow">السماح بإظهار آخر المتبرعين</label>
          </div>
        </section>

        {/* Media */}
        <section className="p-6 border rounded-xl bg-white space-y-4">
          <h3 className="text-lg font-semibold">وسائط الحملة</h3>

          <div className="grid gap-4">
            <div className="flex flex-col md:flex-row gap-3 md:items-center">
              <div className="flex items-center gap-3">
                <label className="cursor-pointer rounded-xl border px-4 py-2 bg-neutral-50 hover:bg-neutral-100">
                  {upBusy ? 'جاري الرفع...' : 'رفع صور/فيديو'}
                  <input type="file" className="hidden" multiple accept="image/*,video/*" onChange={e => handleFiles(e.target.files)} disabled={upBusy} />
                </label>
                <span className="text-xs text-neutral-500">الحدّ: حتى ~200MB لكل ملف</span>
              </div>

              <div className="md:ml-auto flex items-center gap-2">
                <input className="border p-2 rounded w-72" placeholder="رابط YouTube" value={ytURL} onChange={(e) => setYtURL(e.target.value)} />
                <button className="rounded-xl bg-palestine-green text-white px-4 py-2" onClick={addYouTube}>إضافة يوتيوب</button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(f.media || []).map((m, i) => (
                <div key={m.id || i} className="border rounded-xl overflow-hidden bg-white">
                  <div className="aspect-video bg-neutral-100 flex items-center justify-center">
                    {m.type === 'image' && <img src={m.url} alt={m.title || ''} className="w-full h-full object-cover" />}
                    {m.type === 'video' && <video src={m.url} controls className="w-full h-full object-cover" />}
                    {m.type === 'youtube' && <iframe className="w-full h-full" src={m.url} allowFullScreen />}
                  </div>
                  <div className="p-3 space-y-2">
                    <input className="border p-2 rounded w-full" placeholder="عنوان (اختياري)" value={m.title || ''} onChange={(e) => updateMediaTitle(i, e.target.value)} />
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <input id={`primary-${i}`} type="radio" name="primary-media" checked={!!m.isPrimary} onChange={() => setPrimary(i)} />
                        <label htmlFor={`primary-${i}`}>صورة الغلاف</label>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="px-2 py-1 rounded border" onClick={() => moveMedia(i, -1)} title="Move left">←</button>
                        <button className="px-2 py-1 rounded border" onClick={() => moveMedia(i, +1)} title="Move right">→</button>
                        <button className="px-2 py-1 rounded border text-red-600" onClick={() => removeMedia(i)}>حذف</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {!f.media?.length && (
                <div className="text-center text-neutral-500 p-6 border rounded-xl">لا يوجد وسائط بعد — ارفع صور/فيديو أو أضف رابط يوتيوب.</div>
              )}
            </div>
          </div>
        </section>

        <div className="flex gap-2">
          <button className="rounded-xl bg-palestine-green text-white px-4 py-2" onClick={save} disabled={saving}>{saving ? 'جارٍ الحفظ...' : 'حفظ'}</button>
          <button className="rounded-xl bg-slate-200 px-4 py-2" onClick={addManualDonation}>إدخال تبرع يدوي</button>
        </div>
      </div>
    </>
  );
}

function cryptoRandomId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return (crypto as any).randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
