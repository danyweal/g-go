// pages/store/index.tsx
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

/**
 * Public API contracts this page expects:
 * GET /api/store/list                 -> { ok: boolean; items: Album[] }
 * GET /api/store/media-list?slug=...  -> { ok: boolean; items: MediaItem[] }
 */

type Album = {
  id: string;
  name?: string;
  title: string;
  address?: string;
  slug: string;
  description: string;
  createdAtMillis: number | null;
  primaryMediaUrl: string | null;
  primaryMediaType: 'image' | 'video' | null;
  primaryMediaThumbUrl: string | null;
  mediaCount: number;
  imageCount: number;
  videoCount: number;
};

type MediaItem = {
  id: string;
  url: string;
  type: 'image' | 'video' | 'other';
  thumbUrl: string | null;
  title: string;
  note?: string;
  createdAtMillis: number | null;
};

type SortKey = 'newest' | 'oldest' | 'title';

function useKey(key: string, handler: () => void) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if (e.key === key) handler(); };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [key, handler]);
}

export default function StoreIndexPage() {
  const [items, setItems] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');
  const [copyingId, setCopyingId] = useState<string | null>(null);

  // Preview modal state (loads ALL media for the selected store via media-list API)
  const [active, setActive] = useState<Album | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);

  const canPrev = openIndex !== null && openIndex > 0;
  const canNext = openIndex !== null && openIndex < media.length - 1;
  const prev = () => canPrev && setOpenIndex((i) => (i == null ? i : i - 1));
  const next = () => canNext && setOpenIndex((i) => (i == null ? i : i + 1));
  const close = () => { setActive(null); setMedia([]); setOpenIndex(null); };

  useKey('Escape', close);
  useKey('ArrowLeft', prev);
  useKey('ArrowRight', next);

  // ===== Fetch stores list =====
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await fetch('/api/store/list?limit=100');
        const j = await r.json();
        if (mounted && j?.ok) setItems(j.items || []);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    let list = [...items];
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((a) => {
        const t = `${a.title} ${a.description || ''} ${a.slug} ${a.name || ''} ${a.address || ''}`.toLowerCase();
        return t.includes(q);
      });
    }
    list.sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title);
      const am = a.createdAtMillis ?? 0;
      const bm = b.createdAtMillis ?? 0;
      return sort === 'newest' ? bm - am : am - bm;
    });
    return list;
  }, [items, query, sort]);

  function isNew(createdAtMillis: number | null) {
    if (!createdAtMillis) return false;
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    return Date.now() - createdAtMillis < sevenDays;
  }

  async function copyLink(a: Album) {
    try {
      setCopyingId(a.id);
      const url = `${window.location.origin}/store/${a.slug}`;
      await navigator.clipboard.writeText(url);
    } finally {
      setTimeout(() => setCopyingId(null), 900);
    }
  }

  async function shareLink(a: Album) {
    try {
      const url = `${window.location.origin}/store/${a.slug}`;
      if (navigator.share) {
        await navigator.share({ title: a.title, text: a.description || a.title, url });
      } else {
        await navigator.clipboard.writeText(url);
      }
    } catch { /* ignore */ }
  }

  // ✅ Fetch ALL media (images + videos) using the dedicated media-list API
  async function openPreview(a: Album) {
    setActive(a);
    setLoadingMedia(true);
    setMedia([]);
    setOpenIndex(null);
    try {
      const r = await fetch(`/api/store/media-list?slug=${encodeURIComponent(a.slug)}&all=1`);
      const j = await r.json();
      if (j?.ok) {
        setMedia(j.items || []);
        if ((j.items || []).length) setOpenIndex(0);
      }
    } finally {
      setLoadingMedia(false);
    }
  }

  const FlagBar = () => (
    <div className="w-full h-1.5 flex">
      <div className="flex-1 bg-black" />
      <div className="flex-1 bg-white" />
      <div className="flex-1 bg-[#007A3D]" />
      <div className="flex-1 bg-[#D32F2F]" />
    </div>
  );

  const cards = useMemo(
    () =>
      filtered.map((a) => {
        const hasPrimary = !!a.primaryMediaUrl;
        const cover =
          a.primaryMediaType === 'video'
            ? a.primaryMediaThumbUrl || a.primaryMediaUrl
            : a.primaryMediaUrl;
        const counts = `${a.imageCount || 0} photos · ${a.videoCount || 0} videos`;
        const fresh = isNew(a.createdAtMillis);

        return (
          <div
            key={a.id}
            className="group relative rounded-3xl border border-neutral-200 bg-white/90 backdrop-blur overflow-hidden hover:shadow-[0_20px_60px_-20px_rgba(0,0,0,0.25)] transition will-change-transform hover:-translate-y-0.5"
          >
            <div className="relative aspect-[16/9] w-full bg-neutral-100">
              {hasPrimary && cover ? (
                <Image
                  src={cover}
                  alt={a.title}
                  fill
                  className="object-cover transition group-hover:scale-[1.02]"
                  sizes="(max-width:768px) 100vw, (max-width:1024px) 50vw, 33vw"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-neutral-400">
                  No cover yet
                </div>
              )}

              {/* overlay */}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition" />
              {/* flag ribbon */}
              <div className="absolute left-3 top-3 z-10 flex overflow-hidden rounded-full ring-1 ring-black/10">
                <span className="h-2 w-2 bg-black" />
                <span className="h-2 w-2 bg-white" />
                <span className="h-2 w-2 bg-[#007A3D]" />
                <span className="h-2 w-2 bg-[#D32F2F]" />
              </div>
              {/* type */}
              {a.primaryMediaType ? (
                <div className="absolute top-3 right-3 rounded-full px-2.5 py-1 text-xs bg-white/95 text-neutral-800 border backdrop-blur-sm">
                  {a.primaryMediaType === 'video' ? 'Video cover' : 'Photo cover'}
                </div>
              ) : null}
              {/* new */}
              {fresh ? (
                <div className="absolute bottom-3 left-3 rounded-full px-2.5 py-1 text-xs bg-emerald-600 text-white shadow">
                  New
                </div>
              ) : null}
            </div>

            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg md:text-xl font-extrabold leading-tight line-clamp-2">
                    {a.title}
                  </h3>

                  {(a.name || a.address) && (
                    <div className="mt-1 text-[13px] text-neutral-600">
                      {a.name ? <span className="font-semibold">{a.name}</span> : null}
                      {a.name && a.address ? <span className="mx-1.5">•</span> : null}
                      {a.address ? <span>{a.address}</span> : null}
                    </div>
                  )}

                  <div className="mt-1 text-xs text-neutral-500">{counts}</div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => copyLink(a)}
                    title="Copy public link"
                    className="inline-flex items-center justify-center h-9 w-9 rounded-xl border hover:bg-neutral-50 transition"
                    aria-label="Copy public link"
                  >
                    {copyingId === a.id ? '✓' : '⧉'}
                  </button>
                  <button
                    onClick={() => shareLink(a)}
                    title="Share"
                    className="inline-flex items-center justify-center h-9 w-9 rounded-xl border hover:bg-neutral-50 transition"
                    aria-label="Share"
                  >
                    ↗
                  </button>
                </div>
              </div>

              {a.description ? (
                <p className="mt-2 text-sm text-neutral-600 line-clamp-2">{a.description}</p>
              ) : null}

              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => openPreview(a)}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm text-white bg-[#007A3D] hover:opacity-95 active:scale-[0.99] transition"
                >
                  Img/Vid Preview
                </button>
                <Link
                  href={`/store/${a.slug}`}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm text-neutral-900 ring-1 ring-neutral-200 hover:bg-neutral-50 active:scale-[0.99] transition"
                >
                  More Details...
                </Link>
              </div>
            </div>
          </div>
        );
      }),
    [filtered, copyingId]
  );

  const current = openIndex != null ? media[openIndex] : null;

  return (
    <>
      <Head>
        <title>Community Stores — Palestinian Community Association</title>
        <meta
          name="description"
          content="Discover & visit authentic community stores in North West UK • ادعم أبناء جاليتك عبر شراء منتجاتهم وزيارة متاجرهم."
        />
      </Head>

      <Navbar />

      {/* Flag bar */}
      <div className="pt-20">
        <FlagBar />
      </div>

      {/* HERO + Controls */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1200px_600px_at_50%_-100px,rgba(0,0,0,0.06),transparent)]" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-10 pb-10">
          <div className="flex items-start gap-4">
            <Image
              src="/logo.jpg"
              alt="Palestinian Community Association North West UK"
              width={72}
              height={60}
              className="rounded-md shadow ring-1 ring-black/5"
              priority
            />
            <div className="max-w-3xl">
              <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-neutral-900">
                متاجر الجالية الفلسطينية • Community Stores
              </h1>
              <p className="mt-3 text-neutral-700 leading-relaxed">
                <span dir="rtl" className="font-semibold">
                  افتح قلبك قبل محفظتك — بدعمك للمتاجر المحلية، أنت تبني فرصة ورزقاً كريماً لأبناء جاليتك
                  في شمال غرب بريطانيا.
                </span>{' '}
                <span className="block mt-1">
                  Explore authentic businesses from our community. Discover, visit, and support locally.
                </span>
              </p>
              {/* CTA: add your store */}
              <div className="mt-4 inline-flex items-center gap-3">
                <Link
                  href="/contact"
                  className="rounded-xl bg-[#007A3D] text-white px-4 py-2 text-sm font-semibold hover:opacity-95"
                >
                  Add your store / أضِف متجرك
                </Link>
                <a
                  href="mailto:hello@pca-nw.org"
                  className="rounded-xl bg-white ring-1 ring-neutral-300 px-4 py-2 text-sm font-semibold hover:bg-neutral-50"
                >
                  Email us
                </a>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="mt-6 flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex-1">
              <div className="relative">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="ابحث بالعنوان/الاسم/العنوان • Search title, name or address…"
                  className="w-full rounded-2xl border px-4 py-3 pr-10 focus:outline-none focus:ring-2 focus:ring-[#007A3D]/40"
                  aria-label="Search stores"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400">⌕</span>
              </div>
            </div>
            <div className="inline-flex items-center gap-2">
              <label className="text-sm text-neutral-600">Sort</label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="rounded-2xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#007A3D]/40"
                aria-label="Sort"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="title">Title A–Z</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* GRID */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-16">
        {loading ? (
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-3xl border border-neutral-200 bg-white overflow-hidden animate-pulse">
                <div className="aspect-[16/9] bg-neutral-100" />
                <div className="p-4 space-y-3">
                  <div className="h-5 w-2/3 bg-neutral-100 rounded" />
                  <div className="h-3 w-1/2 bg-neutral-100 rounded" />
                  <div className="h-8 w-32 bg-neutral-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-16 text-center text-neutral-600">
            لا نتائج مطابقة لبحثك — No stores match your search.
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">{cards}</div>
        )}
      </main>

      {/* PREVIEW MODAL — shows ALL media for the selected store */}
      {active ? (
        <div
          ref={modalRef}
          className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm"
          onClick={(e) => { if (e.target === modalRef.current) close(); }}
          aria-modal="true"
          role="dialog"
        >
          <div className="absolute inset-0 p-4 md:p-8">
            <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-neutral-900">
              {/* Header */}
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-neutral-500">STORE</span>
                    <span className="text-[10px] font-bold text-[#007A3D]" dir="rtl">فلسطين</span>
                  </div>
                  <div className="truncate text-sm font-semibold">
                    {active.title}{active.name ? ` • ${active.name}` : ''}
                  </div>
                  {(active.address || active.description) ? (
                    <div className="truncate text-xs text-neutral-600">
                      {active.address ? active.address : active.description}
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/store/${active.slug}`} className="rounded-full border px-3 py-1.5 text-sm hover:bg-neutral-50">
                    التفاصيل • Details
                  </Link>
                  <button onClick={close} className="rounded-full border px-3 py-1.5 text-sm hover:bg-neutral-50" aria-label="Close">
                    ✕
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="relative grid flex-1 grid-cols-1 md:grid-cols-[1fr,320px]">
                <div className="relative bg-black">
                  {loadingMedia ? (
                    <div className="grid h-full place-items-center text-white/70">Loading…</div>
                  ) : media.length === 0 ? (
                    <div className="grid h-full place-items-center text-white/70">No media yet</div>
                  ) : (
                    <>
                      {openIndex != null && media[openIndex] ? (
                        media[openIndex].type === 'video' ? (
                          <video
                            className="h-full w-full object-contain bg-black"
                            src={media[openIndex].url}
                            poster={media[openIndex].thumbUrl || undefined}
                            controls
                            playsInline
                            preload="metadata"
                            autoPlay
                          />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={media[openIndex].url}
                            alt={media[openIndex].title}
                            className="h-full w-full object-contain"
                            loading="eager"
                          />
                        )
                      ) : null}

                      {/* Nav buttons */}
                      {canPrev ? (
                        <button
                          onClick={prev}
                          className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full border bg-white/90 px-3 py-2 text-neutral-900 hover:bg-white transition"
                          aria-label="Previous"
                        >
                          ‹
                        </button>
                      ) : null}
                      {canNext ? (
                        <button
                          onClick={next}
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border bg-white/90 px-3 py-2 text-neutral-900 hover:bg-white transition"
                          aria-label="Next"
                        >
                          ›
                        </button>
                      ) : null}
                    </>
                  )}
                </div>

                {/* Sidebar thumbnails (ALL media) */}
                <aside className="flex h-full flex-col border-l bg-white dark:bg-neutral-900">
                  <div className="p-3">
                    <div className="text-xs font-semibold text-neutral-500 mb-2">Media</div>
                    <div className="grid grid-cols-4 gap-2">
                      {media.map((m, i) => (
                        <button
                          key={m.id}
                          onClick={() => setOpenIndex(i)}
                          className={`relative aspect-square overflow-hidden rounded-md border ${i === openIndex ? 'ring-2 ring-[#007A3D]' : ''}`}
                          title={m.title}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={m.type === 'video' ? (m.thumbUrl || m.url) : m.url}
                            alt={m.title}
                            className="absolute inset-0 h-full w-full object-cover"
                            loading="lazy"
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Current meta */}
                  {openIndex != null && current ? (
                    <div className="mt-auto border-t p-4 space-y-1">
                      <div className="text-xs font-semibold text-neutral-500">Details</div>
                      {current.title ? <div className="text-sm font-medium">{current.title}</div> : null}
                      {current.note ? <div className="text-sm text-neutral-600">{current.note}</div> : null}
                      <div className="text-[11px] text-neutral-500">Use ← → keys • ESC to close</div>
                    </div>
                  ) : null}
                </aside>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <Footer />
    </>
  );
}
