// pages/events/index.tsx
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

type EventItem = {
  id: string;
  title: string;
  description: string;
  dateISO: string | null;
  location: string | null;
  primaryMediaUrl: string | null;
  primaryMediaType?: 'image' | 'video' | null;
  primaryMediaThumbUrl?: string | null;
  mediaCount: number;
  imageCount: number;
  videoCount: number;
  slug?: string | null;
};

type FilterTab = 'all' | 'upcoming' | 'past';
type SortKey = 'newest' | 'oldest' | 'title';

async function fetchJSON<T = unknown>(url: string): Promise<T> {
  const r = await fetch(url, { credentials: 'same-origin' });
  const j = await r.json().catch(() => ({}));
  if (!j || (j as any).ok === false) throw new Error((j as any)?.error || 'Request failed');
  return j as T;
}
function isVideoUrl(url: string | null | undefined) {
  const u = (url || '').toLowerCase();
  return /\.(mp4|webm|mov|m4v|avi|mkv)$/i.test(u);
}

/** Inline SVG icons (no extra dependencies) */
function IconCalendar(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
function IconClock(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 16 14" />
    </svg>
  );
}
function IconMapPin(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M21 10c0 5-9 12-9 12S3 15 3 10a9 9 0 1 1 18 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export default function EventsIndexPage() {
  const [items, setItems] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterTab>('all');
  const [sort, setSort] = useState<SortKey>('newest');
  const [copyingId, setCopyingId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const j = await fetchJSON<{ items: EventItem[] }>('/api/events/list?limit=120');
        if (mounted) setItems(j.items || []);
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

  const nowMs = Date.now();

  const filtered = useMemo(() => {
    let list = [...items];

    if (filter !== 'all') {
      list = list.filter((ev) => {
        const t = ev.dateISO ? new Date(ev.dateISO).getTime() : null;
        if (!t) return filter === 'past';
        return filter === 'upcoming' ? t >= nowMs : t < nowMs;
      });
    }

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (ev) =>
          ev.title.toLowerCase().includes(q) ||
          ev.description?.toLowerCase?.().includes(q) ||
          ev.location?.toLowerCase?.().includes(q),
      );
    }

    list.sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title);
      const am = a.dateISO ? new Date(a.dateISO).getTime() : 0;
      const bm = b.dateISO ? new Date(b.dateISO).getTime() : 0;
      return sort === 'newest' ? bm - am : am - bm;
    });

    return list;
  }, [items, filter, query, sort, nowMs]);

  async function copyLink(ev: EventItem) {
    try {
      setCopyingId(ev.id);
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const target = ev.slug ? `/events/${ev.slug}` : `/events/${ev.id}`;
      await navigator.clipboard.writeText(`${origin}${target}`);
    } catch {
      /* ignore */
    } finally {
      setTimeout(() => setCopyingId(null), 1000);
    }
  }

  async function shareLink(ev: EventItem) {
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const target = ev.slug ? `/events/${ev.slug}` : `/events/${ev.id}`;
      const url = `${origin}${target}`;
      if (navigator.share) {
        await navigator.share({ title: ev.title, text: ev.description || ev.title, url });
      } else {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      /* ignore */
    }
  }

  const cards = useMemo(
    () =>
      filtered.map((ev) => {
        const hasCover = !!ev.primaryMediaUrl;
        const isVid = ev.primaryMediaType === 'video' || isVideoUrl(ev.primaryMediaUrl);
        const cover = isVid ? ev.primaryMediaThumbUrl || ev.primaryMediaUrl : ev.primaryMediaUrl;

        const dateObj = ev.dateISO ? new Date(ev.dateISO) : null;
        const dateStr = dateObj
          ? dateObj.toLocaleDateString(undefined, {
              weekday: 'short',
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })
          : null;
        const timeStr = dateObj
          ? dateObj.toLocaleTimeString(undefined, {
              hour: '2-digit',
              minute: '2-digit',
            })
          : null;

        const counts = `${ev.imageCount || 0} photos · ${ev.videoCount || 0} videos`;
        const isUpcoming = ev.dateISO ? new Date(ev.dateISO).getTime() >= nowMs : false;
        const href = ev.slug ? `/events/${ev.slug}` : `/events/${ev.id}`;

        const showProminentRow = !!dateObj || !!ev.location;

        return (
          <div
            key={ev.id}
            className="group rounded-3xl border border-neutral-200 bg-white overflow-hidden hover:shadow-2xl transition"
          >
            <div className="relative aspect-[16/9] w-full bg-neutral-100">
              {hasCover && cover ? (
                <Image
                  src={cover}
                  alt={ev.title}
                  fill
                  className="object-cover transition group-hover:scale-[1.02]"
                  sizes="(max-width:768px) 100vw, (max-width:1024px) 50vw, 33vw"
                  priority={false}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-neutral-400">
                  No cover
                </div>
              )}

              <div
                className={`absolute top-3 left-3 rounded-full px-2.5 py-1 text-xs border ${
                  isUpcoming
                    ? 'bg-[#007A3D] text-white border-[#007A3D]'
                    : 'bg-neutral-900/85 text-white border-neutral-900/85'
                }`}
              >
                {isUpcoming ? 'Upcoming' : 'Past'}
              </div>
              <div className="absolute top-3 right-3 rounded-full px-2.5 py-1 text-xs bg-white/95 text-neutral-800 border">
                {ev.mediaCount} item{ev.mediaCount === 1 ? '' : 's'}
              </div>
            </div>

            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg md:text-xl font-extrabold leading-tight line-clamp-2">
                    {ev.title}
                  </h3>

                  {/* Prominent green date, time, and address row with icons */}
                  {showProminentRow ? (
                    <div className="mt-2 flex flex-wrap items-center gap-4 text-[#007A3D]">
                      {dateObj && (
                        <div className="inline-flex items-center gap-2 text-lg md:text-xl font-semibold">
                          <IconCalendar className="h-5 w-5 md:h-6 md:w-6" />
                          <span aria-label="Event date">{dateStr}</span>
                        </div>
                      )}
                      {dateObj && (
                        <div className="inline-flex items-center gap-2 text-lg md:text-xl font-semibold">
                          <IconClock className="h-5 w-5 md:h-6 md:w-6" />
                          <span aria-label="Event time">{timeStr}</span>
                        </div>
                      )}
                      {ev.location && (
                        <div className="inline-flex items-center gap-2 text-lg md:text-xl font-semibold">
                          <IconMapPin className="h-5 w-5 md:h-6 md:w-6" />
                          <span aria-label="Event address">{ev.location}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-2 text-sm text-neutral-500">No date</div>
                  )}

                  <div className="mt-1 text-[11px] text-neutral-500">{counts}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => copyLink(ev)}
                    title="Copy public link"
                    className="inline-flex items-center justify-center h-9 w-9 rounded-xl border hover:bg-neutral-50"
                  >
                    {copyingId === ev.id ? '✓' : '⧉'}
                  </button>
                  <button
                    onClick={() => shareLink(ev)}
                    title="Share"
                    className="inline-flex items-center justify-center h-9 w-9 rounded-xl border hover:bg-neutral-50"
                  >
                    ↗
                  </button>
                </div>
              </div>

              {ev.description ? (
                <p className="mt-2 text-sm text-neutral-600 line-clamp-2">{ev.description}</p>
              ) : null}

              <div className="mt-3 flex items-center gap-2">
                <Link
                  href={href}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#007A3D] text-white px-4 py-2 text-sm hover:brightness-110"
                >
                  View event <span aria-hidden>→</span>
                </Link>
              </div>
            </div>
          </div>
        );
      }),
    [filtered, copyingId, nowMs],
  );

  return (
    <>
      <Head>
        <title>Events — Palestinian Community Association</title>
        <meta name="description" content="Browse all published events with photos and videos." />
      </Head>
      <Navbar />
      <section className="pt-28 md:pt-32 pb-8 bg-gradient-to-b from-neutral-50 to-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-neutral-900">
              Events
            </h1>
            <p className="mt-2 text-neutral-600">Published events with images and videos.</p>
          </div>
          {/* Controls */}
          <div className="mt-6 flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex-1">
              <div className="relative">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search events by title, description, or location…"
                  className="w-full rounded-2xl border px-4 py-3 pr-10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400">⌕</span>
              </div>
            </div>
            <div className="inline-flex rounded-2xl border overflow-hidden">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 text-sm ${
                  filter === 'all' ? 'bg-neutral-900 text-white' : 'bg-white hover:bg-neutral-50'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('upcoming')}
                className={`px-4 py-2 text-sm border-l ${
                  filter === 'upcoming' ? 'bg-[#007A3D] text-white' : 'bg-white hover:bg-neutral-50'
                }`}
              >
                Upcoming
              </button>
              <button
                onClick={() => setFilter('past')}
                className={`px-4 py-2 text-sm border-l ${
                  filter === 'past' ? 'bg-[#CE1126] text-white' : 'bg-white hover:bg-neutral-50'
                }`}
              >
                Past
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
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-16">
        {loading ? (
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-3xl border border-neutral-200 bg-white overflow-hidden animate-pulse"
              >
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
          <div className="mt-16 text-center text-neutral-600">No events match your filters.</div>
        ) : (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">{cards}</div>
        )}
      </main>
      <Footer />
    </>
  );
}
