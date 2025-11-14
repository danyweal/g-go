// components/NewsCard.tsx

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { NewsItem } from '../types';

type NewsLike = Partial<NewsItem> & {
  id: string;
  title?: string;
  slug?: string | null;
  excerpt?: string | null;
  content?: string | null;
  publishedAt?: string | null;            // ISO string
  createdAtMillis?: number | null;        // number millis fallback
  imageUrl?: string | null;               // simple cover (image)
  primaryMediaUrl?: string | null;        // global media model (image or video)
  primaryMediaType?: 'image' | 'video' | null;
  primaryMediaThumbUrl?: string | null;   // poster for video
  mediaCount?: number;
  imageCount?: number;
  videoCount?: number;
  tags?: string[] | null;
};

interface NewsCardProps {
  news: NewsLike;
  /** Optional override click handler instead of link */
  onRead?: () => void;
  /** Allow parent to inject layout classes (e.g., h-full) */
  className?: string;
  /** CTA label text */
  readLabel?: string;
  /** Responsive sizes for Next/Image (kept similar footprint to EventCard) */
  sizes?: string;
  /** Hide the items badge */
  hideItemsBadge?: boolean;
}

/** First paragraph extractor for fallback excerpt */
function firstParagraph(text?: string | null): string {
  if (!text) return '';
  const cleaned = text.replace(/\r\n?/g, '\n');
  return cleaned.split(/\n{2,}/)[0]?.trim() || '';
}

/** Safe truncation */
function truncate(s: string, n: number) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
}

/** en-GB date formatting; publishedAt wins, createdAtMillis fallback */
function fmtDate(d?: string | null, ms?: number | null): string {
  try {
    const date =
      (d ? new Date(d) : null) ||
      (typeof ms === 'number' ? new Date(ms) : null);
    if (!date || isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

/** Decide a single display media (prevents image/video mismatch) */
function getDisplayMedia(news: NewsLike) {
  const primaryType = news.primaryMediaType ?? null;

  // If primary says video and we have a url, render video with optional poster
  if (primaryType === 'video' && news.primaryMediaUrl) {
    return {
      kind: 'video' as const,
      src: news.primaryMediaUrl,
      poster: news.primaryMediaThumbUrl ?? null,
    };
  }

  // Else prefer explicit imageUrl; if not, primaryMediaUrl if not video
  const imageSrc = news.imageUrl ?? (primaryType !== 'video' ? news.primaryMediaUrl ?? null : null);
  if (imageSrc) {
    return { kind: 'image' as const, src: imageSrc, poster: null as const };
  }

  return { kind: 'none' as const, src: null as const, poster: null as const };
}

export default function NewsCard({
  news,
  onRead,
  className,
  readLabel = 'Read article',
  sizes = '(min-width:1280px) 400px, (min-width:768px) 50vw, 100vw',
  hideItemsBadge = false,
}: NewsCardProps) {
  const title = news.title || 'Untitled';
  const slugOrId = news.slug || news.id;
  const href = `/news/${slugOrId}`;

  const { kind, src: mediaSrc, poster } = getDisplayMedia(news);
  const dateStr = fmtDate(news.publishedAt || null, news.createdAtMillis ?? null);

  const excerpt = news.excerpt || truncate(firstParagraph(news.content), 180);

  const hasCounts =
    typeof news.mediaCount === 'number' ||
    typeof news.imageCount === 'number' ||
    typeof news.videoCount === 'number';

  const showCounts =
    hasCounts &&
    !hideItemsBadge &&
    ((news.mediaCount ?? 0) > 0 || (news.imageCount ?? 0) > 0 || (news.videoCount ?? 0) > 0);

  const itemsBadge = (() => {
    if (!showCounts) return '';
    if (typeof news.mediaCount === 'number') {
      const n = news.mediaCount;
      return `${n} item${n === 1 ? '' : 's'}`;
    }
    const photos = news.imageCount ?? 0;
    const videos = news.videoCount ?? 0;
    return `${photos} photo${photos === 1 ? '' : 's'} · ${videos} video${videos === 1 ? '' : 's'}`;
  })();

  const TagList =
    Array.isArray(news.tags) && news.tags.length > 0 ? (
      <div className="mt-3 flex flex-wrap gap-2" aria-label="Tags">
        {news.tags.slice(0, 3).map((t) => (
          <span
            key={t}
            className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border text-xs"
            aria-label={`Tag ${t}`}
            title={`Tag: ${t}`}
          >
            #{t}
          </span>
        ))}
      </div>
    ) : null;

  const titleId = `news-card-title-${slugOrId}`;

  return (
    <div
      className={`card group relative flex flex-col overflow-hidden rounded-xl bg-white shadow-card ring-1 ring-black/5 ${className ?? ''}`}
      aria-label={`Article: ${title}`}
    >
      {/* Cover — same 16:9, same overlay, same hover scale as EventCard */}
      <div className="relative overflow-hidden">
        {kind !== 'none' ? (
          <Link href={href} aria-label={`Open ${title}`}>
            <div className="relative w-full aspect-[16/9]">
              {kind === 'video' ? (
                <>
                  <video
                    src={mediaSrc!}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    muted
                    loop
                    autoPlay
                    playsInline
                    preload="metadata"
                    poster={poster || undefined}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" aria-hidden />
                </>
              ) : (
                <>
                  <Image
                    src={mediaSrc!}
                    alt={title}
                    fill
                    sizes={sizes}
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    priority={false}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" aria-hidden />
                </>
              )}
            </div>
          </Link>
        ) : (
          <div className="relative w-full aspect-[16/9] flex items-center justify-center bg-palestine-green/10">
            <div className="text-center px-4">
              <div className="text-xl font-bold text-palestine-dark">{title}</div>
              <div className="mt-1 text-sm text-palestine-muted">No media provided</div>
            </div>
          </div>
        )}

        {/* Type pill — mirrors EventCard pill placement */}
        <div className="absolute top-4 left-4 flex gap-2">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-palestine-green text-white">
            Article
          </span>
        </div>

        {/* Items badge (optional) */}
        {itemsBadge ? (
          <div className="absolute top-4 right-4">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-white/90 text-gray-800 ring-1 ring-black/5">
              {itemsBadge}
            </span>
          </div>
        ) : null}
      </div>

      {/* Body — paddings/typography aligned to EventCard */}
      <div className="p-6 flex flex-col flex-1">
        <h3 id={titleId} className="text-xl font-bold leading-snug">
          <Link href={href} className="hover:underline">
            {title}
          </Link>
        </h3>

        {dateStr ? (
          <div className="mt-2 text-sm text-palestine-muted">{dateStr}</div>
        ) : null}

        {excerpt ? (
          <p className="mt-4 text-sm text-gray-600 line-clamp-3">{excerpt}</p>
        ) : null}

        {TagList}

        <div className="mt-6 flex items-center justify-end">
          {onRead ? (
            <button
              onClick={onRead}
              className="text-sm font-medium px-4 py-2 bg-palestine-green text-white rounded-xl hover:brightness-105 transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-palestine-green"
              aria-label={`Read ${title}`}
            >
              {readLabel}
            </button>
          ) : (
            <Link
              href={href}
              className="text-sm font-medium px-4 py-2 bg-palestine-green text-white rounded-xl hover:brightness-105 transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-palestine-green"
              aria-label={`Read ${title}`}
            >
              {readLabel}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
