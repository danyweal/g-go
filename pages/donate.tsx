// pages/donate/index.tsx
import React, { useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Layout from '../components/Layout';

/**
 * ──────────────────────────────────────────────────────────────────────────────
 * Donate Index – Bilingual (EN/AR) with Gaza Go copy, improved sections & icons
 * - RTL/LTR aware
 * - Hero with value props
 * - Filters/search
 * - Campaign grid (cards)
 * - Programs strip (Khidma / Not Only / Ant's)
 * - Impact stats
 * - Transparency badges
 * - FAQ (details/summary)
 * - Sticky CTA to nearest open campaign
 * Tailwind only; no external icon libs.
 * ──────────────────────────────────────────────────────────────────────────────
 */

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

type Props = { campaigns: Campaign[]; error?: string | null };

const getOrigin = (req: any) => {
  const proto = (req?.headers?.['x-forwarded-proto'] as string) || 'http';
  const host = (req?.headers?.['x-forwarded-host'] as string) || (req?.headers?.host as string) || 'localhost:3000';
  return `${proto}://${host}`;
};

export async function getServerSideProps({ req }: any) {
  try {
    const origin = getOrigin(req);
    const r = await fetch(`${origin}/api/donations/list`);
    const data = await r.json();
    if (!r.ok || data?.ok === false) throw new Error(data?.error || 'Failed to load');
    return { props: { campaigns: data.items || [] } };
  } catch (e: any) {
    return { props: { campaigns: [], error: e?.message || 'Error' } };
  }
}

function daysLeft(endAt?: number | null) {
  if (!endAt) return null;
  const diff = endAt - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
function percent(total: number, goal: number) {
  return Math.min(100, Math.max(0, Math.round((total / Math.max(goal, 1)) * 100)));
}
function youtubeThumb(u: string) {
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
  } catch { return ''; }
}

/** اختر صورة/غلاف للحملة؛ نضمن ظهور صورة حتى لو ما في bannerUrl */
function pickThumb(c: Campaign): { url: string | null; kind: 'image' | 'video' | 'youtube' | 'none' } {
  if (c.bannerUrl) return { url: c.bannerUrl, kind: 'image' };
  const list = Array.isArray(c.media) ? [...c.media] : [];
  list.sort((a, b) => Number(!!b.isPrimary) - Number(!!a.isPrimary));
  const img = list.find(m => m.type === 'image');
  if (img) return { url: img.url, kind: 'image' };
  const yt = list.find(m => m.type === 'youtube');
  if (yt) return { url: youtubeThumb(yt.url), kind: 'youtube' };
  const vid = list.find(m => m.type === 'video');
  if (vid) return { url: null, kind: 'video' };
  return { url: null, kind: 'none' };
}

/**
 * Icons – minimal inline SVGs
 */
function IconHeart() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
      <path d="M12 21s-7-4.35-7-10.1A4.9 4.9 0 0 1 12 7a4.9 4.9 0 0 1 7 3.9C19 16.65 12 21 12 21Z" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function IconClock() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6l4 2" />
    </svg>
  );
}
function IconGlobe() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
    </svg>
  );
}
function IconShield() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M12 2l7 4v6a9 9 0 0 1-7 8 9 9 0 0 1-7-8V6l7-4z" />
    </svg>
  );
}
function IconChart() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M3 3v18h18" />
      <path d="M7 15v3M12 11v7M17 7v11" />
    </svg>
  );
}
function IconHandshake() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M7 12l3 3 4-4 3 3" />
      <path d="M2 12l5-5h5l5 5" />
    </svg>
  );
}
function IconLeaf() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M3 21s6-2 9-5 9-13 9-13-10 2-13 5S3 21 3 21z" />
    </svg>
  );
}

function Badge({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'default' | 'urgent' | 'done' }) {
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

/** دائرة تقدم أنيقة باستخدام conic-gradient (بدون مكتبات) */
function ProgressRing({ pct }: { pct: number }) {
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

/** ترجمة بسيطة داخل الصفحة */
type Lang = 'en' | 'ar';
const t = (lang: Lang) => ({
  // SEO
  seoTitle: lang === 'en' ? 'Gaza Go — Donate: From Relief to Sustainable Impact' : 'Gaza Go — التبرعات: من الإغاثة إلى أثر مستدام',
  seoDesc: lang === 'en'
    ? 'Support Gaza Go programs: Khidma Go (bread, fair-price market, care networking), Not Only (narratives that mobilize action), and Ant’s (talent, volunteers, and podcast). Give with confidence.'
    : 'ادعم برامج Gaza Go: خِدمة Go (الخبز، السوق العادل، التشبيك الخدمي)، Not Only (سرديات تُحوّل التعاطف إلى فعل)، وAnt’s (الفرق والمهارات والبودكاست). عطاء بثقة.',

  // HERO
  heroTitle: lang === 'en'
    ? 'Give to build dignity. Fund work that creates jobs, stabilizes prices, and serves people.'
    : 'ادعم لتبني الكرامة: موّل عملاً يخلق وظائف ويثبت الأسعار ويخدم الناس.',
  heroSubtitle: lang === 'en'
    ? 'Your donation powers three linked tracks: Khidma Go (service ventures), Not Only (truthful storytelling to mobilize support), and Ant’s (teams and talents). Transparent. Audited. Local-first.'
    : 'تبرعك يغذي ثلاثة مسارات مترابطة: خِدمة Go (مشروعات خدمية مستدامة)، Not Only (سرديات تُحرّك الدعم)، وAnt’s (فرق ومواهب). شفافية وتدقيق وأولوية محلية.',
  ctaBrowse: lang === 'en' ? 'Browse campaigns' : 'تصفّح الحملات',
  ctaVolunteer: lang === 'en' ? 'Contact US' : 'توصل معنا',

  // Value props
  vp1Title: lang === 'en' ? 'Jobs, not just aid' : 'وظائف لا إعانات عابرة',
  vp1Body: lang === 'en'
    ? 'Khidma Go starts with a human-labour bakery (15–20 steady jobs) and a fair-price market (30–50 jobs). Profits cycle back into services.'
    : 'خِدمة Go تبدأ بفرنٍ كثيف التشغيل البشري (15–20 وظيفة ثابتة) وسوقٍ بالسعر العادل (30–50 وظيفة). تُعاد الفوائض لخدمة المجتمع.',
  vp2Title: lang === 'en' ? 'Fair pricing & stability' : 'تسعير عادل واستقرار',
  vp2Body: lang === 'en'
    ? 'Smart inventory and pre-contracting protect families from price spikes. A public dashboard shows costs and margins.'
    : 'مخزون ذكي وتعاقدات مسبقة تحمي العائلات من قفزات الأسعار، مع لوحة شفافية تُظهر الكلفة وهامش الربح.',
  vp3Title: lang === 'en' ? 'Accountability & stories' : 'مساءلة وسرديات صادقة',
  vp3Body: lang === 'en'
    ? 'Not Only (Number/Stone/Flower) restores names and choices; Ant’s trains legal/logistics/tech teams and mobilizes Eejabyon.'
    : 'Not Only (رقم/حجر/زهرة) تعيد الأسماء والاختيار؛ وAnt’s يؤهل فرقًا قانونية ولوجستية وتقنية ويُفعّل إيجابيون.',

  // FILTERS
  filtersAll: lang === 'en' ? 'All' : 'الكل',
  filtersUrgent: lang === 'en' ? 'Urgent' : 'عاجلة',
  filtersActive: lang === 'en' ? 'Active' : 'جارية',
  filtersClosed: lang === 'en' ? 'Closed' : 'مغلقة',
  searchPlaceholder: lang === 'en' ? 'Search projects…' : 'ابحث عن مشروع…',

  // CARD
  statusUrgent: lang === 'en' ? 'Urgent' : 'عاجلة',
  statusRunning: lang === 'en' ? 'Ongoing' : 'جارية',
  statusClosed: lang === 'en' ? 'Closed' : 'مغلقة',
  labelVideo: lang === 'en' ? 'Video' : 'فيديو',
  donors: lang === 'en' ? 'donors' : 'متبرّع',
  open: lang === 'en' ? 'Open' : 'مفتوحة',
  ended: lang === 'en' ? 'Ended' : 'انتهت',
  days: lang === 'en' ? 'days' : 'يوم',
  goal: lang === 'en' ? 'Goal' : 'الهدف',
  donateNow: lang === 'en' ? 'Support Now' : 'ادعم الأن',
  readStory: lang === 'en' ? 'Read Story' : 'اقرأ القصة',
  impactLine: lang === 'en'
    ? 'Give boldly—your generosity builds dignity and hope.'
    : 'أعطِ بقوّة—كرمك يبني الكرامة ويصنع الأمل.',

  // Empty state & sticky
  emptyText: lang === 'en' ? 'No campaigns match your filters.' : 'لا توجد حملات مطابقة للتصفية الحالية.',
  stickyTitle: lang === 'en' ? 'The nearest open campaign' : 'أقرب حملة مفتوحة',
  stickySub: lang === 'en' ? 'Your gift today keeps prices fair and jobs running.' : 'هديتك اليوم تثبّت الأسعار وتُبقي فرص العمل.',
  stickyDonateNearest: lang === 'en' ? 'Donate to this one' : 'تبرّع لهذه الحملة',
  stickyBrowseAll: lang === 'en' ? 'Browse all' : 'تصفّح الكل',

  // Programs strip
  programsTitle: lang === 'en' ? 'Where your donation goes' : 'إلى أين يذهب تبرعك؟',
  p1Title: lang === 'en' ? 'Khidma: Bakery' : 'خِدمة: فرن الخبز',
  p1Body: lang === 'en' ? 'Human-centred bakery creating 15–20 steady jobs and subsidised bread.' : 'فرن يعتمد الأيدي العاملة ويوفر 20-15 وظيفة ودعماً لرغيف الخبز.',
  p2Title: lang === 'en' ? 'Khidma: Fair Market' : 'خِدمة: سوق بالسعر العادل',
  p2Body: lang === 'en' ? 'Essential goods with smart inventory to stabilise prices and 30–50 jobs.' : 'سلع أساسية بمخزون ذكي لتثبيت الأسعار وخلق 30–50 وظيفة.',
  p3Title: lang === 'en' ? 'Care Networking' : 'التشبيك الخدمي',
  p3Body: lang === 'en' ? 'Seasonal service bundles—public/private partnerships where everyone wins.' : 'باقات خدمات موسمية مع شراكات عامة/خاصة على قاعدة الكل يكسب.',
  p4Title: lang === 'en' ? 'Not Only' : 'Not Only',
  p4Body: lang === 'en' ? 'Number • Stone • Flower: truthful stories that mobilise support.' : 'رقم • حجر • زهرة: سرديات صادقة تُحرّك الدعم.',
  p5Title: lang === 'en' ? "Ant's (Kayan)" : 'Ant’s (كيان)',
  p5Body: lang === 'en' ? 'Momken teams • Eejabyon • Rawah Ana podcast & talents.' : 'ممكن • إيجابيون • بودكاست رواه أنا ورعاية المواهب.',

  // Impact & transparency
  impactTitle: lang === 'en' ? '12‑month expected impact' : 'الأثر المتوقع خلال 12 شهرًا',
  i1: lang === 'en' ? '≥ 100 direct jobs' : '≥ 100 وظيفة مباشرة',
  i2: lang === 'en' ? 'Price stability ≥ 15%' : 'استقرار سعري ≥ 15%‏',
  i3: lang === 'en' ? '≥ 1,000 direct beneficiaries' : '≥ 1,000 مستفيد مباشر',
  transparencyTitle: lang === 'en' ? 'Transparency you can trust' : 'شفافية تُوثَق',
  tr1: lang === 'en' ? 'Quarterly public reports' : 'تقارير ربع سنوية علنية',
  tr2: lang === 'en' ? 'Independent audit' : 'تدقيق مستقل',
  tr3: lang === 'en' ? 'Fair-pricing policy' : 'سياسة تسعير عادل',

  // FAQ
  faqTitle: lang === 'en' ? 'Common questions' : 'أسئلة وجيهة',
  q1: lang === 'en' ? 'How do you keep prices stable?' : 'كيف تثبّتون الأسعار؟',
  a1: lang === 'en'
    ? 'Smart inventory targets, pre‑contracting with suppliers, and capped margins reviewed by a pricing committee.'
    : 'عبر مستويات مخزون ذكية، تعاقدات مسبقة مع المورّدين، وهوامش ربح سقفية تراجعها لجنة تسعير.',
  q2: lang === 'en' ? 'Where do profits go?' : 'أين تذهب الأرباح؟',
  a2: lang === 'en'
    ? 'Expansion, a stability fund, and community services—according to published ratios.'
    : 'للتوسّع، وصندوق الاستقرار، وخدمات المجتمع—بنسب مُعلنة.',
  q3: lang === 'en' ? 'When do you start?' : 'متى تبدأون؟',
  a3: lang === 'en' ? 'Season one is ready pending the opening tranche of funding.' : 'الموسم الأول جاهز فور اكتمال الدفعة الافتتاحية من التمويل.',
});

/** تنسيقات أرقام وعملات للغتين */
function formatCurrency(n: number, c: string, lang: Lang) {
  try {
    const locale = lang === 'en' ? 'en-GB' : 'ar-GB';
    return new Intl.NumberFormat(locale, { style: 'currency', currency: c as any, maximumFractionDigits: 0 }).format(n);
  } catch {
    return `${n} ${c}`;
  }
}
function formatInt(n: number, lang: Lang) {
  const locale = lang === 'en' ? 'en-GB' : 'ar-GB';
  return new Intl.NumberFormat(locale).format(n);
}

/** Utility: logical dir and alignment based on language */
function useDir(lang: Lang) {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const align = lang === 'ar' ? 'text-right' : 'text-left';
  return { dir, align } as const;
}

export default function DonateIndex({ campaigns, error }: Props) {
  const [lang, setLang] = useState<Lang>('en');
  const copy = useMemo(() => t(lang), [lang]);
  const { dir, align } = useDir(lang);

  // رتب: العاجلة أولًا، ثم النشطة، ثم الأكثر تقدّمًا
  const sorted = useMemo(() => {
    const items = [...campaigns].sort((a, b) => {
      const la = daysLeft(a.endAt); const lb = daysLeft(b.endAt);
      const urgentA = la !== null && la <= 7 && la > 0 ? 1 : 0;
      const urgentB = lb !== null && lb <= 7 && lb > 0 ? 1 : 0;
      if (urgentA !== urgentB) return urgentB - urgentA;
      const activeA = a.status === 'active' ? 1 : 0;
      const activeB = b.status === 'active' ? 1 : 0;
      if (activeA !== activeB) return activeB - activeA;
      return (b.totalDonated / Math.max(b.goalAmount, 1)) - (a.totalDonated / Math.max(a.goalAmount, 1));
    });
    return items;
  }, [campaigns]);

  // بحث وتصفية بسيطة
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'urgent' | 'active' | 'closed'>('all');

  const items = useMemo(() => {
    return sorted.filter(c => {
      const left = daysLeft(c.endAt);
      const urgent = left !== null && left <= 7 && left > 0;
      const closed = left === 0 || c.status === 'closed';
      const passFilter =
        filter === 'all' ? true :
        filter === 'urgent' ? urgent :
        filter === 'active' ? (!closed && c.status === 'active') :
        closed;
      const q = query.trim().toLowerCase();
      const nameMatch =
        c.title_ar.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q);
      return passFilter && (q ? nameMatch : true);
    });
  }, [sorted, filter, query]);

  // أقرب حملة لاستخدامها في الشريط المثبّت
  const top = useMemo(() => sorted.find(c => c.status !== 'closed' && daysLeft(c.endAt) !== 0), [sorted]);

  return (
    <>
      <Head>
        <title>{copy.seoTitle}</title>
        <meta name="description" content={copy.seoDesc} />
        <meta property="og:title" content={copy.seoTitle} />
        <meta property="og:description" content={copy.seoDesc} />
        <meta property="og:type" content="website" />
      </Head>

      <Layout>
        <main dir={dir} className={`${align}`}>
          {/* شريط أعلى: اختيار اللغة */}
          <div className="container mx-auto px-4 pt-4">
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setLang(prev => (prev === 'en' ? 'ar' : 'en'))}
                className="inline-flex items-center gap-2 rounded-xl bg-white ring-1 ring-neutral-200 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50"
                aria-label="Toggle language"
              >
                <IconGlobe />
                <span>{lang === 'en' ? 'عربي' : 'English'}</span>
              </button>
            </div>
          </div>

          {/* HERO قوي */}
          <section className="relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0 -z-10">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-black/10 to-transparent" />
              <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-palestine-green/10 blur-3xl" />
              <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-palestine-red/10 blur-3xl" />
            </div>

            <div className="container mx-auto px-4 pt-10 pb-6">
              <h1 className="text-3xl md:text-4xl font-black leading-tight max-w-4xl">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-neutral-900 via-palestine-green to-palestine-red">
                  {copy.heroTitle}
                </span>
              </h1>
              <p className="mt-3 max-w-2xl text-neutral-700">
                {copy.heroSubtitle}
              </p>

              <div className="mt-5 flex items-center gap-3">
                <a href="#campaigns" className="rounded-xl bg-palestine-green text-white px-6 py-3 font-semibold hover:opacity-90">
                  {copy.ctaBrowse}
                </a>
                <Link href="/contact" className="rounded-xl bg-white ring-1 ring-neutral-200 px-6 py-3 font-semibold hover:bg-neutral-50">
                  {copy.ctaVolunteer}
                </Link>
              </div>

              {/* نقاط تأثير قوية */}
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div className="rounded-2xl border bg-white p-4">
                  <div className="flex items-center gap-2 font-semibold"><IconLeaf /> {copy.vp1Title}</div>
                  <div className="text-neutral-600">{copy.vp1Body}</div>
                </div>
                <div className="rounded-2xl border bg-white p-4">
                  <div className="flex items-center gap-2 font-semibold"><IconChart /> {copy.vp2Title}</div>
                  <div className="text-neutral-600">{copy.vp2Body}</div>
                </div>
                <div className="rounded-2xl border bg-white p-4">
                  <div className="flex items-center gap-2 font-semibold"><IconShield /> {copy.vp3Title}</div>
                  <div className="text-neutral-600">{copy.vp3Body}</div>
                </div>
              </div>
            </div>
          </section>

          {/* شريط البرامج: أين يذهب تبرعك */}
          <section className="container mx-auto px-4 pb-8">
            <h2 className="text-xl font-bold mb-3">{copy.programsTitle}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ProgramTile title={copy.p1Title} body={copy.p1Body} icon={<IconLeaf />} />
              <ProgramTile title={copy.p2Title} body={copy.p2Body} icon={<IconChart />} />
              <ProgramTile title={copy.p3Title} body={copy.p3Body} icon={<IconHandshake />} />
              <ProgramTile title={copy.p4Title} body={copy.p4Body} icon={<IconHeart />} />
              <ProgramTile title={copy.p5Title} body={copy.p5Body} icon={<IconUsers />} />
            </div>
          </section>

          {/* أدوات تصفية وبحث */}
          <section className="container mx-auto px-4 pb-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <Filters filterLabel={copy} setFilter={setFilter} filter={filter} />
              <div className="flex-1">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={copy.searchPlaceholder}
                  className="w-full rounded-xl border border-neutral-200 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-palestine-green"
                  aria-label="Search projects"
                />
              </div>
            </div>
          </section>

          {/* قائمة المشاريع */}
          <section id="campaigns" className="container mx-auto px-4 pb-12 space-y-6">
            {error && <div className="p-4 rounded-2xl bg-red-50 border text-red-700">{error}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.map((c) => {
                const left = daysLeft(c.endAt);
                const pct = percent(c.totalDonated, c.goalAmount);
                const thumb = pickThumb(c);
                const urgent = left !== null && left <= 7 && left > 0;
                const closed = left === 0 || c.status === 'closed';
                const donorsLabel = `${formatInt(c.donorsCount, lang)} ${copy.donors}`;

                return (
                  <div
                    key={c.id}
                    className="group relative rounded-2xl p-[1px] bg-gradient-to-br from-palestine-green/30 via-emerald-400/20 to-palestine-red/30 hover:from-palestine-green/60 hover:to-palestine-red/60 transition-colors"
                  >
                    <div className="rounded-2xl bg-white overflow-hidden shadow-sm ring-1 ring-black/5 transition-all group-hover:shadow-xl">
                      {/* Media */}
                      <div className="relative h-48 w-full bg-neutral-100 overflow-hidden">
                        {thumb.url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={thumb.url} alt={c.title_ar} className="h-48 w-full object-cover transform group-hover:scale-[1.02] transition-transform" />
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

                        {/* شارة الحالة */}
                        <div className="absolute top-2 left-2 flex items-center gap-2">
                          {closed ? <Badge tone="done">{copy.statusClosed}</Badge> : urgent ? <Badge tone="urgent">{copy.statusUrgent}</Badge> : <Badge>{copy.statusRunning}</Badge>}
                          {(thumb.kind === 'youtube' || thumb.kind === 'video') && <Badge>{copy.labelVideo}</Badge>}
                        </div>

                        {/* طبقة تعتيم خفيفة لقراءة أفضل */}
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/35 to-transparent" />
                      </div>

                      {/* المحتوى */}
                      <div className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          {/* نعرض اسم المشروع كما هو (Arabic name provided) */}
                          <h3 className="text-xl font-bold line-clamp-2">{c.title_ar}</h3>
                          <ProgressRing pct={pct} />
                        </div>

                        <div className="grid grid-cols-3 text-xs text-neutral-700">
                          <div className="flex items-center gap-1"><IconHeart /> <span>{formatCurrency(c.totalDonated, c.currency, lang)}</span></div>
                          <div className="flex items-center gap-1"><IconUsers /> <span>{donorsLabel}</span></div>
                          <div className="flex items-center gap-1">
                            <IconClock />
                            <span>
                              {left === null ? copy.open : left === 0 ? copy.ended : `${formatInt(left, lang)} ${copy.days}`}
                            </span>
                          </div>
                        </div>

                        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden" aria-label="Funding progress">
                          <div className="h-3 bg-palestine-green rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="text-xs text-neutral-600 text-center">
                          {copy.goal}: {formatCurrency(c.goalAmount, c.currency, lang)}
                        </div>

                        <div className="flex gap-2 pt-1">
                          <Link
                            href={`/donate/${c.slug}`}
                            className="flex-1 text-center rounded-xl bg-palestine-green text-white py-2 font-semibold hover:opacity-90"
                          >
                            {copy.donateNow}
                          </Link>
                          <Link
                            href={`/donate/${c.slug}`}
                            className="flex-1 text-center rounded-xl bg-white ring-1 ring-neutral-200 py-2 font-semibold hover:bg-neutral-50"
                          >
                            {copy.readStory}
                          </Link>
                        </div>

                        <p className="text-xs text-neutral-600 text-center">
                          {copy.impactLine}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {items.length === 0 && !error && (
              <div className="text-center text-neutral-600 py-10">
                {copy.emptyText}{' '}
                <Link href="/join" className="text-palestine-green underline">
                  {copy.ctaVolunteer}
                </Link>
                .
              </div>
            )}
          </section>

          {/* Impact stats */}
          <section className="container mx-auto px-4 pb-8">
            <h2 className="text-xl font-bold mb-3">{copy.impactTitle}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard label={copy.i1} />
              <StatCard label={copy.i2} />
              <StatCard label={copy.i3} />
            </div>
          </section>

          {/* Transparency badges */}
          <section className="container mx-auto px-4 pb-10">
            <h2 className="text-xl font-bold mb-3">{copy.transparencyTitle}</h2>
            <div className="flex flex-wrap gap-2">
              <Badge><IconShield /> {copy.tr1}</Badge>
              <Badge><IconShield /> {copy.tr2}</Badge>
              <Badge><IconShield /> {copy.tr3}</Badge>
            </div>
          </section>

          {/* FAQ */}
          <section className="container mx-auto px-4 pb-16">
            <h2 className="text-xl font-bold mb-3">{copy.faqTitle}</h2>
            <div className="divide-y rounded-2xl border bg-white">
              <FaqItem q={copy.q1} a={copy.a1} />
              <FaqItem q={copy.q2} a={copy.a2} />
              <FaqItem q={copy.q3} a={copy.a3} />
            </div>
          </section>

          {/* شريط مثبّت يُحفّز على العطاء */}
          {top && (
            <div className="sticky bottom-4 px-4">
              <div className="mx-auto max-w-3xl rounded-2xl bg-gradient-to-r from-palestine-green to-palestine-red text-white px-4 py-3 shadow-xl">
                <div className="flex flex-col sm:flex-row items-center gap-3 justify-between">
                  <div className="text-left">
                    <div className="font-bold">{copy.stickyTitle}</div>
                    <div className="text-sm text-white/90">{copy.stickySub}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/donate/${top.slug}`} className="rounded-xl bg-white text-neutral-900 px-4 py-2 font-semibold hover:opacity-90">
                      {copy.stickyDonateNearest}
                    </Link>
                    <a href="#campaigns" className="rounded-xl bg-black/20 px-4 py-2 font-semibold hover:bg-black/30">
                      {copy.stickyBrowseAll}
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </Layout>
    </>
  );
}

/**
 * Small presentational components
 */
function ProgramTile({ title, body, icon }: { title: string; body: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="flex items-center gap-2 text-sm font-semibold"><span className="shrink-0">{icon}</span> {title}</div>
      <p className="mt-1 text-neutral-600 text-sm">{body}</p>
    </div>
  );
}

function StatCard({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4 flex items-center gap-2 text-sm font-semibold">
      <IconChart />
      <span>{label}</span>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group open:bg-white">
      <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between">
        <span className="font-semibold">{q}</span>
        <span className="ml-2 transition-transform group-open:rotate-180" aria-hidden>⌄</span>
      </summary>
      <div className="px-4 pb-3 text-neutral-700 text-sm">{a}</div>
    </details>
  );
}

function Filters({ filterLabel, setFilter, filter }: { filterLabel: ReturnType<typeof t>; setFilter: (f: 'all' | 'urgent' | 'active' | 'closed') => void; filter: 'all' | 'urgent' | 'active' | 'closed' }) {
  return (
    <div className="flex gap-2">
      <button onClick={() => setFilter('all')} className={`rounded-xl px-4 py-2 text-sm font-semibold ring-1 ${filter === 'all' ? 'bg-neutral-900 text-white ring-neutral-900' : 'bg-white ring-neutral-200 hover:bg-neutral-50'}`}>{filterLabel.filtersAll}</button>
      <button onClick={() => setFilter('urgent')} className={`rounded-xl px-4 py-2 text-sm font-semibold ring-1 ${filter === 'urgent' ? 'bg-palestine-red text-white ring-palestine-red' : 'bg-white ring-neutral-200 hover:bg-neutral-50'}`}>{filterLabel.filtersUrgent}</button>
      <button onClick={() => setFilter('active')} className={`rounded-xl px-4 py-2 text-sm font-semibold ring-1 ${filter === 'active' ? 'bg-palestine-green text-white ring-palestine-green' : 'bg-white ring-neutral-200 hover:bg-neutral-50'}`}>{filterLabel.filtersActive}</button>
      <button onClick={() => setFilter('closed')} className={`rounded-xl px-4 py-2 text-sm font-semibold ring-1 ${filter === 'closed' ? 'bg-neutral-800 text-white ring-neutral-800' : 'bg-white ring-neutral-200 hover:bg-neutral-50'}`}>{filterLabel.filtersClosed}</button>
    </div>
  );
}