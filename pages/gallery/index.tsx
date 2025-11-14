// pages/gallery/index.tsx
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

type Album = {
  id: string;
  title: string;
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

type SortKey = 'newest' | 'oldest' | 'title';

export default function GalleryIndexPage() {
  const [items, setItems] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');
  const [copyingId, setCopyingId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await fetch('/api/gallery/list?limit=100');
        const j = await r.json();
        if (mounted && j?.ok) setItems(j.items || []);
      } catch {
        // ignore
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    let list = [...items];

    // search
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.description?.toLowerCase?.().includes(q) ||
          a.slug.toLowerCase().includes(q)
      );
    }

    // sort
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
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const url = `${origin}/gallery/${a.slug}`;
      await navigator.clipboard.writeText(url);
    } catch {
      // ignore
    } finally {
      setTimeout(() => setCopyingId(null), 900);
    }
  }

  async function shareLink(a: Album) {
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const url = `${origin}/gallery/${a.slug}`;
      if (navigator.share) {
        await navigator.share({ title: a.title, text: a.description || a.title, url });
      } else {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      // ignore
    }
  }

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

              {/* subtle gradient overlay */}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition" />

              {/* Type badge */}
              {a.primaryMediaType ? (
                <div className="absolute top-3 left-3 rounded-full px-2.5 py-1 text-xs bg-neutral-900/80 text-white backdrop-blur-sm">
                  {a.primaryMediaType === 'video' ? 'Video cover' : 'Photo cover'}
                </div>
              ) : null}

              {/* Count badge */}
              <div className="absolute top-3 right-3 rounded-full px-2.5 py-1 text-xs bg-white/95 text-neutral-800 border backdrop-blur-sm">
                {a.mediaCount} item{a.mediaCount === 1 ? '' : 's'}
              </div>

              {/* New badge */}
              {fresh ? (
                <div className="absolute bottom-3 left-3 rounded-full px-2.5 py-1 text-xs bg-emerald-500 text-white shadow">
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
                <Link
                  href={`/gallery/${a.slug}`}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm text-white bg-neutral-900 hover:bg-neutral-800 active:scale-[0.99] transition"
                >
                  View all <span aria-hidden>→</span>
                </Link>

              </div>
            </div>
          </div>
        );
      }),
    [filtered, copyingId]
  );

  return (
    <>
      <Head>
        <title>Rawah Ana — gaza go</title>
        <meta name="description" content="Explore our published photo and video albums." />
      </Head>

      <Navbar />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1200px_600px_at_50%_-100px,rgba(0,0,0,0.06),transparent)]" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-28 md:pt-32 pb-10">
          <div className="max-w-3xl">
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-neutral-900">
              Rawah Ana Podcast:
            </h1>
            <p className="mt-3 text-neutral-600">
              A two-headed track: a podcast where guests speak in the present “I” (professional/skill/civic focus), and a talent lane to surface unique gifts with production and promotion.
			  مسار برأسين: بودكاست يتحدث فيه الضيوف بصيغة الحاضر "أنا" (مهنية/مهارية/وطنية)، ومسار لإبراز المواهب مع دعم إنتاجي وترويجي.
            </p>
          </div>

          {/* Controls: search + sort */}
          <div className="mt-6 flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex-1">
              <div className="relative">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by title or description."
                  className="w-full rounded-2xl border px-4 py-3 pr-10 focus:outline-none focus:ring-2 focus:ring-neutral-900/20"
                  aria-label="Search albums"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400">⌕</span>
              </div>
            </div>

            <div className="inline-flex items-center gap-2">
              <label className="text-sm text-neutral-600">Sort</label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="rounded-2xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/20"
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
          <div className="mt-16 text-center text-neutral-600">
            No published albums match your search.
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">{cards}</div>
        )}
      </main>

      <Footer />
    </>
  );
}
