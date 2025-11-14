// pages/news/[slug].tsx
import Head from 'next/head';
import { useRouter } from 'next/router';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

type ArticleDoc = {
  id: string;
  title: string;
  excerpt: string | null;
  contentHtml?: string | null;
  content: string | null;
  createdAtMillis: number | null;

  primaryMediaUrl: string | null;
  primaryMediaType: 'image' | 'video' | null;
  primaryMediaThumbUrl: string | null;

  mediaCount: number;
  imageCount: number;
  videoCount: number;

  slug?: string | null;
};

type Media = {
  id: string;
  type: 'image' | 'video';
  downloadUrl: string;
  thumbUrl: string | null;
  title: string;
};

type MediaFilter = 'all' | 'image' | 'video';

/* ───── helpers ───── */

async function fetchJSON<T = unknown>(url: string) {
  const r = await fetch(url, { credentials: 'same-origin' });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j?.ok === false) throw new Error(j?.error || 'Request failed');
  return j as T;
}

function toMillis(v: unknown): number | null {
  try {
    if (!v) return null;
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const t = Date.parse(v);
      return Number.isFinite(t) ? t : null;
    }
    if (typeof v?.toMillis === 'function') return v.toMillis();
    if (typeof v?.toDate === 'function') return (v.toDate() as Date).getTime();
    return null;
  } catch {
    return null;
  }
}

const YT_11 = /[A-Za-z0-9_-]{11}/;
function youtubeId(url?: string | null) {
  if (!url) return undefined;
  const u = String(url);
  const m =
    u.match(/youtu\.be\/([A-Za-z0-9_-]{11})/) ||
    u.match(/[?&]v=([A-Za-z0-9_-]{11})/) ||
    u.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{11})/);
  return m && YT_11.test(m[1]) ? m[1] : undefined;
}
function isFileVideo(url?: string | null) {
  if (!url) return false;
  return /\.(mp4|webm|ogg|ogv|m4v|mov)(\?|#|$)/i.test(url);
}
function isVideoUrl(url?: string | null) {
  if (!url) return false;
  return isFileVideo(url) || /youtube\.com|youtu\.be/.test(url.toLowerCase());
}

/* Normalize an article from API response */
function coerceArticle(x: unknown): ArticleDoc {
  const id = String(x?.id || x?.slug || '');
  const title = String(x?.title || 'Untitled');

  const excerpt =
    typeof x?.excerpt === 'string'
      ? x.excerpt
      : typeof x?.summary === 'string'
      ? x.summary
      : null;

  const contentHtml =
    typeof x?.html === 'string'
      ? x.html
      : typeof x?.contentHtml === 'string'
      ? x.contentHtml
      : null;

  const content =
    typeof x?.content === 'string'
      ? x.content
      : typeof x?.body === 'string'
      ? x.body
      : null;

  const createdAtMillis =
    toMillis(x?.createdAtMillis) ?? toMillis(x?.createdAt) ?? toMillis(x?.date) ?? null;

  const primaryMediaUrl: string | null = x?.primaryMediaUrl ?? x?.coverUrl ?? null;
  let primaryMediaType: 'image' | 'video' | null = (x?.primaryMediaType as unknown) || null;
  const primaryMediaThumbUrl: string | null = x?.primaryMediaThumbUrl ?? null;

  if (!primaryMediaType && primaryMediaUrl) {
    primaryMediaType = isVideoUrl(primaryMediaUrl) ? 'video' : 'image';
  }

  let imageCount = Number(x?.imageCount || 0);
  let videoCount = Number(x?.videoCount || 0);
  let mediaCount = Number(x?.mediaCount || 0);

  if ((!imageCount && !videoCount && !mediaCount) && Array.isArray(x?.media)) {
    let img = 0, vid = 0;
    for (const m of x.media) {
      const t = (m?.type || (isVideoUrl(m?.url) ? 'video' : 'image')) as 'image' | 'video';
      if (t === 'video') vid++; else img++;
    }
    imageCount = img;
    videoCount = vid;
    mediaCount = img + vid;
  }

  return {
    id,
    title,
    excerpt,
    contentHtml,
    content,
    createdAtMillis,
    primaryMediaUrl: primaryMediaUrl || null,
    primaryMediaType: primaryMediaType || null,
    primaryMediaThumbUrl: primaryMediaThumbUrl || null,
    mediaCount,
    imageCount,
    videoCount,
    slug: x?.slug || null,
  };
}

/* Normalize a mixed media array */
function normalizeMedia(input: unknown, groupId: string): Media[] {
  const src = Array.isArray(input) ? input : [];
  const out: Media[] = [];

  for (let i = 0; i < src.length; i++) {
    const m = src[i] || {};
    const url = String(m.downloadUrl || m.url || '');
    if (!url) continue;

    const type = (m.type || (isVideoUrl(url) ? 'video' : 'image')) as 'image' | 'video';
    const thumbUrl =
      (m.thumbUrl || m.thumb || null) ? String(m.thumbUrl || m.thumb) : null;
    const title = typeof m.title === 'string' ? m.title : '';

    const id =
      (m.id && String(m.id)) ||
      (m.storageId && String(m.storageId)) ||
      `${groupId}:${type}:${i}:${encodeURIComponent(url).slice(-12)}`;

    out.push({ id, type, downloadUrl: url, thumbUrl, title });
  }

  return out;
}

/* Choose a primary from media (prefer first video) */
function choosePrimaryFromMedia(media: Media[]) {
  if (!media.length) return null;
  const vid = media.find((m) => m.type === 'video');
  const m = vid || media[0];
  return {
    url: m.downloadUrl,
    type: m.type,
    thumbUrl: m.thumbUrl || null,
  } as const;
}

/* ───── page component ───── */

export default function NewsDetailPage() {
  const router = useRouter();
  const { slug } = router.query as { slug?: string };

  const [article, setArticle] = useState<ArticleDoc | null>(null);
  const [items, setItems] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);

  const [filter, setFilter] = useState<MediaFilter>('all');
  const [query, setQuery] = useState('');
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadArticleAndMedia(slugOrId: string) {
      // 1) Try public by-slug; 2) fallback to by-id (admin-style shape)
      const tryUrls = [
        `/api/news/by-slug/${encodeURIComponent(slugOrId)}`,
        `/api/news/get?id=${encodeURIComponent(slugOrId)}`,
      ];

      let raw: unknown = null;
      for (const u of tryUrls) {
        try {
          const j = await fetchJSON<unknown>(u);
          raw = j?.item || j?.article || j?.news || j;
          if (raw && (raw.id || raw.slug || raw.title)) break;
        } catch {
          /* keep trying */
        }
      }
      if (!raw) throw new Error('not_found');

      const a0 = coerceArticle(raw);

      // 2) Load media subcollection (authoritative)
      let media: Media[] = [];
      try {
        const mj = await fetchJSON<{ ok: true; items: unknown[] }>(
          `/api/news/media-list?groupId=${encodeURIComponent(a0.id)}&limit=400&include=all`
        );
        media = normalizeMedia(mj.items, a0.id);
      } catch {
        // fallback to embedded media (if any)
        media = normalizeMedia(raw?.media || [], a0.id);
      }

      // 3) If no primary on article, promote from media (fixes "No cover")
      const a = { ...a0 };
      if (!a.primaryMediaUrl && media.length) {
        const p = choosePrimaryFromMedia(media)!;
        a.primaryMediaUrl = p.url;
        a.primaryMediaType = p.type;
        a.primaryMediaThumbUrl = p.thumbUrl;
      }

      // 4) If counts missing, recompute from media
      if ((!a.imageCount && !a.videoCount && !a.mediaCount) && media.length) {
        const img = media.filter((m) => m.type === 'image').length;
        const vid = media.length - img;
        a.imageCount = img;
        a.videoCount = vid;
        a.mediaCount = media.length;
      }

      if (!mounted) return;
      setArticle(a);
      setItems(media);
    }

    (async () => {
      if (!slug) return;
      try {
        await loadArticleAndMedia(slug);
      } catch {
        if (mounted) setArticle(null);
      } finally {
        if (mounted) setLoading(false);
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

  const countsText = article
    ? `${article.imageCount ?? counts.photos} photos · ${article.videoCount ?? counts.videos} videos`
    : '';

  const open = (idx: number) => setOpenIdx(idx);
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

  const title = article?.title || 'News';

  return (
    <>
      <Head>
        <title>{title} — News</title>
        <meta
          name="description"
          content={
            article?.excerpt ||
            (article?.content || '').slice(0, 140) ||
            'News article details'
          }
        />
      </Head>

      <Navbar />

      <main className="pt-24 md:pt-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-4">
            <Link
              href="/news"
              className="inline-flex items-center gap-2 text-sm rounded-2xl border px-4 py-2 hover:bg-neutral-50 transition"
              aria-label="Back to News"
            >
              ← Back to News
            </Link>
          </div>

          {loading ? (
            <div className="py-20 text-center text-neutral-600">Loading…</div>
          ) : !article ? (
            <div className="py-20 text-center text-neutral-600">Article not found.</div>
          ) : (
            <>
              {/* Hero / cover */}
              <section className="rounded-3xl overflow-hidden border bg-white">
                <div className="relative aspect-[16/9] w-full bg-neutral-100">
                  {article.primaryMediaUrl ? (
                    article.primaryMediaType === 'video' ? (
                      youtubeId(article.primaryMediaUrl) ? (
                        <iframe
                          className="absolute inset-0 w-full h-full"
                          src={`https://www.youtube.com/embed/${youtubeId(article.primaryMediaUrl)}`}
                          title={article.title}
                          loading="lazy"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                        />
                      ) : article.primaryMediaThumbUrl ? (
                        <Image
                          src={article.primaryMediaThumbUrl}
                          alt={article.title}
                          fill
                          className="object-cover"
                          sizes="100vw"
                          priority
                        />
                      ) : (
                        <video
                          src={article.primaryMediaUrl}
                          className="absolute inset-0 w-full h-full object-cover"
                          controls
                        />
                      )
                    ) : (
                      <Image
                        src={article.primaryMediaUrl}
                        alt={article.title}
                        fill
                        className="object-cover"
                        sizes="100vw"
                        priority
                      />
                    )
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-neutral-400">
                      No cover
                    </div>
                  )}
                </div>

                <div className="p-5 md:p-7">
                  <h1 className="text-3xl md:text-5xl font-extrabold">{article.title}</h1>
                  <div className="mt-1 text-sm text-neutral-600">
                    {article.createdAtMillis
                      ? new Date(article.createdAtMillis).toLocaleString()
                      : 'No date'}
                  </div>
                  {article.excerpt ? (
                    <p className="mt-3 text-neutral-700">{article.excerpt}</p>
                  ) : null}
                  <div className="mt-2 text-xs text-neutral-500">{countsText}</div>
                </div>
              </section>

              {/* Content */}
              {article.contentHtml ? (
                <section className="mt-6 rounded-3xl border bg-white p-5 md:p-7">
                  <div
                    className="prose max-w-none"
                    dangerouslySetInnerHTML={{ __html: article.contentHtml }}
                  />
                </section>
              ) : article.content ? (
                <section className="mt-6 rounded-3xl border bg-white p-5 md:p-7">
                  <div className="prose max-w-none whitespace-pre-line">
                    {article.content}
                  </div>
                </section>
              ) : null}

              {/* Controls (filter + search + share) */}
              <div className="mt-6 flex flex-col md:flex-row md:items-center gap-3">
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

                <div className="flex-1">
                  <div className="relative">
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search inside this article’s media…"
                      className="w-full rounded-2xl border px-4 py-3 pr-10 focus:outline-none focus:ring-2 focus:ring-neutral-900/20"
                      aria-label="Search in article"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400">
                      ⌕
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      if (!article) return;
                      const origin =
                        typeof window !== 'undefined' ? window.location.origin : '';
                      const target = `/news/${article.slug || article.id}`;
                      const url = `${origin}${target}`;
                      if ((navigator as unknown).share) {
                        await (navigator as unknown).share({
                          title: article.title,
                          text: article.excerpt || article.title,
                          url,
                        });
                      } else {
                        await navigator.clipboard.writeText(url);
                      }
                    }}
                    className="rounded-2xl border px-4 py-2 text-sm hover:bg-neutral-50 transition"
                  >
                    Share article ↗
                  </button>
                </div>
              </div>

              {/* Media grid */}
              <div className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {filtered.map((m, i) => {
                  const yt = m.type === 'video' ? youtubeId(m.downloadUrl) : undefined;
                  const ytThumb = yt ? `https://img.youtube.com/vi/${yt}/hqdefault.jpg` : null;

                  return (
                    <button
                      key={m.id}
                      onClick={() => setOpenIdx(i)}
                      className="relative group aspect-square w-full overflow-hidden rounded-2xl bg-neutral-100 ring-1 ring-inset ring-neutral-200 hover:ring-neutral-300 transition"
                      title={m.title}
                    >
                      {m.type === 'video' ? (
                        (m.thumbUrl || ytThumb) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={(m.thumbUrl || ytThumb)!}
                            alt={m.title || 'Video'}
                            className="absolute inset-0 w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <video
                            src={m.downloadUrl}
                            preload="metadata"
                            muted
                            playsInline
                            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                            aria-hidden="true"
                          />
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

                      {m.title ? (
                        <div className="absolute bottom-0 left-0 right-0 bg-neutral-900/60 text-white text-xs px-2 py-1 line-clamp-1 backdrop-blur">
                          {m.title}
                        </div>
                      ) : null}

                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition bg-black/0 group-hover:bg-black/10" />
                    </button>
                  );
                })}
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
                    <div className="absolute -top-12 right-0 flex gap-2">
                      <button
                        onClick={close}
                        className="rounded-2xl border px-3 py-1.5 text-sm text-white/90 hover:bg-white/10"
                      >
                        Close ✕
                      </button>
                    </div>

                    {filtered[openIdx]?.type === 'video' ? (
                      youtubeId(filtered[openIdx].downloadUrl) ? (
                        <div className="relative w-[90vw] max-w-5xl aspect-video">
                          <iframe
                            className="absolute inset-0 w-full h-full"
                            src={`https://www.youtube.com/embed/${youtubeId(
                              filtered[openIdx].downloadUrl
                            )}`}
                            title={filtered[openIdx].title || 'Video'}
                            loading="lazy"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                          />
                        </div>
                      ) : (
                        <video controls className="max-h-[85vh] max-w-[92vw] rounded-xl">
                          <source src={filtered[openIdx].downloadUrl} />
                        </video>
                      )
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={filtered[openIdx].downloadUrl}
                        alt={filtered[openIdx].title || ''}
                        className="max-h-[85vh] max-w-[92vw] rounded-xl"
                      />
                    )}

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
          )}
        </div>
      </main>	
	  
	  
      <Footer />
    </>
  );
}