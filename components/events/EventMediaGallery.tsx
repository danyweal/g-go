// components/events/EventMediaGallery.tsx
import Image from 'next/image';
import React, { useEffect, useMemo, useRef, useState } from 'react';

type Media = {
  id: string;
  type: 'image' | 'video';
  downloadUrl: string;
  thumbUrl: string | null;
  title: string;
};

type MediaFilter = 'all' | 'image' | 'video';

export default function EventMediaGallery({ eventId }: { eventId: string }) {
  const [items, setItems] = useState<Media[]>([]);
  const [filter, setFilter] = useState<MediaFilter>('all');
  const [query, setQuery] = useState('');
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await fetch(`/api/events/media-list?eventId=${encodeURIComponent(eventId)}`);
        const j = await r.json();
        if (mounted && j?.ok) setItems(j.items || []);
      } catch {}
    })();
    return () => { mounted = false; };
  }, [eventId]);

  const filtered = useMemo(() => {
    let list = [...items];
    if (filter !== 'all') list = list.filter((i) => i.type === filter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((i) => (i.title || '').toLowerCase().includes(q));
    }
    return list;
  }, [items, filter, query]);

  const open = (i: number) => setOpenIdx(i);
  const close = () => setOpenIdx(null);
  const canPrev = openIdx !== null && openIdx > 0;
  const canNext = openIdx !== null && openIdx < filtered.length - 1;
  const prev = () => (canPrev ? setOpenIdx((i) => (i === null ? i : i - 1)) : undefined);
  const next = () => (canNext ? setOpenIdx((i) => (i === null ? i : i + 1)) : undefined);

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

  const counts = useMemo(() => {
    const photos = items.filter(i => i.type === 'image').length;
    const videos = items.filter(i => i.type === 'video').length;
    return { photos, videos, total: items.length };
  }, [items]);

  return (
    <section className="mt-8">
      {/* Controls */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="inline-flex rounded-2xl border bg-white p-1 shadow-sm">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 text-sm rounded-xl transition ${filter === 'all' ? 'bg-neutral-900 text-white shadow-sm' : 'hover:bg-neutral-50'}`}
            aria-pressed={filter === 'all'}
          >
            All <span className="opacity-70 text-[11px]">({counts.total})</span>
          </button>
          <button
            onClick={() => setFilter('image')}
            className={`px-4 py-2 text-sm rounded-xl transition ${filter === 'image' ? 'bg-neutral-900 text-white shadow-sm' : 'hover:bg-neutral-50'}`}
            aria-pressed={filter === 'image'}
          >
            Photos <span className="opacity-70 text-[11px]">({counts.photos})</span>
          </button>
          <button
            onClick={() => setFilter('video')}
            className={`px-4 py-2 text-sm rounded-xl transition ${filter === 'video' ? 'bg-neutral-900 text-white shadow-sm' : 'hover:bg-neutral-50'}`}
            aria-pressed={filter === 'video'}
          >
            Videos <span className="opacity-70 text-[11px]">({counts.videos})</span>
          </button>
        </div>

        <div className="flex-1">
          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search inside this event…"
              className="w-full rounded-2xl border px-4 py-3 pr-10"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400">⌕</span>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {filtered.map((m, i) => (
          <button
            key={m.id}
            onClick={() => open(i)}
            className="relative group aspect-square w-full overflow-hidden rounded-2xl bg-neutral-100 ring-1 ring-inset ring-neutral-200 hover:ring-neutral-300 transition"
            title={m.title}
          >
            {m.type === 'video' ? (
              m.thumbUrl ? (
                <Image src={m.thumbUrl} alt={m.title || 'Video'} fill className="object-cover" sizes="(max-width:768px) 50vw, 25vw" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-neutral-400">Video</div>
              )
            ) : (
              <Image src={m.downloadUrl} alt={m.title || 'Image'} fill className="object-cover" sizes="(max-width:768px) 50vw, 25vw" />
            )}
            {m.title ? (
              <div className="absolute bottom-0 left-0 right-0 bg-neutral-900/60 text-white text-xs px-2 py-1 line-clamp-1 backdrop-blur">
                {m.title}
              </div>
            ) : null}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition bg-black/0 group-hover:bg-black/10" />
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {openIdx !== null ? (
        <div
          ref={modalRef}
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === modalRef.current) close(); }}
          role="dialog"
          aria-modal="true"
        >
          <div className="relative max-h-[85vh] max-w-[92vw]">
            <div className="absolute -top-12 right-0 flex gap-2">
              <button onClick={close} className="rounded-2xl border px-3 py-1.5 text-sm text-white/90 hover:bg-white/10">Close ✕</button>
            </div>
            {filtered[openIdx]?.type === 'video' ? (
              <video controls className="max-h-[85vh] max-w-[92vw] rounded-xl">
                <source src={filtered[openIdx].downloadUrl} />
              </video>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={filtered[openIdx].downloadUrl} alt={filtered[openIdx].title || ''} className="max-h-[85vh] max-w-[92vw] rounded-xl" />
            )}
            {openIdx > 0 ? (
              <button onClick={() => setOpenIdx(openIdx - 1)} className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full h-10 w-10 bg-white/90 text-neutral-900 border hover:bg-white transition" aria-label="Previous">‹</button>
            ) : null}
            {openIdx < filtered.length - 1 ? (
              <button onClick={() => setOpenIdx(openIdx + 1)} className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 rounded-full h-10 w-10 bg-white/90 text-neutral-900 border hover:bg-white transition" aria-label="Next">›</button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
