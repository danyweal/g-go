// pages/store/[slug].tsx
import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

// ===== Types must match API shapes =====
// /api/store/[slug] -> { ok: boolean; item: Album }
// /api/store/media-list -> { ok: boolean; items: MediaItem[] }

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
  url: string; // API provides url (alias of downloadUrl)
  type: 'image' | 'video' | 'other';
  thumbUrl: string | null;
  title: string;
  note?: string;
  createdAtMillis: number | null;
};

type FilterTab = 'all' | 'image' | 'video';

type SortKey = 'newest' | 'oldest';

function useKey(key: string, handler: () => void) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if (e.key === key) handler(); };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [key, handler]);
}

function formatDate(millis: number | null) {
  if (!millis) return '';
  const d = new Date(millis);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function mapLinkFromAddress(address?: string) {
  if (!address) return null;
  const q = encodeURIComponent(address);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

function cls(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(' ');
}

export default function StoreDetailPage() {
  const router = useRouter();
  const { slug } = router.query as { slug?: string };

  const [album, setAlbum] = useState<Album | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<FilterTab>('all');
  const [sort, setSort] = useState<SortKey>('newest');

  const [copied, setCopied] = useState(false);

  // Lightbox
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);

  // Derived gallery (filter + sort). Exclude 'other' types from display.
  const gallery = useMemo(() => {
    const base = media.filter((m) => m.type === 'image' || m.type === 'video');
    const filtered = tab === 'all' ? base : base.filter((m) => m.type === tab);
    filtered.sort((a, b) => {
      const am = a.createdAtMillis ?? 0;
      const bm = b.createdAtMillis ?? 0;
      return sort === 'newest' ? bm - am : am - bm;
    });
    return filtered;
  }, [media, tab, sort]);

  const canPrev = openIndex !== null && openIndex > 0;
  const canNext = openIndex !== null && openIndex < gallery.length - 1;
  const prev = () => canPrev && setOpenIndex((i) => (i == null ? i : i - 1));
  const next = () => canNext && setOpenIndex((i) => (i == null ? i : i + 1));
  const close = () => setOpenIndex(null);
  useKey('Escape', close);
  useKey('ArrowLeft', prev);
  useKey('ArrowRight', next);

  useEffect(() => {
    if (!slug) return;
    let mounted = true;
    (async () => {
      try {
        // 1) Fetch store meta (title, address, cover, etc.)
        const meta = await fetch(`/api/store/${encodeURIComponent(slug)}`);
        const mj = await meta.json();
        if (mounted && mj?.ok) {
          setAlbum(mj.item as Album);
        }

        // 2) Fetch **ALL** media (images + videos) via media-list API
        const r = await fetch(`/api/store/media-list?slug=${encodeURIComponent(slug)}&all=1`);
        const j = await r.json();
        if (mounted && j?.ok) {
          setMedia((j.items || []) as MediaItem[]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [slug]);

  // Prefer true counts from loaded media; fall back to album counts if media not yet loaded
  const countsLabel = useMemo(() => {
    const img = media.filter((m) => m.type === 'image').length;
    const vid = media.filter((m) => m.type === 'video').length;
    if (img + vid > 0) return `${img} photos · ${vid} videos`;
    if (!album) return '';
    return `${album.imageCount || 0} photos · ${album.videoCount || 0} videos`;
  }, [media, album]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/store/${album?.slug || ''}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  }

  async function shareLink() {
    try {
      const url = `${window.location.origin}/store/${album?.slug || ''}`;
      if (navigator.share) {
        await navigator.share({ title: album?.title || 'Store', text: album?.description || '', url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }
    } catch {}
  }

  const FlagBar = () => (
    <div className="w-full h-1.5 flex">
      <div className="flex-1 bg-black" />
      <div className="flex-1 bg-white" />
      <div className="flex-1 bg-[#007A3D]" />
      <div className="flex-1 bg-[#D32F2F]" />
    </div>
  );

  const heroImage =
    album?.primaryMediaType === 'video'
      ? (album.primaryMediaThumbUrl || album.primaryMediaUrl)
      : album?.primaryMediaUrl || null;

  return (
    <>
      <Head>
        <title>{album ? `${album.title} — Community Store` : 'Store — Palestinian Community Association'}</title>
        <meta name="description" content={album?.description || 'Discover and support community stores in North West UK.'} />
        <meta property="og:title" content={album ? `${album.title} — Store` : 'Store'} />
        <meta property="og:description" content={album?.description || 'Discover and support community stores.'} />
        {heroImage ? <meta property="og:image" content={heroImage} /> : null}
      </Head>

      <Navbar />
      <div className="pt-20"><FlagBar /></div>

      {/* BREADCRUMBS */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-4">
        <nav aria-label="Breadcrumb" className="text-sm text-neutral-600">
          <Link href="/" className="hover:underline">Home</Link>
          <span className="mx-2">/</span>
          <Link href="/store" className="hover:underline">Store</Link>
          {album ? (<><span className="mx-2">/</span><span className="text-neutral-900 font-semibold">{album.title}</span></>) : null}
        </nav>
      </div>

      {/* HERO */}
      <section className="mt-4">
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-neutral-50">
            <div className="relative aspect-[16/7] w-full">
              {heroImage ? (
                <Image
                  src={heroImage}
                  alt={album?.title || 'Cover'}
                  fill
                  className="object-cover"
                  priority
                  sizes="100vw"
                />
              ) : (
                <div className="absolute inset-0 grid place-items-center text-neutral-400">No cover yet</div>
              )}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
            </div>

            {/* Overlay info card */}
            <div className="absolute bottom-4 left-4 right-4">
              <div className="max-w-4xl rounded-2xl bg-white/95 backdrop-blur px-5 py-4 ring-1 ring-black/10">
                <div className="flex flex-wrap items-center gap-3">
                  <Image src="/logo.jpg" alt="PCA" width={40} height={34} className="rounded shadow ring-1 ring-black/5" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-[#007A3D]" dir="rtl">PCA(NW)</span>
                      <span className="text-xs font-semibold text-neutral-500">STORE / SERVICES</span>
                    </div>
                    <h1 className="truncate text-2xl md:text-3xl font-extrabold text-neutral-900">
                      {album?.title || 'Store'}
                    </h1>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-neutral-700">
                      {album?.name ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 ring-1 ring-neutral-200">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 12a5 5 0 1 0-4.999-5A5 5 0 0 0 12 12Zm0 2c-4.418 0-8 2.239-8 5v1h16v-1c0-2.761-3.582-5-8-5Z" stroke="currentColor" strokeWidth="1.5"/></svg>
                          <span dir="rtl" className="font-semibold">{album.name}</span>
                        </span>
                      ) : null}
                      {album?.address ? (
                        <a
                          target="_blank" rel="noreferrer"
                          href={mapLinkFromAddress(album.address) || '#'}
                          className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 ring-1 ring-neutral-200 hover:bg-neutral-50"
                          title="Open in Maps"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5a2.5 2.5 0 1 1 .001-5.001A2.5 2.5 0 0 1 12 11.5Z" stroke="currentColor" strokeWidth="1.5"/></svg>
                          <span dir="rtl" className="truncate">{album.address}</span>
                        </a>
                      ) : null}
                    </div>
                  </div>

                  {/* actions */}
                  <div className="ml-auto flex items-center gap-2">
                    <a
                      href={album?.address ? mapLinkFromAddress(album.address) || '#' : '#'}
                      target={album?.address ? '_blank' : undefined}
                      rel="noreferrer"
                      className={cls('rounded-xl px-3 py-1.5 text-sm border hover:bg-neutral-50', album?.address ? '' : 'pointer-events-none opacity-50')}
                    >
                      Directions
                    </a>
                    <button onClick={shareLink} className="rounded-xl border px-3 py-1.5 text-sm hover:bg-neutral-50">Share ↗</button>
                    <button onClick={copyLink} className="rounded-xl border px-3 py-1.5 text-sm hover:bg-neutral-50">Copy ⧉</button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-neutral-600">
                  {album?.createdAtMillis ? <span>Created: {formatDate(album.createdAtMillis)}</span> : null}
                  {countsLabel ? (<><span className="mx-1.5">•</span><span>{countsLabel}</span></>) : null}
                </div>
              </div>
            </div>
          </div>

          {/* Quick media strip (ALL uploaded media horizontally scrollable) */}
          {media.filter((m) => m.type === 'image' || m.type === 'video').length > 0 && (
            <div className="relative mt-3 rounded-2xl border bg-white px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Latest uploads</div>
                <a href="#gallery" className="text-sm text-[#007A3D] font-semibold hover:underline">View all</a>
              </div>
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                {media.filter((m) => m.type === 'image' || m.type === 'video').map((m, idx) => (
                  <button
                    key={m.id}
                    onClick={() => setOpenIndex(idx)}
                    className="relative h-20 w-32 shrink-0 overflow-hidden rounded-lg border"
                    title={m.title}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={m.type === 'video' ? (m.thumbUrl || m.url) : m.url}
                      alt={m.title}
                      className="absolute inset-0 h-full w-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute left-1 top-1 rounded bg-white/90 px-1 text-[10px] ring-1 ring-black/10">
                      {m.type === 'video' ? 'Video' : 'Photo'}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Copied toast */}
      <div
        className={cls(
          'fixed left-1/2 -translate-x-1/2 top-24 z-[70] rounded-full bg-black text-white px-3 py-1 text-sm transition-opacity',
          copied ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        aria-live="polite"
      >
        Link copied
      </div>

      {/* ABOUT + DETAILS */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr,360px] gap-8">
          <div>
            <h2 className="text-xl font-extrabold text-neutral-900">عن المتجر • About</h2>
            <p className="mt-2 text-neutral-700 leading-relaxed">
              {album?.description || 'Discover authentic products and services from our community.'}
            </p>
          </div>

          <aside className="rounded-2xl border bg-white">
            <div className="border-b px-4 py-3">
              <h3 className="font-semibold">Details</h3>
            </div>
            <dl className="divide-y">
              <div className="px-4 py-3 grid grid-cols-[120px,1fr] gap-3 text-sm">
                <dt className="text-neutral-500">Title</dt>
                <dd className="font-medium">{album?.title || '-'}</dd>
              </div>
              <div className="px-4 py-3 grid grid-cols-[120px,1fr] gap-3 text-sm">
                <dt className="text-neutral-500">Name</dt>
                <dd>{album?.name || '-'}</dd>
              </div>
              <div className="px-4 py-3 grid grid-cols-[120px,1fr] gap-3 text-sm">
                <dt className="text-neutral-500">Address</dt>
                <dd className="break-words">
                  {album?.address ? (
                    <a className="hover:underline" href={mapLinkFromAddress(album.address) || '#'} target="_blank" rel="noreferrer">
                      {album.address}
                    </a>
                  ) : '-'}
                </dd>
              </div>
              <div className="px-4 py-3 grid grid-cols-[120px,1fr] gap-3 text-sm">
                <dt className="text-neutral-500">Media</dt>
                <dd>{countsLabel || '-'}</dd>
              </div>
              {album?.createdAtMillis ? (
                <div className="px-4 py-3 grid grid-cols-[120px,1fr] gap-3 text-sm">
                  <dt className="text-neutral-500">Created</dt>
                  <dd>{formatDate(album.createdAtMillis)}</dd>
                </div>
              ) : null}
            </dl>
            <div className="border-t px-4 py-3 flex flex-wrap items-center gap-2">
              <Link href="/store" className="rounded-xl border px-3 py-1.5 text-sm hover:bg-neutral-50">← Back to Store</Link>
              <a
                href={album?.address ? mapLinkFromAddress(album.address) || '#' : '#'}
                target={album?.address ? '_blank' : undefined}
                rel="noreferrer"
                className={cls('rounded-xl border px-3 py-1.5 text-sm hover:bg-neutral-50', album?.address ? '' : 'pointer-events-none opacity-50')}
              >
                Open in Maps
              </a>
              <button onClick={shareLink} className="ml-auto rounded-xl border px-3 py-1.5 text-sm hover:bg-neutral-50">Share</button>
            </div>
          </aside>
        </div>
      </section>

      {/* GALLERY CONTROLS */}
      <section id="gallery" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <h2 className="text-xl font-extrabold text-neutral-900">المعرض • Gallery</h2>

          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-full border p-1 bg-white">
              {(['all', 'image', 'video'] as FilterTab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cls(
                    'px-3 py-1.5 text-sm rounded-full',
                    tab === t ? 'bg-[#007A3D] text-white' : 'text-neutral-700 hover:bg-neutral-50'
                  )}
                >
                  {t === 'all' ? 'All' : t === 'image' ? 'Photos' : 'Videos'}
                </button>
              ))}
            </div>

            <div className="inline-flex items-center gap-2">
              <label className="text-sm text-neutral-600">Sort</label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#007A3D]/40"
                aria-label="Sort"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* GALLERY GRID (ALL media after filter/sort) */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-14">
        {loading ? (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-xl border bg-neutral-100 animate-pulse" />
            ))}
          </div>
        ) : gallery.length === 0 ? (
          <div className="mt-8 text-neutral-600">No media to show.</div>
        ) : (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {gallery.map((m, i) => (
              <button
                key={m.id}
                onClick={() => setOpenIndex(i)}
                className="group relative aspect-square overflow-hidden rounded-xl border bg-neutral-50"
                title={m.title}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={m.type === 'video' ? (m.thumbUrl || m.url) : m.url}
                  alt={m.title}
                  className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-[1.02]"
                  loading="lazy"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition" />
                <div className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[11px] ring-1 ring-black/10">
                  {m.type === 'video' ? 'Video' : 'Photo'}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* LIGHTBOX (ALL media) */}
      {openIndex != null && gallery[openIndex] ? (
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
                  <div className="truncate text-sm font-semibold">{album?.title}</div>
                  {album?.address ? <div className="truncate text-xs text-neutral-600">{album.address}</div> : null}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={prev} disabled={!canPrev} className="rounded-full border px-3 py-1.5 text-sm disabled:opacity-40">‹</button>
                  <button onClick={next} disabled={!canNext} className="rounded-full border px-3 py-1.5 text-sm disabled:opacity-40">›</button>
                  <button onClick={close} className="rounded-full border px-3 py-1.5 text-sm">✕</button>
                </div>
              </div>

              {/* Viewer */}
              <div className="relative grid flex-1 grid-cols-1 md:grid-cols-[1fr,320px]">
                <div className="relative bg-black">
                  {gallery[openIndex].type === 'video' ? (
                    <video
                      className="h-full w-full object-contain bg-black"
                      src={gallery[openIndex].url}
                      poster={gallery[openIndex].thumbUrl || undefined}
                      controls
                      playsInline
                      preload="metadata"
                      autoPlay
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={gallery[openIndex].url}
                      alt={gallery[openIndex].title}
                      className="h-full w-full object-contain"
                    />
                  )}
                </div>

                {/* Thumbnails + meta (ALL media) */}
                <aside className="flex h-full flex-col border-l bg-white dark:bg-neutral-900">
                  <div className="p-3">
                    <div className="text-xs font-semibold text-neutral-500 mb-2">Media</div>
                    <div className="grid grid-cols-4 gap-2">
                      {gallery.map((m, i) => (
                        <button
                          key={m.id}
                          onClick={() => setOpenIndex(i)}
                          className={cls('relative aspect-square overflow-hidden rounded-md border', i === openIndex ? 'ring-2 ring-[#007A3D]' : '')}
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

                  <div className="mt-auto border-t p-4 space-y-1">
                    <div className="text-xs font-semibold text-neutral-500">Details</div>
                    {gallery[openIndex].title ? <div className="text-sm font-medium">{gallery[openIndex].title}</div> : null}
                    {gallery[openIndex].note ? <div className="text-sm text-neutral-600">{gallery[openIndex].note}</div> : null}
                    <div className="text-[11px] text-neutral-500">Use ← → keys • ESC to close</div>
                  </div>
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
