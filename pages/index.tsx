// pages/index.tsx
import Head from 'next/head';
import type { GetServerSideProps, NextPage } from 'next';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Handshake } from 'lucide-react';
import Layout from '../components/Layout';
import HeroSlideshow from '../components/HeroSlideshow';
import NewsCard from '../components/NewsCard';
import EventCard from '../components/EventCard';
import Button from '../components/Button';
import type { NewsItem, EventItem } from '../types';

/* ----------------------------------------------------------------------------
  Extra local types for new sections (kept local; your main types stay unchanged)
---------------------------------------------------------------------------- */

type GalleryAlbum = {
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

type StoreAlbum = {
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

/* --------------------------- Donations (match /donate) ---------------------------- */
type MediaItem = { id: string; type: 'image' | 'video' | 'youtube'; url: string; title?: string | null; isPrimary?: boolean };
type Campaign = {
  id: string;
  slug: string;
  status: 'draft' | 'active' | 'paused' | 'closed';
  title_ar: string;
  bannerUrl?: string | null;
  goalAmount: number;
  currency: 'GBP' | 'USD' | 'EUR' | string;
  totalDonated: number;
  donorsCount: number;
  endAt?: number | null;
  media?: MediaItem[] | null;
};

/* --------------------------- Page props ---------------------------- */
interface HomePageProps {
  sampleNews: NewsItem[];
  sampleEvents: EventItem[];
  latestGalleries: GalleryAlbum[];
  latestStores: StoreAlbum[];
  latestDonations: Campaign[]; // NEW
}

/* --------------------------- Date helpers (server + client safe) ---------------------------- */

/** Parse many possible date shapes into a valid Date or null (never throws). */
function toValidDate(input: any): Date | null {
  if (!input && input !== 0) return null;

  // Already a Date
  if (input instanceof Date) {
    return isNaN(input.getTime()) ? null : input;
  }

  // Firestore Timestamp-like (admin or client): has toDate()
  if (typeof input?.toDate === 'function') {
    const d = input.toDate();
    return isNaN(d.getTime()) ? null : d;
  }

  // Firestore Timestamp-like { seconds }
  if (typeof input?.seconds === 'number') {
    const d = new Date(input.seconds * 1000);
    return isNaN(d.getTime()) ? null : d;
  }

  // Epoch ms (number) or numeric string
  if (typeof input === 'number') {
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d;
  }

  // String parsing with normalization for common non-ISO shapes
  if (typeof input === 'string') {
    const s = input.trim();
    if (!s) return null;

    // If it's already a valid ISO (Date.parse understands it), try directly
    let candidate = s;

    // Normalize "YYYY-MM-DD" -> midnight UTC
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      candidate = `${s}T00:00:00Z`;
    }
    // Normalize "YYYY-MM-DD HH:mm" -> ISO UTC
    else if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}$/.test(s)) {
      candidate = s.replace(' ', 'T') + ':00Z';
    }
    // Normalize "YYYY-MM-DD HH:mm:ss" -> ISO UTC
    else if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/.test(s)) {
      candidate = s.replace(' ', 'T') + 'Z';
    }

    const d = new Date(candidate);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

/** Convert any input to a stable ISO string, or undefined if invalid. */
function toISOStringSafe(input: any): string | undefined {
  const d = toValidDate(input);
  return d ? d.toISOString() : undefined;
}

/** Keep the name `toISO` but make it robust (backwards compatible). */
const toISO = (v: unknown): string | undefined => toISOStringSafe(v);

/** Format a date-like input into a stable 'en-GB' text (SSR/CSR parity, London TZ). */
const LONDON_TZ = 'Europe/London';
const FIXED_LOCALE = 'en-GB';
function formatDateTimeISO(input?: any): string {
  const d = toValidDate(input);
  if (!d) return '';
  try {
    return new Intl.DateTimeFormat(FIXED_LOCALE, {
      timeZone: LONDON_TZ,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(d);
  } catch {
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
}

/* --------------------------- Price helper ---------------------------- */
const formatPrice = (p?: number | null) =>
  typeof p === 'number' && !Number.isNaN(p) ? `£${p.toFixed(2)}` : '';

/* --------------------------- UI Helpers (local components) ---------------------------- */
// خط فاصل أفقي بألوان العلم
const FlagDivider = () => (
  <div className="my-12" role="separator" aria-label="Section divider">
    <div className="h-1 w-full rounded-full ring-1 ring-black/5 shadow-sm bg-[linear-gradient(90deg,#000_0%,#000_25%,#dc2626_25%,#dc2626_50%,#ffffff_50%,#ffffff_75%,#16a34a_100%)]" />
  </div>
);

// قالب موحّد للبطاقات (يضمن نفس الارتفاع والشكل)
const CardShell = ({ children }: { children: React.ReactNode }) => (
  <div className="group h-full min-h-[22rem] rounded-xl overflow-hidden bg-white shadow-card ring-1 ring-black/5 flex flex-col">
    {children}
  </div>
);

/* ============================ */
/* SERVER: fetch real top 4 */
/* ============================ */

/** ---- NEW: robust cover selection for News/Events ---- **/
function ytThumb(u?: string | null): string | undefined {
  if (!u) return undefined;
  try {
    const url = new URL(u);
    let id = '';
    if (url.hostname.includes('youtube.com')) {
      id = url.searchParams.get('v') || '';
      if (!id && url.pathname.includes('/embed/')) id = url.pathname.split('/embed/')[1] || '';
    } else if (url.hostname === 'youtu.be') {
      id = url.pathname.replace('/', '');
    }
    return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : undefined;
  } catch {
    return undefined;
  }
}
const firstNonEmpty = (...vals: Array<string | undefined | null>) =>
  vals.find((v) => typeof v === 'string' && v.trim().length > 0) || undefined;

function pickPrimaryImageFromMedia(media: any): string | undefined {
  if (!Array.isArray(media)) return undefined;
  const sorted = [...media].sort((a, b) => Number(!!b?.isPrimary) - Number(!!a?.isPrimary));
  const img = sorted.find((m) => m?.type === 'image' && typeof m?.url === 'string' && m.url);
  if (img?.url) return img.url as string;
  const yt = sorted.find((m) => m?.type === 'youtube' && typeof m?.url === 'string' && m.url);
  const ytUrl = ytThumb(yt?.url);
  if (ytUrl) return ytUrl;
  const firstImg = media.find((m: any) => m?.type === 'image' && m?.url);
  if (firstImg?.url) return firstImg.url as string;
  return undefined;
}

function pickCoverForDoc(d: any): string | undefined {
  // Prefer explicit image fields, then media[], then YouTube/video fallbacks.
  const explicit =
    firstNonEmpty(
      d?.imageUrl,
      d?.coverUrl,
      d?.primaryMediaUrl,
      d?.bannerUrl
    ) || undefined;

  const fromMedia = pickPrimaryImageFromMedia(d?.media);
  const ytFromVideoField = ytThumb(d?.videoUrl);

  return firstNonEmpty(explicit, fromMedia, ytFromVideoField);
}

const getOrigin = (req: any) => {
  const proto = req?.headers?.['x-forwarded-proto'] || 'http';
  const host = req?.headers?.['x-forwarded-host'] || req?.headers?.host || 'localhost:3000';
  return `${proto}://${host}`;
};

export const getServerSideProps: GetServerSideProps<HomePageProps> = async (ctx) => {
  const { adminDb } = await import('../lib/firebaseAdmin');

  const now = new Date();
  const nowISO16 = now.toISOString().slice(0, 16); // align with dateISO "YYYY-MM-DDTHH:mm"
  const cms = adminDb.collection('cms').doc('root');

  /* ---- NEWS (latest 4, with cms/root fallback) ---- */
  let sampleNews: NewsItem[] = [];
  try {
    const collect = async (q: any) => {
      const snap = await q.limit(4).get();
      return snap.docs.map((doc: any) => {
        const d = doc.data() as any;
        const publishedAt =
          toISO(d.publishedAt) ??
          toISO(d.createdAt) ??
          // admin SDK createTime available server-side
          (doc.createTime ? doc.createTime.toDate().toISOString() : new Date().toISOString());

        // ---- FIX: choose the right cover image for News ----
        const cover = pickCoverForDoc(d) || '';

        return {
          id: doc.id,
          title: d.title ?? '',
          slug: d.slug ?? doc.id,
          content: d.content ?? '',
          publishedAt,
          imageUrl: cover,
        } as NewsItem;
      });
    };

    let list: NewsItem[] = [];
    try {
      list = await collect(cms.collection('news').orderBy('publishedAt', 'desc'));
    } catch {}
    if (list.length === 0) {
      try {
        list = await collect(cms.collection('news').orderBy('createdAt', 'desc'));
      } catch {}
    }
    if (list.length === 0) {
      try {
        list = await collect(adminDb.collection('news').orderBy('publishedAt', 'desc'));
      } catch {}
    }
    if (list.length === 0) {
      try {
        list = await collect(adminDb.collection('news').orderBy('createdAt', 'desc'));
      } catch {}
    }

    sampleNews = list.slice(0, 4);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[SSR] Failed to fetch news:', (e as Error)?.message);
  }

  /* ---- EVENTS (support cms/root dateISO OR top-level startTime) ---- */
  let sampleEvents: EventItem[] = [];
  try {
    const fromCmsDateISO = async (): Promise<EventItem[]> => {
      const snap = await cms.collection('events').orderBy('dateISO', 'desc').limit(24).get();
      const all = snap.docs.map((doc: any) => {
        const d = doc.data() as any;

        // Prefer startTime if present, else dateISO string normalized
        const start =
          toISO(d.startTime) ??
          toISO(d.dateISO) ??
          undefined;

        // ---- FIX: choose the right cover image for Events (cms/root) ----
        const cover = pickCoverForDoc(d) || '';

        return {
          id: doc.id,
          title: d.title ?? '',
          description: d.description ?? '',
          startTime: start ?? now.toISOString(),
          endTime: toISO(d.endTime) ?? null, // <-- force null, never undefined
          location: d.location ?? '',
          imageUrl: cover,
          ...(d.videoUrl ? { videoUrl: d.videoUrl } : {}),
          ...(d.slug ? { slug: d.slug } : {}),
        } as unknown as EventItem;
      });

      const upcoming = all
        .filter((e: any) => {
          const s = typeof e.startTime === 'string' ? e.startTime.slice(0, 16) : '';
          return s >= nowISO16;
        })
        .sort((a: any, b: any) => (a.startTime! < b.startTime! ? -1 : 1));

      const past = all
        .filter((e: any) => {
          const s = typeof e.startTime === 'string' ? e.startTime.slice(0, 16) : '';
          return s < nowISO16;
        })
        .sort((a: any, b: any) => (a.startTime! > b.startTime! ? -1 : 1));

      const take = [
        ...upcoming.slice(0, 4),
        ...past.slice(0, 4 - Math.min(4, upcoming.length)),
      ];

      return take.slice(0, 4);
    };

    const fromTopLevelStartTime = async (): Promise<EventItem[]> => {
      const upSnap = await adminDb
        .collection('events')
        .where('startTime', '>=', now)
        .orderBy('startTime', 'asc')
        .limit(4)
        .get();

      const mapDoc = (doc: any): EventItem => {
        const d = doc.data() as any;

        // ---- FIX: choose the right cover image for Events (top-level) ----
        const cover = pickCoverForDoc(d) || '';

        return {
          id: doc.id,
          title: d.title ?? '',
          description: d.description ?? '',
          startTime: toISO(d.startTime) ?? now.toISOString(),
          endTime: toISO(d.endTime) ?? null, // <-- force null, never undefined
          location: d.location ?? '',
          imageUrl: cover,
          ...(d.videoUrl ? { videoUrl: d.videoUrl } : {}),
          ...(d.slug ? { slug: d.slug } : {}),
        } as unknown as EventItem;
      };

      let events = upSnap.docs.map(mapDoc);

      if (events.length < 4) {
        const pastSnap = await adminDb
          .collection('events')
          .where('startTime', '<', now)
          .orderBy('startTime', 'desc')
          .limit(4 - events.length)
          .get();
        events = [...events, ...pastSnap.docs.map(mapDoc)];
      }
      return events.slice(0, 4);
    };

    let events: EventItem[] = [];
    try {
      events = await fromCmsDateISO();
    } catch {}
    if (events.length === 0) {
      try {
        events = await fromTopLevelStartTime();
      } catch {}
    }

    sampleEvents = events.slice(0, 4);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[SSR] Failed to fetch events:', (e as Error)?.message);
  }

  /* ---- LATEST GALLERIES (cms/root/galleries, published only) ---- */
  let latestGalleries: GalleryAlbum[] = [];
  try {
    // Avoid composite index by not ordering; sort in memory (like /api/gallery/list)
    const q = await cms.collection('galleries').where('published', '==', true).limit(100).get();
    const all = q.docs.map((d: any) => {
      const x: any = d.data() || {};
      const created: Date | null = x.createdAt?.toDate?.() ? x.createdAt.toDate() : null;
      const createdAtMillis = created && !isNaN(created.getTime()) ? created.getTime() : 0;
      return {
        id: d.id,
        title: x.title ?? '',
        slug: x.slug ?? '',
        description: x.description ?? '',
        createdAtMillis,
        primaryMediaUrl: x.primaryMediaUrl ?? null,
        primaryMediaType: (x.primaryMediaType as 'image' | 'video' | null) ?? null,
        primaryMediaThumbUrl: x.primaryMediaThumbUrl ?? null,
        mediaCount: typeof x.mediaCount === 'number' ? x.mediaCount : 0,
        imageCount: typeof x.imageCount === 'number' ? x.imageCount : 0,
        videoCount: typeof x.videoCount === 'number' ? x.videoCount : 0,
      } as GalleryAlbum;
    });

    latestGalleries = all
      .sort((a, b) => (b.createdAtMillis || 0) - (a.createdAtMillis || 0))
      .slice(0, 4);
  } catch (e) {
    console.warn('[SSR] Failed to fetch latest galleries:', (e as Error)?.message);
  }

  /* ---- LATEST STORES (cms/root/stores, published only) ---- */
  let latestStores: StoreAlbum[] = [];
  try {
    // Avoid composite index by not ordering; sort in memory (like /api/store/list)
    const q = await cms.collection('stores').where('published', '==', true).limit(100).get();
    const all = q.docs.map((d: any) => {
      const x: any = d.data() || {};
      const createdAtMillis =
        x.createdAt?.toMillis?.() ?? (x.createdAt?.toDate?.() ? x.createdAt.toDate().getTime() : 0);
      return {
        id: d.id,
        name: x.name ?? '',
        title: x.title ?? '',
        address: x.address ?? '',
        slug: x.slug ?? '',
        description: x.description ?? '',
        createdAtMillis: createdAtMillis || 0,
        primaryMediaUrl: x.primaryMediaUrl ?? null,
        primaryMediaType: (x.primaryMediaType as 'image' | 'video' | null) ?? null,
        primaryMediaThumbUrl: x.primaryMediaThumbUrl ?? null,
        mediaCount: typeof x.mediaCount === 'number' ? x.mediaCount : 0,
        imageCount: typeof x.imageCount === 'number' ? x.imageCount : 0,
        videoCount: typeof x.videoCount === 'number' ? x.videoCount : 0,
      } as StoreAlbum;
    });

    latestStores = all
      .sort((a, b) => (b.createdAtMillis || 0) - (a.createdAtMillis || 0))
      .slice(0, 4);
  } catch (e) {
    console.warn('[SSR] Failed to fetch latest stores:', (e as Error)?.message);
  }

  /* ---- LATEST DONATIONS (from same API as /donate) ---- */
  let latestDonations: Campaign[] = [];
  try {
    const origin = getOrigin(ctx.req);
    const r = await fetch(`${origin}/api/donations/list`);
    const data = await r.json();
    if (r.ok && data?.items) {
      latestDonations = data.items as Campaign[];
    }
  } catch (e) {
    console.warn('[SSR] Failed to fetch donations:', (e as Error)?.message);
  }

  return {
    props: {
      sampleNews,
      sampleEvents,
      latestGalleries,
      latestStores,
      latestDonations,
    },
  };
};

/* ============================ */
/* Donation helpers (match /donate/index.tsx look & feel) */
/* ============================ */
function d_daysLeft(endAt?: number | null) {
  if (!endAt) return null;
  const diff = endAt - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
function d_percent(total: number, goal: number) {
  return Math.min(100, Math.max(0, Math.round((total / Math.max(goal, 1)) * 100)));
}
function d_youtubeThumb(u: string) {
  try {
    const url = new URL(u);
    let id = '';
    if (url.hostname.includes('youtube.com')) {
      id = url.searchParams.get('v') || '';
      if (!id && url.pathname.includes('/embed/')) id = url.pathname.split('/embed/')[1] || '';
    } else if (url.hostname === 'youtu.be') {
      id = url.pathname.replace('/', '');
    }
    return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : '';
  } catch {
    return '';
  }
}
function d_pickThumb(c: Campaign): { url: string | null; kind: 'image' | 'video' | 'youtube' | 'none' } {
  if (c.bannerUrl) return { url: c.bannerUrl, kind: 'image' };
  const list = Array.isArray(c.media) ? [...c.media] : [];
  list.sort((a, b) => Number(!!b.isPrimary) - Number(!!a.isPrimary));
  const img = list.find((m) => m.type === 'image');
  if (img) return { url: img.url, kind: 'image' };
  const yt = list.find((m) => m.type === 'youtube');
  if (yt) return { url: d_youtubeThumb(yt.url), kind: 'youtube' };
  const vid = list.find((m) => m.type === 'video');
  if (vid) return { url: null, kind: 'video' };
  return { url: null, kind: 'none' };
}
function d_formatCurrency(n: number, c: string) {
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: c as any, maximumFractionDigits: 0 }).format(n);
  } catch {
    return `${n} ${c}`;
  }
}
function d_formatInt(n: number) {
  return new Intl.NumberFormat('en-GB').format(n);
}

/** أيقونات صغيرة (مطابقة للشكل) */
function DIconHeart() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
      <path d="M12 21s-7-4.35-7-10.1A4.9 4.9 0 0 1 12 7a4.9 4.9 0 0 1 7 3.9C19 16.65 12 21 12 21Z" />
    </svg>
  );
}
function DIconUsers() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function DIconClock() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6l4 2" />
    </svg>
  );
}
function DBadge({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'default' | 'urgent' | 'done' }) {
  const tones: Record<string, string> = {
    default: 'bg-white/90 text-neutral-700 ring-neutral-200',
    urgent: 'bg-palestine-red/10 text-palestine-red ring-palestine-red/30',
    done: 'bg-palestine-green/10 text-palestine-green ring-palestine-green/30',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs ring-1 ${tones[tone]} backdrop-blur`}>
      {children}
    </span>
  );
}
function DProgressRing({ pct }: { pct: number }) {
  const v = Math.max(0, Math.min(100, pct));
  const style: React.CSSProperties = {
    background: `conic-gradient(var(--ring-color) ${v * 3.6}deg, #e5e7eb ${v * 3.6}deg)`,
  };
  return (
    <div
      className="relative h-12 w-12 rounded-full"
      style={{ ...style, ['--ring-color' as any]: 'rgb(16 185 129)' /* emerald-500 */ }}
      aria-label={`${v}% funded`}
      title={`${v}% funded`}
    >
      <div className="absolute inset-1 rounded-full bg-white flex items-center justify-center text-xs font-semibold">
        %{v}
      </div>
    </div>
  );
}

/* ============================ */
/* CLIENT: render (keep main UI) */
/* ============================ */
const HomePage: NextPage<HomePageProps> = ({
  sampleNews = [],
  sampleEvents = [],
  latestGalleries = [],
  latestStores = [],
  latestDonations = [],
}) => {
  const [email, setEmail] = useState('');
  const [newsletterStatus, setNewsletterStatus] = useState<'idle' | 'subscribed' | 'error'>('idle');

  const subscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    try {
      await new Promise((r) => setTimeout(r, 500));
      setNewsletterStatus('subscribed');
      setEmail('');
    } catch {
      setNewsletterStatus('error');
    }
  };

  // Precompute top lists (4 as requested)
  const newsTop = Array.isArray(sampleNews) ? sampleNews.slice(0, 4) : [];
  const eventsTop = Array.isArray(sampleEvents) ? sampleEvents.slice(0, 4) : [];
  const galleriesTop = Array.isArray(latestGalleries) ? latestGalleries.slice(0, 4) : [];
  const storesTop = Array.isArray(latestStores) ? latestStores.slice(0, 4) : [];

  // Donations: sort like /donate (urgent -> active -> highest progress)
  const donationsSorted = useMemo(() => {
    const items = Array.isArray(latestDonations) ? [...latestDonations] : [];
    items.sort((a, b) => {
      const la = d_daysLeft(a.endAt); const lb = d_daysLeft(b.endAt);
      const urgentA = la !== null && la <= 7 && la > 0 ? 1 : 0;
      const urgentB = lb !== null && lb <= 7 && lb > 0 ? 1 : 0;
      if (urgentA !== urgentB) return urgentB - urgentA;
      const activeA = a.status === 'active' ? 1 : 0;
      const activeB = b.status === 'active' ? 1 : 0;
      if (activeA !== activeB) return activeB - activeA;
      return (b.totalDonated / Math.max(b.goalAmount, 1)) - (a.totalDonated / Math.max(a.goalAmount, 1));
    });
    return items;
  }, [latestDonations]);
  const donationsTop = donationsSorted.slice(0, 4);

  // Slide data (Arabic)
const slideData = [
  {
    icon: '📊',
    src: '/images/gazago/hero-welcome.jpg',
    alt: 'Gaza Go — From Relief to Sustainable Impact',
    headlineAr: 'Gaza Go — من الإغاثة إلى أثرٍ مستدام',
    headlineEn: 'Gaza Go — From Relief to Sustainable Impact',
    subtextAr:
      'منصة تغيّر المعادلة: وظائف حقيقية، أسعار عادلة، وخدمات مجتمعية بشفافية قابلة للتدقيق.',
    subtextEn:
      'A platform that changes the equation: real jobs, fair prices, and community services with auditable transparency.',
    cta: {
      label: 'تعرّف على البرامج • Explore Programs',
      href: '/donate',
      ariaLabel: 'Explore Gaza Go programs',
    },
  },
  {
    icon: '🥖',
    src: '/images/gazago/khidma-bakery.jpg',
    alt: 'Khidma Go — Bakery',
    headlineAr: 'خِدمة Go: فرن الخبز البلدي',
    headlineEn: 'Khidma Go: Community Bakery',
    subtextAr:
      'تشغيل يعتمد الأيدي العاملة بنسبة 100% ويوفّر 15–20 فرصة عمل للشباب والنساء، مع دعم رغيف الخبز.',
    subtextEn:
      '100% human-operated bakery creating 15–20 steady jobs for youth and women, with a fair bread subsidy.',
    cta: {
      label: 'ادعم الفرن • Support the Bakery',
      href: '/donate?campaign=bakery',
      ariaLabel: 'Donate to bakery campaign',
    },
  },
  {
    icon: '🛒',
    src: '/images/gazago/khidma-market.jpg',
    alt: 'Khidma Go — Fair Price Market',
    headlineAr: 'خِدمة Go: سوق بالسعر العادل',
    headlineEn: 'Khidma Go: Fair-Price Market',
    subtextAr:
      'سلع أساسية بخدمة محترفة و30–50 وظيفة، ونظام مخزون ذكي لتثبيت الأسعار وقت التذبذب.',
    subtextEn:
      'Essentials with pro service and 30–50 jobs, backed by smart inventory to stabilise prices during volatility.',
    cta: {
      label: 'ساهم في الاستقرار السعري • Stabilise Prices',
      href: '/donate?campaign=market',
      ariaLabel: 'Donate to fair-price market',
    },
  },
  {
    icon: '🤝',
    src: '/images/gazago/care-networking.jpg',
    alt: 'Care Networking — Everyone Wins',
    headlineAr: 'خِدمة Go: التشبيك الخدمي (الكل يكسب)',
    headlineEn: 'Khidma Go: Care Networking (Everyone Wins)',
    subtextAr:
      'باقات موسمية مع قطاعات عامة وخاصة، عقود واضحة، وعوائد تعود لتوسيع الخدمة ودعم الأشد حاجة.',
    subtextEn:
      'Seasonal bundles with public/private sectors, clear contracts, and returns reinvested to expand services.',
    cta: {
      label: 'اكتشف الباقات • Explore Bundles',
      href: '/programs#care',
      ariaLabel: 'Explore care networking bundles',
    },
  },
  {
    icon: '🔢',
    src: '/images/gazago/not-only-number.jpg',
    alt: 'Not Only — Number',
    headlineAr: 'Not Only: رقم',
    headlineEn: 'Not Only: Number',
    subtextAr:
      'نُعيد للأرقام وجوهًا وأسماءً—توثيق عائلات مُسحت من السجل أو تبقّى منها فرد واحد، مع مسارات دعم مباشرة.',
    subtextEn:
      'We restore faces to numbers—documenting erased families or sole survivors, with direct support pathways.',
    cta: {
      label: 'شاهد وادعم • Watch & Support',
      href: '/not-only/number',
      ariaLabel: 'View Not Only: Number',
    },
  },
  {
    icon: '🪨',
    src: '/images/gazago/not-only-stone.jpg',
    alt: 'Not Only — Stone',
    headlineAr: 'Not Only: حجر',
    headlineEn: 'Not Only: Stone',
    subtextAr:
      'سرد محترم لعائلات دُمّرت منازلها وتعذّر انتشالها—نوفر مسارات دعم: سكن مؤقت وتعويضات مجتمعية.',
    subtextEn:
      'Respectful storytelling for families whose homes collapsed—support via temporary shelter and community compensation.',
    cta: {
      label: 'شاهد وادعم • Watch & Support',
      href: '/not-only/stone',
      ariaLabel: 'View Not Only: Stone',
    },
  },
  {
    icon: '🌸',
    src: '/images/gazago/not-only-flower.jpg',
    alt: 'Not Only — Flower',
    headlineAr: 'Not Only: زهرة',
    headlineEn: 'Not Only: Flower',
    subtextAr:
      'نُوثّق مَن ارتقوا وهم يحاولون الحصول على المساعدة—مع دعوات فعل: منحة تعليم، رعاية نفسية، أو كفالة إنتاجية.',
    subtextEn:
      'Documenting those who fell seeking aid—with calls to action: scholarships, psychosocial care, or productive sponsorships.',
    cta: {
      label: 'شاهد وادعم • Watch & Support',
      href: '/not-only/flower',
      ariaLabel: 'View Not Only: Flower',
    },
  },
  {
    icon: '🐜',
    src: '/images/gazago/ants.jpg',
    alt: 'Ant’s (Kayan) — Teams & Talents',
    headlineAr: 'Ant’s (كيان): فرق ومواهب',
    headlineEn: 'Ant’s (Kayan): Teams & Talents',
    subtextAr:
      'ممكن (قانونية/لوجستية/تقنية)، إيجابيون (ألتراس افتراضي)، وبودكاست رواه أنا، لتفعيل المسؤولية الفردية.',
    subtextEn:
      'Momken (legal/logistics/tech), Eejabyon (virtual ultras), and Rawah Ana podcast to activate individual responsibility.',
    cta: {
      label: 'انضم للفِرق • Join the Teams',
      href: '/ants',
      ariaLabel: 'Join Ant’s programs',
    },
  },
  {
    icon: '📊',
    src: '/images/gazago/transparency.jpg',
    alt: 'Transparency & Governance',
    headlineAr: 'حوكمة وشفافية تُوثَق',
    headlineEn: 'Governance & Transparency',
    subtextAr:
      'تقارير ربع سنوية علنية، تدقيق مستقل، وسياسة تسعير عادل—كل شيكل مُسجّل ويمكن تتبّعه.',
    subtextEn:
      'Quarterly public reports, independent audit, and a fair-pricing policy—every shekel is recorded and traceable.',
    cta: {
      label: 'اطّلع على التقارير • View Reports',
      href: '/transparency',
      ariaLabel: 'View transparency reports',
    },
  },
  {
    icon: '💚',
    src: '/images/gazago/donate.png',
    alt: 'Donate to Campaigns',
    headlineAr: 'تبرّع الآن—حوّل التعاطف إلى عمل',
    headlineEn: 'Support Now—Turn Care into Action',
    subtextAr:
      'هديتك اليوم تُنشئ وظيفة، وتثبت سعرًا، وتفتح باب خدمة. اختر حملة واصنع فرقًا ملموسًا.',
    subtextEn:
      'Your gift today creates a job, stabilises a price, and opens a service door. Pick a campaign and make tangible impact.',
    cta: {
      label: 'اختر حملة • Choose a Campaign',
      href: '/donate',
      ariaLabel: 'Donate to Gaza Go campaigns',
    },
  },
];

  // Helper: "new" within 7 days
  const isNew = (createdAtMillis: number | null) => {
    if (!createdAtMillis) return false;
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    return Date.now() - createdAtMillis < sevenDays;
  };

  // Helpers to parse ISO dates for News/Events "New" chip
  const millis = (iso?: string | null) => {
    if (!iso) return null;
    const t = Date.parse(iso);
    return Number.isFinite(t) ? t : null;
  };

  const stats: { label: string; value: number | string }[] = [];

  return (
    <>
      <Head>
        <title>Home • Gaza Go  📊</title>
        <meta
          name="description"
          content="home-page"
        />
      </Head>

      <Layout announcement="">
        {/* Hero slideshow */}
        <section aria-label="Hero" className="section">
          <HeroSlideshow slides={slideData} intervalMs={5000} />
        </section>

        {/* Quick stats */}
        {stats.length > 0 && (
          <section className="section">
            <div className="container mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
              {stats.map((s) => (
                <div
                  key={s.label}
                  className="bg-white rounded-xl shadow-card p-6 flex flex-col items-center text-center"
                >
                  <div className="text-sm uppercase tracking-wider text-palestine-muted">
                    {s.label}
                  </div>
                  <div className="text-3xl font-bold mt-1">{s.value}</div>
                </div>
              ))}
            </div>
          </section>
        )}
        {/* Divider with Palestine flag colors */}
        <FlagDivider />
		{/* NEW: Latest Donations (mirrors /donate cards) */}
        {/* ===================== */}
        <section aria-label="Latest donations" className="section">
          <div className="container mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold">Latest projects:</h2>
                <p className="text-sm text-palestine-muted mt-1">Support an urgent or ongoing project today.</p>
              </div>
              <Link href="/donate" aria-label="View all donations">
                <Button variant="outline">View all</Button>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {donationsTop.length > 0 ? (
                donationsTop.map((c) => {
                  const left = d_daysLeft(c.endAt);
                  const pct = d_percent(c.totalDonated, c.goalAmount);
                  const thumb = d_pickThumb(c);
                  const urgent = left !== null && left <= 7 && left > 0;
                  const closed = left === 0 || c.status === 'closed';
                  const donorsLabel = `${d_formatInt(c.donorsCount)} donors`;

                  return (
                    <div
                      key={c.id}
                      className="group relative rounded-2xl p-[1px] bg-gradient-to-br from-palestine-green/30 via-emerald-400/20 to-palestine-red/30 hover:from-palestine-green/60 hover:to-palestine-red/60 transition-colors"
                    >
                      <div className="rounded-2xl bg-white overflow-hidden shadow-sm ring-1 ring-black/5 transition-all group-hover:shadow-xl">
                        {/* Media */}
                        <div className="relative h-48 w-full bg-neutral-100 overflow-hidden">
                          {thumb.url ? (
                            <Image
                              src={thumb.url}
                              alt={c.title_ar}
                              fill
                              className="object-cover transform group-hover:scale-[1.02] transition-transform"
                              sizes="(max-width:768px) 100vw, (max-width:1024px) 50vw, 25vw"
                              priority={false}
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-neutral-500">
                              {thumb.kind === 'video' ? (
                                <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                                  <rect x="3" y="6" width="18" height="12" rx="2" />
                                  <path d="M10 9l5 3-5 3z" />
                                </svg>
                              ) : (
                                <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                                  <rect x="3" y="4" width="18" height="16" rx="2" />
                                  <path d="M3 16l5-5 4 4 3-3 4 4" />
                                  <circle cx="8" cy="9" r="1.5" />
                                </svg>
                              )}
                            </div>
                          )}

                          {/* status badges */}
                          <div className="absolute top-2 left-2 flex items-center gap-2">
                            {closed ? <DBadge tone="done">Closed</DBadge> : urgent ? <DBadge tone="urgent">Urgent</DBadge> : <DBadge>Ongoing</DBadge>}
                            {(thumb.kind === 'youtube' || thumb.kind === 'video') && <DBadge>Video</DBadge>}
                          </div>

                          {/* subtle gradient at bottom */}
                          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/35 to-transparent" />
                        </div>

                        {/* content */}
                        <div className="p-4 space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <h3 className="text-xl font-bold line-clamp-2">{c.title_ar}</h3>
                            <DProgressRing pct={pct} />
                          </div>

                          <div className="grid grid-cols-3 text-xs text-neutral-700">
                            <div className="flex items-center gap-1"><DIconHeart /> <span>{d_formatCurrency(c.totalDonated, c.currency)}</span></div>
                            <div className="flex items-center gap-1"><DIconUsers /> <span>{donorsLabel}</span></div>
                            <div className="flex items-center gap-1">
                              <DIconClock />
                              <span>{left === null ? 'Open' : left === 0 ? 'Ended' : `${d_formatInt(left)} days`}</span>
                            </div>
                          </div>

                          <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden" aria-label="Funding progress">
                            <div className="h-3 bg-palestine-green rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="text-xs text-neutral-600 text-center">
                            Goal: {d_formatCurrency(c.goalAmount, c.currency)}
                          </div>

                          <div className="flex gap-2 pt-1">
                            <Link
                              href={`/donate/${c.slug}`}
                              className="flex-1 text-center rounded-xl bg-palestine-green text-white py-2 font-semibold hover:opacity-90"
                            >
                              Donate Now
                            </Link>
                            <Link
                              href={`/donate/${c.slug}`}
                              className="flex-1 text-center rounded-xl bg-white ring-1 ring-neutral-200 py-2 font-semibold hover:bg-neutral-50"
                            >
                              Read Story
                            </Link>
                          </div>

                          <p className="text-xs text-neutral-600 text-center">
                            Give boldly—your generosity builds dignity and hope.
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-full text-center text-palestine-muted">
                  No active projects right now.
                </div>
              )}
            </div>

            {donationsTop.length > 0 && (
              <div className="flex justify-end">
                <Link href="/donate" aria-label="See all donations">
                  <Button variant="outline">See more</Button>
                </Link>
              </div>
            )}
          </div>
        </section>
		{/* Divider with Palestine flag colors */}
        <FlagDivider />
        {/* ===================== */}

        {/* ===================== */}
        {/* Highlights: News + Events side-by-side with same card style as Store */}
        {/* ===================== */}
        <section aria-label="Community highlights" className="section">
          <div className="container mx-auto">
            {/* 3-cols: left / vertical flag line / right */}
            <div className="grid gap-10 lg:grid-cols-[1fr_auto_1fr] items-start">
              {/* Latest News — same style as Store */}
              <section aria-labelledby="home-latest-news" className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 id="home-latest-news" className="text-3xl font-bold">
                      Latest News:
                    </h2>
                    <p className="text-sm text-palestine-muted mt-1">What&apos;s new in our community.</p>
                  </div>
                  <Link href="/news" aria-label="View all news">
                    <Button variant="outline">View all</Button>
                  </Link>
                </div>

                <div className="grid gap-6 sm:grid-cols-2 items-stretch">
                  {newsTop.length > 0 ? (
                    newsTop.map((n, idx) => {
                      const hasPrimary = !!n.imageUrl;
                      const cover = n.imageUrl || '';
                      const createdMs = millis(n.publishedAt);
                      const fresh = isNew(createdMs);
                      const articleUrl = `/news/${n.slug || n.id}`;

                      // ---- FIX: stable date string for SSR/CSR parity
                      const whenText = formatDateTimeISO(n.publishedAt);
                      const whenISO = toISOStringSafe(n.publishedAt) || '';

                      const excerpt =
                        (n as unknown as any)?.excerpt ||
                        (n.content || '').replace(/<[^>]*>/g, '').slice(0, 140);

                      return (
                        <div
                          key={n.id ?? `news-${idx}`}
                          className="group relative rounded-3xl border border-neutral-200 bg-white/90 backdrop-blur overflow-hidden hover:shadow-[0_20px_60px_-20px_rgba(0,0,0,0.25)] transition will-change-transform hover:-translate-y-0.5"
                        >
                          <div className="relative aspect-[16/9] w-full bg-neutral-100">
                            {hasPrimary ? (
                              <Image
                                src={cover}
                                alt={n.title || 'News'}
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
                            <div className="absolute top-3 right-3 rounded-full px-2.5 py-1 text-xs bg-white/95 text-neutral-800 border backdrop-blur-sm">
                              Article
                            </div>

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
                                  {n.title}
                                </h3>
                                {whenText ? (
                                  <div className="mt-1 text-xs text-neutral-500">
                                    <time suppressHydrationWarning dateTime={whenISO}>
                                      {whenText}
                                    </time>
                                  </div>
                                ) : null}
                              </div>
                            </div>

                            {excerpt ? (
                              <p className="mt-2 text-sm text-neutral-600 line-clamp-2">{excerpt}</p>
                            ) : null}

                            <div className="mt-3 flex items-center gap-2">
                              <Link
                                href={articleUrl}
                                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm text-white bg-[#007A3D] hover:opacity-95 active:scale-[0.99] transition"
                              >
                                Read Article
                              </Link>
                              <Link
                                href={articleUrl}
                                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm text-neutral-900 ring-1 ring-neutral-200 hover:bg-neutral-50 active:scale-[0.99] transition"
                              >
                                More Details...
                              </Link>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="col-span-full text-center text-palestine-muted">
                      No news available right now.
                    </div>
                  )}
                </div>

                {newsTop.length > 0 && (
                  <div className="flex justify-end">
                    <Link href="/news" aria-label="See more news">
                      <Button variant="outline">See more</Button>
                    </Link>
                  </div>
                )}
              </section>

              {/* Vertical Flag Line */}
              <div
                className="hidden lg:block w-px self-stretch rounded-full bg-[linear-gradient(180deg,#000_0%,#dc2626_33%,#ffffff_66%,#16a34a_100%)]"
                role="separator"
                aria-hidden="true"
              />

              {/* Upcoming Events — same style as Store */}
              <section aria-labelledby="home-upcoming-events" className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 id="home-upcoming-events" className="text-3xl font-bold">
                      Upcoming Events:
                    </h2>
                    <p className="text-sm text-palestine-muted mt-1">Join us in person and online.</p>
                  </div>
                  <Link href="/events" aria-label="View all events">
                    <Button variant="outline">View all</Button>
                  </Link>
                </div>

                <div className="grid gap-6 sm:grid-cols-2 items-stretch">
                  {eventsTop.length > 0 ? (
                    eventsTop.map((ev, idx) => {
                      const hasPrimary = !!ev.imageUrl;
                      const cover = ev.imageUrl || '';
                      const startMs = millis(ev.startTime);
                      const fresh = isNew(startMs);
                      const eventUrl = `/events/${(ev as unknown as any).slug || ev.id}`;

                      // ---- FIX: stable date string for SSR/CSR parity
                      const whenText = formatDateTimeISO(ev.startTime);
                      const whenISO = toISOStringSafe(ev.startTime) || '';

                      const typeBadge = (ev as unknown as any).videoUrl ? 'Video cover' : 'Event';

                      return (
                        <div
                          key={ev.id ?? `event-${idx}`}
                          className="group relative rounded-3xl border border-neutral-200 bg-white/90 backdrop-blur overflow-hidden hover:shadow-[0_20px_60px_-20px_rgba(0,0,0,0.25)] transition will-change-transform hover:-translate-y-0.5"
                        >
                          <div className="relative aspect-[16/9] w-full bg-neutral-100">
                            {hasPrimary ? (
                              <Image
                                src={cover}
                                alt={ev.title || 'Event'}
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
                            <div className="absolute top-3 right-3 rounded-full px-2.5 py-1 text-xs bg-white/95 text-neutral-800 border backdrop-blur-sm">
                              {typeBadge}
                            </div>

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
                                  {ev.title}
                                </h3>

                                {whenText ? (
                                  <div className="mt-1 text-[13px] text-neutral-600">
                                    <time suppressHydrationWarning dateTime={whenISO}>
                                      {whenText}
                                    </time>
                                    {ev.location ? <span className="mx-1.5">•</span> : null}
                                    {ev.location ? <span>{ev.location}</span> : null}
                                  </div>
                                ) : null}
                              </div>
                            </div>

                            {ev.description ? (
                              <p className="mt-2 text-sm text-neutral-600 line-clamp-2">{ev.description}</p>
                            ) : null}

                            <div className="mt-3 flex items-center gap-2">
                              <Link
                                href={eventUrl}
                                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm text-white bg-[#007A3D] hover:opacity-95 active:scale-[0.99] transition"
                              >
                                View Details
                              </Link>
                              <Link
                                href={eventUrl}
                                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm text-neutral-900 ring-1 ring-neutral-200 hover:bg-neutral-50 active:scale-[0.99] transition"
                              >
                                More Info...
                              </Link>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="col-span-full text-center text-palestine-muted">
                      No events available right now.
                    </div>
                  )}
                </div>

                {eventsTop.length > 0 && (
                  <div className="flex justify-end">
                    <Link href="/events" aria-label="See more events">
                      <Button variant="outline">See more</Button>
                    </Link>
                  </div>
                )}
              </section>
            </div>
          </div>
        </section>
        {/* Divider with Palestine flag colors */}
        <FlagDivider />
        {/* ===================== */}
  

        {/* NEW: Latest Gallery + Latest Store (mirrors Store card style) */}
        {/* ===================== */}
        <section aria-label="Gallery and Store highlights" className="section">
          <div className="container mx-auto">
            <div className="grid gap-10 lg:grid-cols-[1fr_auto_1fr] items-start">
              {/* Latest Gallery — same card & buttons as Store */}
              <section aria-labelledby="home-latest-gallery" className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 id="home-latest-gallery" className="text-3xl font-bold">
                      Latest activities:
                    </h2>
                    <p className="text-sm text-palestine-muted mt-1">Fresh photos and videos from our community.</p>
                  </div>
                  <Link href="/gallery" aria-label="View full gallery">
                    <Button variant="outline">View all</Button>
                  </Link>
                </div>

                <div className="grid gap-6 sm:grid-cols-2 items-stretch">
                  {galleriesTop.length > 0 ? (
                    galleriesTop.map((a) => {
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
                                alt={a.title || 'Gallery'}
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
                                <div className="mt-1 text-xs text-neutral-500">{counts}</div>
                              </div>
                            </div>

                            {a.description ? (
                              <p className="mt-2 text-sm text-neutral-600 line-clamp-2">{a.description}</p>
                            ) : null}

                            <div className="mt-3 flex items-center gap-2">
                              <Link
                                href={`/gallery/${a.slug}`}
                                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm text-white bg-[#007A3D] hover:opacity-95 active:scale-[0.99] transition"
                              >
                                Img/Vid Preview
                              </Link>
                              <Link
                                href={`/gallery/${a.slug}`}
                                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm text-neutral-900 ring-1 ring-neutral-200 hover:bg-neutral-50 active:scale-[0.99] transition"
                              >
                                More Details...
                              </Link>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="col-span-full text-center text-palestine-muted">No gallery items yet.</div>
                  )}
                </div>

                {galleriesTop.length > 0 && (
                  <div className="flex justify-end">
                    <Link href="/gallery" aria-label="See more gallery">
                      <Button variant="outline">See more</Button>
                    </Link>
                  </div>
                )}
              </section>

              {/* Vertical Flag Line */}
              <div
                className="hidden lg:block w-px self-stretch rounded-full bg-[linear-gradient(180deg,#000_0%,#dc2626_33%,#ffffff_66%,#16a34a_100%)]"
                role="separator"
                aria-hidden="true"
              />

              {/* Latest Store (as uploaded under cms/root/stores) */}
              <section aria-labelledby="home-latest-store" className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 id="home-latest-store" className="text-3xl font-bold">
                      Latest Store/Services:
                    </h2>
                    <p className="text-sm text-palestine-muted mt-1">Support our initiatives — new items added.</p>
                  </div>
                  <Link href="/store" aria-label="View all products">
                    <Button variant="outline">View all</Button>
                  </Link>
                </div>

                <div className="grid gap-6 sm:grid-cols-2 items-stretch">
                  {storesTop.length > 0 ? (
                    storesTop.map((a) => {
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
                                alt={a.title || 'Store'}
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
                            </div>

                            {a.description ? (
                              <p className="mt-2 text-sm text-neutral-600 line-clamp-2">{a.description}</p>
                            ) : null}

                            <div className="mt-3 flex items-center gap-2">
                              <Link
                                href={`/store/${a.slug}`}
                                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm text-white bg-[#007A3D] hover:opacity-95 active:scale-[0.99] transition"
                              >
                                Img/Vid Preview
                              </Link>
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
                    })
                  ) : (
                    <div className="col-span-full text-center text-palestine-muted">No items in the store yet.</div>
                  )}
                </div>

                {storesTop.length > 0 && (
                  <div className="flex justify-end">
                    <Link href="/store" aria-label="See more products">
                      <Button variant="outline">See more</Button>
                    </Link>
                  </div>
                )}
              </section>
            </div>
          </div>
        </section>

        {/* Divider with Palestine flag colors */}
        <FlagDivider />
        {/* Final CTA (unchanged) */}
        <section className="section">
          <div className="container mx-auto rounded-xl overflow-hidden relative bg-palestine-dark text-white">
            <div className="absolute inset-0 bg-gradient-to-r from-palestine-green/70 to-palestine-red/70 mix-blend-overlay" />
            <div className="relative flex flex-col md:flex-row items-center gap-8 py-16 px-8">
              <div className="flex-1">
                <h2 dir="rtl" className="text-4xl font-bold flex items-center gap-3 flex-row-reverse">
                  <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/10 ring-2 ring-white/30">
                    <Handshake className="w-7 h-7" aria-hidden="true" />
                  </span>
                  <span>معًا نصنع الأثر ونبقى أقوى</span>
                </h2>
                <p className="mt-2 text-lg">
                  .أيُّ شكلٍ من أشكالِ الدعم—انضمامًا، تطوّعًا، أو تبرّعًا—يُحيي جاليتنا الفلسطينية، ويُنَمّي
                  روابطَها، ويضمنُ استدامتَها
                </p>
                <div className="mt-6 flex flex-wrap gap-4">
                  <Link href="/join">
                    <Button variant="primary">Join Now</Button>
                  </Link>
                  <Link href="/donate">
                    <Button variant="outline" className="text-white border-white">
                      Donate
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="flex-shrink-0">
                <div className="relative w-40 h-40 rounded-full overflow-hidden bg-white shadow-lg ring-4 ring-palestine-accent">
                  <Image
                    src="/logo.jpg" // same asset as the navbar
                    alt="Palestinian Community Association logo"
                    fill
                    className="object-contain p-3"
                    sizes="160px"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      </Layout>
    </>
  );
};

export default HomePage;
