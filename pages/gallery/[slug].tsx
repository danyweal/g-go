// pages/gallery/[slug].tsx
import Head from 'next/head';
import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
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
  mediaCount: number | null;
  imageCount: number | null;
  videoCount: number | null;
};

type Media = {
  id: string;
  type: 'image' | 'video';
  downloadUrl: string;
  thumbUrl: string | null;
  title: string;
};

type MediaFilter = 'all' | 'image' | 'video';

export default function GalleryAlbumPage() {
  const router = useRouter();
  const { slug } = router.query as { slug?: string };

  const [album, setAlbum] = useState<Album | null>(null);
  const [items, setItems] = useState<Media[]>([]);
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  // In-album controls
  const [filter, setFilter] = useState<MediaFilter>('all');
  const [query, setQuery] = useState('');

  const modalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!slug) return;
    let mounted = true;
    (async () => {
      try {
        const r = await fetch(`/api/gallery/${slug}`);
        const j = await r.json();
        if (mounted && j?.ok) {
          setAlbum(j.album);
          setItems(j.media || []);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, [slug]);

  const counts = useMemo(() => {
    const total = items.length;
    const photos = items.filter((i) => i.type === 'image').length;
    const videos = total - photos;
    return { total, photos, videos };
  }, [items]);

  const filtered = useMemo(() => {
    let list = [...items];
    if (filter !== 'all') list = list.filter((i) => i.type === filter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((i) => (i.title || '').toLowerCase().includes(q));
    }
    return list;
  }, [items, filter, query]);

  const countsText = album
    ? `${album.imageCount || 0} photos · ${album.videoCount || 0} videos`
    : '';

  const open = (idx: number) => setOpenIdx(idx);
  const close = () => setOpenIdx(null);
  const canPrev = openIdx !== null && openIdx > 0;
  const canNext = openIdx !== null && openIdx < filtered.length - 1;
  const prev = () => (canPrev ? setOpenIdx((i) => (i === null ? i : i - 1)) : undefined);
  const next = () => (canNext ? setOpenIdx((i) => (i === null ? i : i + 1)) : undefined);

  // Keyboard nav for the lightbox
  useEffect(() => {
    if (openIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openIdx, filtered.length]);

  return (
    <>
      <Head>
        <title>{album ? `${album.title} — Gallery` : 'Album — Gallery'}</title>
        <meta name="description" content={album?.description || 'Gallery album'} />
      </Head>

      <Navbar />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-28 md:pt-32 pb-6">
        <button
          onClick={() => router.push('/gallery')}
          className="mb-4 inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm hover:bg-neutral-50 active:scale-[0.99] transition"
          aria-label="Back to Gallery"
        >
          ← Back to Activities
        </button>

        {album ? (
          <>
            <h1 className="text-3xl md:text-5xl font-extrabold">{album.title}</h1>
            <p className="text-neutral-600 mt-2">{album.description}</p>
            <div className="mt-1 text-sm text-neutral-500">{countsText}</div>

            {/* In-album controls */}
            <div className="mt-6 flex flex-col md:flex-row md:items-center gap-3">
              {/* Segmented Filter */}
              <div
                className="inline-flex rounded-2xl border bg-white p-1 shadow-sm"
                role="tablist"
                aria-label="Media filter"
              >
                <button
                  role="tab"
                  aria-selected={filter === 'all'}
                  onClick={() => setFilter('all')}
                  className={`px-4 py-2 text-sm rounded-xl transition ${
                    filter === 'all'
                      ? 'bg-neutral-900 text-white shadow-sm'
                      : 'hover:bg-neutral-50'
                  }`}
                >
                  All <span className="opacity-70 text-[11px]">({counts.total})</span>
                </button>
                <button
                  role="tab"
                  aria-selected={filter === 'image'}
                  onClick={() => setFilter('image')}
                  className={`px-4 py-2 text-sm rounded-xl transition ${
                    filter === 'image'
                      ? 'bg-neutral-900 text-white shadow-sm'
                      : 'hover:bg-neutral-50'
                  }`}
                >
                  Photos <span className="opacity-70 text-[11px]">({counts.photos})</span>
                </button>
                <button
                  role="tab"
                  aria-selected={filter === 'video'}
                  onClick={() => setFilter('video')}
                  className={`px-4 py-2 text-sm rounded-xl transition ${
                    filter === 'video'
                      ? 'bg-neutral-900 text-white shadow-sm'
                      : 'hover:bg-neutral-50'
                  }`}
                >
                  Videos <span className="opacity-70 text-[11px]">({counts.videos})</span>
                </button>
              </div>

              {/* Search in album */}
              <div className="flex-1">
                <div className="relative">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search inside this album…"
                    className="w-full rounded-2xl border px-4 py-3 pr-10 focus:outline-none focus:ring-2 focus:ring-neutral-900/20"
                    aria-label="Search in album"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400">
                    ⌕
                  </span>
                </div>
              </div>

              {/* Share album */}
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    const origin =
                      typeof window !== 'undefined' ? window.location.origin : '';
                    const url = `${origin}/gallery/${album.slug}`;
                    if (navigator.share) {
                      await navigator.share({
                        title: album.title,
                        text: album.description || album.title,
                        url,
                      });
                    } else {
                      await navigator.clipboard.writeText(url);
                    }
                  }}
                  className="rounded-2xl border px-4 py-2 text-sm hover:bg-neutral-50 transition"
                >
                  Share album ↗
                </button>
              </div>
            </div>

            {/* Media grid */}
            <div className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filtered.map((m, i) => (
                <button
                  key={m.id}
                  onClick={() => open(i)}
                  className="relative group aspect-square w-full overflow-hidden rounded-2xl bg-neutral-100 ring-1 ring-inset ring-neutral-200 hover:ring-neutral-300 transition"
                  title={m.title}
                >
                  {m.type === 'video' ? (
                    m.thumbUrl ? (
                      <Image
                        src={m.thumbUrl}
                        alt={m.title || 'Video'}
                        fill
                        className="object-cover"
                        sizes="(max-width:768px) 50vw, 25vw"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-neutral-400">
                        Video
                      </div>
                    )
                  ) : (
                    <Image
                      src={m.downloadUrl}
                      alt={m.title || 'Image'}
                      fill
                      className="object-cover"
                      sizes="(max-width:768px) 50vw, 25vw"
                    />
                  )}

                  {/* Title overlay */}
                  {m.title ? (
                    <div className="absolute bottom-0 left-0 right-0 bg-neutral-900/60 text-white text-xs px-2 py-1 line-clamp-1 backdrop-blur">
                      {m.title}
                    </div>
                  ) : null}

                  {/* Hover gloss */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition bg-black/0 group-hover:bg-black/10" />
                </button>
              ))}
            </div>

            {/* Lightbox */}
            {openIdx !== null ? (
              <div
                ref={modalRef}
                className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
                onClick={(e) => {
                  if (e.target === modalRef.current) close();
                }}
                role="dialog"
                aria-modal="true"
              >
                <div className="relative max-h-[85vh] max-w-[92vw]">
                  {/* Controls */}
                  <div className="absolute -top-12 right-0 flex gap-2">
                    <button
                      onClick={close}
                      className="rounded-2xl border px-3 py-1.5 text-sm text-white/90 hover:bg-white/10"
                    >
                      Close ✕
                    </button>
                  </div>

                  {filtered[openIdx]?.type === 'video' ? (
                    <video controls className="max-h-[85vh] max-w-[92vw] rounded-xl">
                      <source src={filtered[openIdx].downloadUrl} />
                    </video>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={filtered[openIdx].downloadUrl}
                      alt={filtered[openIdx].title || ''}
                      className="max-h-[85vh] max-w-[92vw] rounded-xl"
                    />
                  )}

                  {/* Prev/Next */}
                  {canPrev ? (
                    <button
                      onClick={prev}
                      className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full h-10 w-10 bg-white/90 text-neutral-900 border hover:bg-white transition"
                      aria-label="Previous"
                    >
                      ‹
                    </button>
                  ) : null}
                  {canNext ? (
                    <button
                      onClick={next}
                      className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 rounded-full h-10 w-10 bg-white/90 text-neutral-900 border hover:bg-white transition"
                      aria-label="Next"
                    >
                      ›
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="py-20 text-center text-neutral-600">Loading…</div>
        )}
      </div>

      <Footer />
    </>
  );
}
