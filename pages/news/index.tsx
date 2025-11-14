// pages/news/index.tsx
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

type MediaItem = {
  url: string;
  type?: 'image' | 'video';
  thumbUrl?: string | null;
};

type RawNews = {
  id?: string;
  slug?: string;
  title?: string;
  excerpt?: string;
  content?: string;
  summary?: string;
  createdAtMillis?: number | null;
  createdAt?: unknown;
  date?: unknown;

  // media & cover
  primaryMediaUrl?: string | null;
  primaryMediaType?: 'image' | 'video' | null;
  primaryMediaThumbUrl?: string | null;
  media?: MediaItem[];

  // counts (optional – we’ll compute if missing)
  mediaCount?: number;
  imageCount?: number;
  videoCount?: number;
};

type NewsItem = {
  id: string;
  slug: string | null;
  title: string;
  excerpt: string | null;
  createdAtMillis: number | null;

  primaryMediaUrl: string | null;
  primaryMediaType: 'image' | 'video' | null;
  primaryMediaThumbUrl: string | null;

  mediaCount: number;
  imageCount: number;
  videoCount: number;

  // for client UI
  dateLabel: string;
};

type FilterTab = 'all' | 'photos' | 'videos';
type SortKey = 'newest' | 'oldest' | 'title';

// ---------------------
// Utils
// ---------------------
async function fetchJSON<T = unknown>(url: string): Promise<T> {
  const r = await fetch(url, { credentials: 'same-origin' });
  const j = await r.json().catch(() => ({}));
  if (!j || (j as any).ok === false) throw new Error((j as any)?.error || 'Request failed');
  return j as T;
}

function isVideoUrl(url: string | null | undefined) {
  const u = (url || '').toLowerCase();
  return /\.(mp4|webm|mov|m4v|avi|mkv|ogg|ogv)$/i.test(u) || /youtube\.com|youtu\.be/.test(u);
}

function toMillis(v: unknown): number | null {
  try {
    if (!v) return null;
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const t = Date.parse(v);
      return Number.isFinite(t) ? t : null;
    }
    // Firestore Timestamp compatibility
    if (typeof (v as any)?.toMillis === 'function') return (v as any).toMillis();
    if (typeof (v as any)?.toDate === 'function') return ((v as any).toDate() as Date).getTime();
    return null;
  } catch {
    return null;
  }
}

// Deterministic date formatting to avoid hydration mismatch
function fmtDateLabel(ms: number | null) {
  if (!ms) return 'No date';
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return 'No date';

  const pad = (n: number) => String(n).padStart(2, '0');
  // Use UTC so SSR and client always match text
  const y = d.getUTCFullYear();
  const m = pad(d.getUTCMonth() + 1);
  const day = pad(d.getUTCDate());
  const hh = pad(d.getUTCHours());
  const mm = pad(d.getUTCMinutes());
  const ss = pad(d.getUTCSeconds());

  return `${day}/${m}/${y}, ${hh}:${mm}:${ss} UTC`;
}

function isNew(ms: number | null, days = 7) {
  if (!ms) return false;
  const age = Date.now() - ms;
  return age >= 0 && age <= days * 24 * 60 * 60 * 1000;
}

function coerceNewsItem(x: RawNews): NewsItem {
  const id = String(x.id || x.slug || '');
  const slug = x.slug ?? (x.id ? String(x.id) : null);
  const title = String(x.title || 'Untitled');
  const excerpt =
    (x.excerpt || x.summary || x.content || '')
      ? String(x.excerpt || x.summary || x.content || '').slice(0, 200)
      : null;

  const createdAtMillis =
    toMillis(x.createdAtMillis) ??
    toMillis(x.createdAt) ??
    toMillis(x.date) ??
    null;

  // primary media fields (direct if given)
  let primaryMediaUrl = x.primaryMediaUrl ?? null;
  let primaryMediaType: 'image' | 'video' | null = x.primaryMediaType ?? null;
  let primaryMediaThumbUrl = x.primaryMediaThumbUrl ?? null;

  // counts (compute if missing)
  let imageCount = x.imageCount ?? 0;
  let videoCount = x.videoCount ?? 0;
  let mediaCount = x.mediaCount ?? 0;

  const media = Array.isArray(x.media) ? x.media : [];

  if (media.length) {
    if (!x.mediaCount || !x.imageCount || !x.videoCount) {
      let img = 0, vid = 0;
      for (const m of media) {
        const t = (m?.type as unknown) || (isVideoUrl(m?.url) ? 'video' : 'image');
        if (t === 'video') vid++; else img++;
      }
      imageCount = x.imageCount ?? img;
      videoCount = x.videoCount ?? vid;
      mediaCount = x.mediaCount ?? (img + vid);
    }

    if (!primaryMediaUrl && media.length) {
      const vid = media.find(
        (m) => (m.type || (isVideoUrl(m.url) ? 'video' : 'image')) === 'video'
      );
      const first = media[0];
      const sel = vid || first;
      primaryMediaUrl = sel?.url || null;
      primaryMediaType = (sel?.type as any) || (isVideoUrl(sel?.url) ? 'video' : 'image');
      primaryMediaThumbUrl = (sel?.thumbUrl as any) || null;
    }
  }

  if (!primaryMediaType && primaryMediaUrl) {
    primaryMediaType = isVideoUrl(primaryMediaUrl) ? 'video' : 'image';
  }

  return {
    id,
    slug,
    title,
    excerpt,
    createdAtMillis,
    primaryMediaUrl: primaryMediaUrl || null,
    primaryMediaType: primaryMediaType || null,
    primaryMediaThumbUrl: primaryMediaThumbUrl || null,
    mediaCount: mediaCount || 0,
    imageCount: imageCount || 0,
    videoCount: videoCount || 0,
    dateLabel: fmtDateLabel(createdAtMillis),
  };
}

// ---------------------
// Small UI bits (styling aligned with donation cards)
// ---------------------
function Badge({
  children,
  tone = 'neutral',
  title,
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'green' | 'red' | 'dark' | 'white';
  title?: string;
}) {
  const toneClasses: Record<string, string> = {
    neutral: 'bg-white/90 text-neutral-800 border',
    green: 'bg-[#007A3D] text-white border border-[#007A3D]',
    red: 'bg-[#CE1126] text-white border border-[#CE1126]',
    dark: 'bg-neutral-900/85 text-white border border-neutral-900/85',
    white: 'bg-white text-neutral-800 border',
  };
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}

function FlagAccent() {
  return (
    <div className="h-1 w-full bg-gradient-to-r from-[#CE1126] via-white to-[#007A3D]" />
  );
}

export default function NewsIndexPage() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterTab>('all');
  const [sort, setSort] = useState<SortKey>('newest');
  const [copyingId, setCopyingId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const j = await fetchJSON<{ items: RawNews[] }>('/api/news/list?limit=120');
        const rows = (j.items || []).map(coerceNewsItem);
        if (mounted) setItems(rows);
      } catch (e) {
        console.error(e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    // Exclude any news item with no media at all
    let list = [...items].filter(
      (n) => (n.imageCount || 0) > 0 || (n.videoCount || 0) > 0 || !!n.primaryMediaUrl
    );

    // Filter: photos / videos
    if (filter === 'photos') {
      list = list.filter((n) => (n.imageCount || 0) > 0);
    } else if (filter === 'videos') {
      list = list.filter((n) => (n.videoCount || 0) > 0);
    }

    // Search in title + excerpt
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.excerpt?.toLowerCase?.().includes(q)
      );
    }

    // Sort by createdAtMillis or title
    list.sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title);
      const am = a.createdAtMillis || 0;
      const bm = b.createdAtMillis || 0;
      return sort === 'newest' ? bm - am : am - bm;
    });

    return list;
  }, [items, filter, query, sort]);

  async function copyLink(n: NewsItem) {
    try {
      setCopyingId(n.id);
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const target = n.slug ? `/news/${n.slug}` : `/news/${n.id}`;
      await navigator.clipboard.writeText(`${origin}${target}`);
    } catch {
      /* ignore */
    } finally {
      setTimeout(() => setCopyingId(null), 1000);
    }
  }

  async function shareLink(n: NewsItem) {
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const target = n.slug ? `/news/${n.slug}` : `/news/${n.id}`;
      const url = `${origin}${target}`;
      if ((navigator as any).share) {
        await (navigator as any).share({ title: n.title, text: n.excerpt || n.title, url });
      } else {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      /* ignore */
    }
  }

  // ---------------------
  // Cards (Donation-style)
  // ---------------------
  const cards = useMemo(
    () =>
      filtered.map((n) => {
        const href = n.slug ? `/news/${n.slug}` : `/news/${n.id}`;

        const hasCover = !!n.primaryMediaUrl;
        const isVid =
          n.primaryMediaType === 'video' || isVideoUrl(n.primaryMediaUrl);
        const cover = isVid
          ? n.primaryMediaThumbUrl || n.primaryMediaUrl
          : n.primaryMediaUrl;

        const counts = `${n.imageCount || 0} photos · ${n.videoCount || 0} videos`;

        return (
          <article
            key={n.id}
            className="group relative overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm hover:shadow-2xl transition-all duration-300 hover:-translate-y-0.5"
          >
            {/* Media */}
            <div className="relative aspect-[16/9] w-full bg-neutral-100">
              {hasCover && cover ? (
                <Image
                  src={cover}
                  alt={n.title}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                  sizes="(max-width:768px) 100vw, (max-width:1024px) 50vw, 33vw"
                  priority={false}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-neutral-400">
                  No cover
                </div>
              )}

              {/* Overlay gradient & chips */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent pointer-events-none" />
              <div className="absolute top-3 left-3 flex flex-wrap gap-2">
                {isVid ? (
                  <Badge tone="red" title="Contains video">VIDEO</Badge>
                ) : (
                  <Badge tone="green" title="Article with images">ARTICLE</Badge>
                )}
                {isNew(n.createdAtMillis) && <Badge tone="white">NEW</Badge>}
              </div>
              <div className="absolute top-3 right-3">
                <Badge tone="white" title="Total media items">
                  {n.mediaCount} item{n.mediaCount === 1 ? '' : 's'}
                </Badge>
              </div>
            </div>

            {/* Flag accent to mirror donation cards */}
            <FlagAccent />

            {/* Body */}
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg md:text-xl font-extrabold leading-tight line-clamp-2">
                    {n.title}
                  </h3>
                  <time
                    className="mt-1 block text-xs text-neutral-500"
                    dateTime={n.createdAtMillis ? new Date(n.createdAtMillis).toISOString() : undefined}
                    suppressHydrationWarning
                  >
                    {n.dateLabel}
                  </time>
                  <div className="mt-1 text-[11px] text-neutral-500">{counts}</div>
                </div>

                {/* Actions (match donation UI: copy/share icon buttons) */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => copyLink(n)}
                    title="Copy public link"
                    aria-label="Copy public link"
                    className="inline-flex items-center justify-center h-9 w-9 rounded-xl border hover:bg-neutral-50"
                  >
                    {copyingId === n.id ? '✓' : '⧉'}
                  </button>
                  <button
                    onClick={() => shareLink(n)}
                    title="Share"
                    aria-label="Share"
                    className="inline-flex items-center justify-center h-9 w-9 rounded-xl border hover:bg-neutral-50"
                  >
                    ↗
                  </button>
                </div>
              </div>

              {n.excerpt ? (
                <p className="mt-2 text-sm text-neutral-600 line-clamp-2">{n.excerpt}</p>
              ) : null}

              {/* CTA */}
              <div className="mt-4 flex items-center gap-2">
                <Link
                  href={href}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#007A3D] text-white px-4 py-2 text-sm font-semibold hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#007A3D]"
                >
                  Read article <span aria-hidden>→</span>
                </Link>
                <Link
                  href={href}
                  className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm hover:bg-neutral-50"
                >
                  View media
                </Link>
              </div>
            </div>
          </article>
        );
      }),
    [filtered, copyingId]
  );

  return (
    <>
      <Head>
        <title>News — Palestinian Community Association</title>
        <meta
          name="description"
          content="Browse all published news with images and videos."
        />
      </Head>

      <Navbar />

      {/* Header: (aligned with Events/Donations tone) */}
      <section className="pt-28 md:pt-32 pb-8 bg-gradient-to-b from-neutral-50 to-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-neutral-900">
              News
            </h1>
            <p className="mt-2 text-neutral-600">
              Published articles with images and videos.
            </p>
          </div>

          {/* Controls */}
          <div className="mt-6 flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex-1">
              <div className="relative">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search news by title or excerpt…"
                  className="w-full rounded-2xl border px-4 py-3 pr-10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400">
                  ⌕
                </span>
              </div>
            </div>

            <div className="inline-flex rounded-2xl border overflow-hidden">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 text-sm ${
                  filter === 'all'
                    ? 'bg-neutral-900 text-white'
                    : 'bg-white hover:bg-neutral-50'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('photos')}
                className={`px-4 py-2 text-sm border-l ${
                  filter === 'photos'
                    ? 'bg-[#007A3D] text-white'
                    : 'bg-white hover:bg-neutral-50'
                }`}
              >
                Photos
              </button>
              <button
                onClick={() => setFilter('videos')}
                className={`px-4 py-2 text-sm border-l ${
                  filter === 'videos'
                    ? 'bg-[#CE1126] text-white'
                    : 'bg-white hover:bg-neutral-50'
                }`}
              >
                Videos
              </button>
            </div>

            <div>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="rounded-2xl border px-3 py-2 text-sm"
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

      {/* Grid */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-16">
        {loading ? (
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-3xl border border-neutral-200 bg-white overflow-hidden animate-pulse"
              >
                <div className="aspect-[16/9] bg-neutral-100" />
                <FlagAccent />
                <div className="p-5 space-y-3">
                  <div className="h-5 w-2/3 bg-neutral-100 rounded" />
                  <div className="h-3 w-1/2 bg-neutral-100 rounded" />
                  <div className="h-8 w-32 bg-neutral-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-16 text-center text-neutral-600">
            No news match your filters.
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {cards}
          </div>
        )}
      </main>

      <Footer />
    </>
  );
}
