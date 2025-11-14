// pages/donate/[slug].tsx
import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Layout from '../../components/Layout';
import dynamic from 'next/dynamic';

// Donation Stripe widget (client-only render to avoid SSR issues)
const DonationPaymentWidget = dynamic(
  () => import('../../components/payments/DonationPaymentWidget'),
  { ssr: false }
);

type MediaItem = {
  id: string;
  type: 'image' | 'video' | 'youtube';
  url: string;
  title?: string | null;
  isPrimary?: boolean;
};
type Donor = { name: string; amount: number; at: number };
type Campaign = {
  id: string;
  slug: string;
  title_ar: string;
  why_ar: string;
  spendingPlan_ar?: string | null;
  contact?: { phone?: string; email?: string; whatsapp?: string; link?: string } | null;
  media?: MediaItem[] | null;
  currency: 'GBP' | 'USD' | 'EUR' | string;
  bannerUrl?: string | null;
  goalAmount: number;
  totalDonated: number;
  donorsCount: number;
  allowPublicDonorList?: boolean;
  lastDonors?: Donor[];
  endAt?: number | null;
};

type Props = { c: Campaign | null; error?: string | null };

const getOrigin = (req: unknown) => {
  // @ts-ignore
  const proto = req?.headers?.['x-forwarded-proto'] || 'http';
  // @ts-ignore
  const host = req?.headers?.['x-forwarded-host'] || req?.headers?.host || 'localhost:3000';
  return `${proto}://${host}`;
};

export async function getServerSideProps({ req, params }: unknown) {
  try {
    // @ts-ignore
    const origin = getOrigin(req);
    // @ts-ignore
    const slug = String(params?.slug || '');
    const r = await fetch(`${origin}/api/donations/by-slug/${encodeURIComponent(slug)}`);
    const data = await r.json();
    if (!r.ok || data?.ok === false) throw new Error(data?.error || 'Not found');
    return { props: { c: data.item } };
  } catch (e: unknown) {
    // @ts-ignore
    return { props: { c: null, error: (e as any)?.message || 'Error' } };
  }
}

/* ------------------------- utils ------------------------- */
function daysLeft(endAt?: number | null) {
  if (!endAt) return null;
  const diff = endAt - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
type Lang = 'en' | 'ar';
function formatCurrency(n: number, c: string, lang: Lang) {
  const locale = lang === 'en' ? 'en-GB' : 'ar-GB';
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: c as any }).format(n);
  } catch {
    return `${n} ${c}`;
  }
}
function formatInt(n: number, lang: Lang) {
  const locale = lang === 'en' ? 'en-GB' : 'ar-GB';
  return new Intl.NumberFormat(locale).format(n);
}
function normalizeYouTubeEmbed(url: string) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com') && u.searchParams.get('v')) {
      const vid = u.searchParams.get('v')!;
      return `https://www.youtube.com/embed/${vid}`;
    }
    if (u.hostname === 'youtu.be') {
      const vid = u.pathname.replace('/', '');
      return `https://www.youtube.com/embed/${vid}`;
    }
    return url;
  } catch {
    return url;
  }
}
function pickHero(c: Campaign): string | null {
  if (c.bannerUrl) return c.bannerUrl;
  const media = (c.media || []).slice().sort((a, b) => Number(!!b.isPrimary) - Number(!!a.isPrimary));
  const firstImg = media.find((m) => m.type === 'image');
  return firstImg ? firstImg.url : null;
}
function cls(...a: (string | false | null | undefined)[]) {
  return a.filter(Boolean).join(' ');
}

/* ------------------------- icons ------------------------- */
function IconGlobe() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
    </svg>
  );
}
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

/* ------------------------- progress ring ------------------------- */
function ProgressRing({ pct }: { pct: number }) {
  const v = Math.max(0, Math.min(100, Math.round(pct)));
  const style: React.CSSProperties = {
    background: `conic-gradient(var(--ring-color) ${v * 3.6}deg, #e5e7eb ${v * 3.6}deg)`,
  };
  return (
    <div
      className="relative h-12 w-12 rounded-full"
      // @ts-ignore CSS var cast
      style={{ ...style, ['--ring-color' as unknown]: 'rgb(16 185 129)' }}
      aria-label={`${v}% funded`}
      title={`${v}% funded`}
    >
      <div className="absolute inset-1 rounded-full bg-white flex items-center justify-center text-xs font-semibold">%{v}</div>
    </div>
  );
}

/* ------------------------- i18n (UI copy only) ------------------------- */
const tr = (lang: Lang) => ({
  // SEO
  seoTitle: lang === 'en' ? 'Donate to a Project | Palestinian Community Association North West' : 'تبرّع لمشروع | جمعية الجالية الفلسطينية شمال الغرب',
  // nav/breadcrumb
  backToProjects: lang === 'en' ? '← Back to all projects' : '← العودة إلى كل المشاريع',
  // hero
  punchTitle:
    lang === 'en'
      ? 'Power a life-changing project—give boldly today'
      : 'قوِّ مشروعًا يغيّر الحياة — تبرّع بقوّة الآن',
  punchSubtitle:
    lang === 'en'
      ? 'Every pound becomes shelter, education and urgent relief for Palestinian families across the North West.'
      : 'كل جنيه يتحوّل إلى مأوى وتعليم وإغاثة عاجلة لأُسر فلسطينية في الشمال الغربي.',
  raised: lang === 'en' ? 'Raised' : 'تم جمعه',
  goal: lang === 'en' ? 'Goal' : 'الهدف',
  donors: lang === 'en' ? 'Donors' : 'المتبرعون',
  time: lang === 'en' ? 'Time' : 'الوقت',
  open: lang === 'en' ? 'Open' : 'مفتوحة',
  ended: lang === 'en' ? 'Ended' : 'انتهت',
  days: lang === 'en' ? 'days' : 'يوم',
  fundedOfGoal: lang === 'en' ? 'of goal' : 'من الهدف',
  copyLink: lang === 'en' ? 'Copy campaign link' : 'نسخ رابط الحملة',
  shareWhatsapp: lang === 'en' ? 'Share via WhatsApp' : 'شارك عبر واتساب',

  // left column
  whyTitle: lang === 'en' ? 'Why we’re raising funds' : 'لماذا نجمع التبرعات؟',
  planTitle: lang === 'en' ? 'How funds will be used' : 'كيف سيتم الصرف؟',
  impactCards: [
    lang === 'en' ? '£25 = Food Basket' : '£25 = سُلّة غذائية',
    lang === 'en' ? '£50 = Medicine & Care' : '£50 = دواء/علاج',
    lang === 'en' ? '£150 = Family Support' : '£150 = كفالة أسرة',
  ],
  impactNotes: [
    lang === 'en' ? 'Feeds a family for a week.' : 'تكفي أسرة لأسبوع.',
    lang === 'en' ? 'Eases urgent pain.' : 'تخفيف ألم مريض.',
    lang === 'en' ? 'Dignity and warmth in hard days.' : 'دفء وكرامة لأيام صعبة.',
  ],
  galleryTitle: lang === 'en' ? 'Campaign media' : 'صور وفيديو الحملة',
  donorsTitle: lang === 'en' ? 'Recent donors' : 'آخر المتبرعين',
  donorsThanks:
    lang === 'en'
      ? 'Thank you from the Palestinian Community Association in the North West ♥'
      : 'شكرًا من الجالية الفلسطينية في الشمال الغربي لكل من ساهم ♥',

  // donate box
  donateNow: lang === 'en' ? 'Donate now' : 'تبرّع الآن',
  donateBoxTitle: lang === 'en' ? 'Back this project now' : 'ادعم الحملة الآن',
  remaining: lang === 'en' ? 'remaining' : 'متبق',
  otherAmount: lang === 'en' ? 'Other amount' : 'مبلغ آخر',
  currency: lang === 'en' ? 'Currency' : 'العملة',
  smallImpact:
    lang === 'en'
      ? 'Your gift reaches those who need it—every pound counts.'
      : 'تبرّعك يصل لمن يستحق — كل جنيه يصنع فرقًا.',

  contactPhone: lang === 'en' ? 'Phone' : 'الهاتف',
  contactWhats: lang === 'en' ? 'WhatsApp' : 'واتساب',
  contactEmail: lang === 'en' ? 'Email' : 'البريد',
  contactLink: lang === 'en' ? 'Donation link' : 'رابط التبرع',

  // sticky bar
  stickyHeadline:
    lang === 'en' ? 'Push this project over the line today' : 'ادفع هذا المشروع لخطّ النجاح اليوم',
  stickyCta: lang === 'en' ? 'Give now' : 'تبرّع الآن',

  // errors
  notFound: lang === 'en' ? 'Campaign not found' : 'الحملة غير موجودة',

  // NEW: name + quick nav
  firstName: lang === 'en' ? 'First name' : 'الاسم',
  lastName: lang === 'en' ? 'Last name' : 'العائلة',
  nameRequired: lang === 'en' ? 'Please enter your first and last name.' : 'فضلاً أدخل الاسم والكنية.',
  contactBtn: lang === 'en' ? 'Contact us' : 'اتصل بنا',
  joinBtn: lang === 'en' ? 'Join us' : 'انضم إلينا',
});

/* ------------------------- page ------------------------- */
export default function CampaignPage({ c, error }: Props) {
  const [lang, setLang] = React.useState<Lang>('en');
  const t = React.useMemo(() => tr(lang), [lang]);

  if (!c) {
    return (
      <Layout>
        <main dir="ltr" className="container mx-auto px-4 py-10">
          <div className="rounded-2xl border bg-white p-6 text-red-700">{t.notFound}{error ? `: ${error}` : ''}</div>
          <div className="mt-4 flex items-center gap-3">
            <Link href="/donate" className="text-palestine-green underline">
              {t.backToProjects}
            </Link>
            {/* NEW quick links when not found */}
            <Link href="/contact" className="text-palestine-green underline">
              {t.contactBtn}
            </Link>
            <Link href="/join" className="text-palestine-green underline">
              {t.joinBtn}
            </Link>
          </div>
        </main>
      </Layout>
    );
  }

  // --- LIVE TOTALS (so Raised updates after payment) ---
  const [liveTotals, setLiveTotals] = React.useState<{ totalDonated: number; donorsCount: number }>(() => ({
    totalDonated: c.totalDonated,
    donorsCount: c.donorsCount,
  }));

  // MONOTONIC refresh: do not let UI regress to lower numbers
  const refreshCampaign = React.useCallback(async () => {
    try {
      const r = await fetch(`/api/donations/by-slug/${encodeURIComponent(c.slug)}`);
      const j = await r.json();
      if (r.ok && j?.item) {
        const nextTotal = Number(j.item.totalDonated || 0);
        const nextDonors = Number(j.item.donorsCount || 0);
        setLiveTotals((prev) => ({
          totalDonated: Math.max(prev.totalDonated, nextTotal),
          donorsCount: Math.max(prev.donorsCount, nextDonors),
        }));
      }
    } catch {
      // ignore (UI will keep previous totals)
    }
  }, [c.slug]);

  // Gentle background refresh every 20s (cleared on unmount)
  React.useEffect(() => {
    const id = window.setInterval(() => {
      void refreshCampaign();
    }, 20000);
    return () => clearInterval(id);
  }, [refreshCampaign]);

  // Everything that shows totals now uses liveTotals
  const pct = Math.min(100, Math.round((liveTotals.totalDonated / Math.max(c.goalAmount, 1)) * 100));
  const left = daysLeft(c.endAt);
  const mediaSorted: MediaItem[] = React.useMemo(() => {
    const arr = Array.isArray(c.media) ? [...c.media] : [];
    return arr.sort((a, b) => Number(!!b.isPrimary) - Number(!!a.isPrimary));
  }, [c.media]);
  const hero = pickHero(c);

  // share URL (CSR only)
  const [shareUrl, setShareUrl] = React.useState('');
  React.useEffect(() => {
    if (typeof window !== 'undefined') setShareUrl(window.location.href);
  }, []);

  // lightbox
  const [openIndex, setOpenIndex] = React.useState<number | null>(null);
  const close = () => setOpenIndex(null);
  const next = () => setOpenIndex((i) => (i === null ? null : (i + 1) % mediaSorted.length));
  const prev = () => setOpenIndex((i) => (i === null ? null : (i - 1 + mediaSorted.length) % mediaSorted.length));
  React.useEffect(() => {
    if (openIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openIndex, mediaSorted.length]);

  // donate box
  const [amount, setAmount] = React.useState<number>(25);
  const [showPayment, setShowPayment] = React.useState(false);

  // NEW: donor name fields
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [nameError, setNameError] = React.useState<string | null>(null);

  const ensureDonorName = () => {
    if (!firstName.trim() || !lastName.trim()) {
      setNameError(t.nameRequired);
      return false;
    }
    setNameError(null);
    return true;
  };

  const doDonate = () => {
    if (c.contact?.link) {
      window.open(c.contact.link, '_blank', 'noopener,noreferrer');
      return;
    }
    if (c.contact?.whatsapp) {
      const msg = encodeURIComponent(
        (lang === 'en'
          ? `I’d like to donate ${amount} ${c.currency} to: ${c.title_ar}`
          : `أود التبرّع بمبلغ ${amount} ${c.currency} لحملة: ${c.title_ar}`)
      );
      window.open(`https://wa.me/${c.contact.whatsapp}?text=${msg}`, '_blank', 'noopener,noreferrer');
      return;
    }
    if (c.contact?.email) {
      const sub = encodeURIComponent((lang === 'en' ? `Donation to` : 'تبرّع لحملة') + ` ${c.title_ar}`);
      const body = encodeURIComponent(
        lang === 'en'
          ? `Hello,\nI would like to donate ${amount} ${c.currency} to "${c.title_ar}".\nPlease share payment details.\nThank you.`
          : `السلام عليكم،\nأرغب في التبرّع بمبلغ ${amount} ${c.currency} لحملة "${c.title_ar}".\nرجاءً تزويدي بطريقة الدفع.\nجزاكم الله خيرًا.`
      );
      window.location.href = `mailto:${c.contact.email}?subject=${sub}&body=${body}`;
      return;
    }

    // If there's a contact card (e.g., phone-only), keep original UX: scroll to contact.
    if (c.contact && (c.contact.phone || c.contact.link || c.contact.whatsapp || c.contact.email)) {
      const el = document.getElementById('contact');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    // Otherwise, open our in-page Stripe payment widget (require name)
    if (!ensureDonorName()) return;
    setShowPayment(true);
  };

  const ogDesc = (c.why_ar || '').replace(/\s+/g, ' ').slice(0, 150);

  // Helper to poll after success (handles webhook/DB delay)
  const pollTotalsAfterSuccess = React.useCallback(() => {
    refreshCampaign(); // immediate
    const timers: number[] = [];
    [2000, 5000, 10000].forEach((ms) => {
      const id = window.setTimeout(() => refreshCampaign(), ms);
      timers.push(id);
    });
    return () => timers.forEach((id) => clearTimeout(id));
  }, [refreshCampaign]);

  return (
    <>
      <Head>
        <title>{t.seoTitle}</title>
        <meta name="description" content={ogDesc} />
        <meta property="og:title" content={c.title_ar} />
        <meta property="og:description" content={ogDesc} />
        {hero && <meta property="og:image" content={hero} />}
        <link rel="canonical" href={shareUrl || ''} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Fundraiser',
              name: c.title_ar,
              description: ogDesc,
              url: shareUrl || '',
              image: hero || '',
              fundsRaised: { '@type': 'MonetaryAmount', currency: c.currency, value: liveTotals.totalDonated },
              target: { '@type': 'MonetaryAmount', currency: c.currency, value: c.goalAmount },
              sponsor: { '@type': 'Organization', name: 'Palestinian Community Association North West' },
            }),
          }}
        />
      </Head>

      <Layout>
        {/* Entire page LTR as requested */}
        <main dir="ltr" className="text-left">
          {/* Top bar */}
          <div className="container mx-auto px-4 pt-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/donate" className="text-sm text-palestine-green hover:underline">
                {t.backToProjects}
              </Link>
              <Link href="/contact" className="text-sm text-palestine-green hover:underline">
                {t.contactBtn}
              </Link>
              <Link href="/join" className="text-sm text-palestine-green hover:underline">
                {t.joinBtn}
              </Link>
            </div>
            <button
              onClick={() => setLang((p) => (p === 'en' ? 'ar' : 'en'))}
              className="inline-flex items-center gap-2 rounded-xl bg-white ring-1 ring-neutral-200 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50"
              aria-label="Toggle language"
            >
              <IconGlobe />
              <span>{lang === 'en' ? 'عربي' : 'English'}</span>
            </button>
          </div>

          {/* HERO */}
          <section className="relative overflow-hidden">
            <div className="absolute inset-0 z-0" aria-hidden="true">
              {hero ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={hero} alt={c.title_ar} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-neutral-100" />
              )}
              <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-white/0" />
            </div>

            <div className="relative z-10 container mx-auto px-4 pt-24 pb-10">
              <div className="max-w-4xl text-white">
                <h1 className="text-3xl md:text-5xl font-black leading-tight">{c.title_ar}</h1>
                <p className="mt-3 text-white/95 text-lg">{t.punchSubtitle}</p>

                {/* KPIs */}
                <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div className="rounded-xl bg-white/10 backdrop-blur p-3">
                    <div className="text-white/85">{t.raised}</div>
                    <div className="text-white font-bold">{formatCurrency(liveTotals.totalDonated, c.currency, lang)}</div>
                  </div>
                  <div className="rounded-xl bg-white/10 backdrop-blur p-3">
                    <div className="text-white/85">{t.goal}</div>
                    <div className="text-white font-bold">{formatCurrency(c.goalAmount, c.currency, lang)}</div>
                  </div>
                  <div className="rounded-xl bg-white/10 backdrop-blur p-3">
                    <div className="text-white/85">{t.donors}</div>
                    <div className="text-white font-bold">{formatInt(liveTotals.donorsCount, lang)}</div>
                  </div>
                  <div className="rounded-xl bg-white/10 backdrop-blur p-3">
                    <div className="text-white/85">{t.time}</div>
                    <div className="text-white font-bold">
                      {left === null ? t.open : left === 0 ? t.ended : `${formatInt(left, lang)} ${t.days}`}
                    </div>
                  </div>
                </div>

                {/* progress */}
                <div className="mt-5 flex items-center gap-4">
                  <div className="w-full h-3 bg-white/30 rounded-full overflow-hidden">
                    <div className="h-3 bg-emerald-400 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <ProgressRing pct={pct} />
                </div>
                <div className="mt-1 text-xs text-white/95">
                  %{pct} {t.fundedOfGoal}
                </div>

                {/* share */}
                <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
                  <button
                    onClick={() => typeof navigator !== 'undefined' && navigator.clipboard?.writeText(shareUrl)}
                    className="rounded-full bg-white/20 hover:bg-white/30 px-3 py-1"
                  >
                    {t.copyLink}
                  </button>
                  {c.contact?.whatsapp && shareUrl && (
                    <a
                      className="rounded-full bg-white/20 hover:bg-white/30 px-3 py-1"
                      href={`https://wa.me/${c.contact.whatsapp}?text=${encodeURIComponent(
                        (lang === 'en' ? 'Support this campaign: ' : 'شارك الحملة: ') + shareUrl
                      )}`}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      {t.shareWhatsapp}
                    </a>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Body */}
          <div className="container mx-auto px-4 py-10 grid lg:grid-cols-3 gap-8">
            {/* left content */}
            <div className="lg:col-span-2 space-y-8">
              {/* Motivation */}
              <section className="p-6 border rounded-2xl bg-white">
                <h2 className="text-xl font-bold">
                  {t.punchTitle}
                </h2>
                <p className="mt-3 leading-8 text-neutral-800">
                  {c.why_ar}
                </p>

                {c.spendingPlan_ar && (
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold">{t.planTitle}</h3>
                    <div
                      className="prose max-w-none mt-2"
                      dangerouslySetInnerHTML={{ __html: c.spendingPlan_ar.replace(/\n/g, '<br/>') }}
                    />
                  </div>
                )}

                {/* Impact mini-cards */}
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="rounded-xl border bg-neutral-50 p-4">
                      <div className="font-semibold">{t.impactCards[i]}</div>
                      <div className="text-neutral-600">{t.impactNotes[i]}</div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Media */}
              {!!mediaSorted.length && (
                <section className="space-y-3">
                  <h3 className="text-lg font-semibold">{t.galleryTitle}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {mediaSorted.map((m, i) => (
                      <div key={m.id || i} className="overflow-hidden rounded-2xl border bg-white">
                        <button type="button" className="w-full block" onClick={() => setOpenIndex(i)} aria-label="Open media">
                          {m.type === 'image' && <img src={m.url} alt={m.title || ''} className="w-full h-72 object-cover" />}
                          {m.type === 'video' && <video controls src={m.url} className="w-full h-72 object-cover" />}
                          {m.type === 'youtube' && <iframe className="w-full h-72" src={normalizeYouTubeEmbed(m.url)} allowFullScreen />}
                        </button>
                        {m.title ? <div className="px-3 py-2 text-sm text-neutral-700 border-t">{m.title}</div> : null}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Donors */}
              {c.allowPublicDonorList && !!c.lastDonors?.length && (
                <section className="space-y-2">
                  <h3 className="text-lg font-semibold">{t.donorsTitle}</h3>
                  <ul className="divide-y rounded-2xl border bg-white">
                    {c.lastDonors!.map((d, i) => (
                      <li key={i} className="flex items-center justify-between p-3">
                        <span className="truncate">{d.name}</span>
                        <span className="font-medium">{formatCurrency(d.amount, c.currency, lang)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="text-center text-sm text-gray-600">{t.donorsThanks}</div>
                </section>
              )}
            </div>

            {/* donate sidebar */}
            <aside className="lg:sticky lg:top-6 h-max">
              <div className="rounded-2xl border p-[1px] bg-gradient-to-br from-palestine-green/40 via-emerald-300/30 to-palestine-red/40">
                <div className="rounded-2xl bg-white p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-bold">{t.donateBoxTitle}</h4>
                    <span
                      className={cls(
                        'text-xs px-2 py-1 rounded-full',
                        left === 0
                          ? 'bg-red-100 text-red-700'
                          : left && left <= 7
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-emerald-100 text-emerald-700'
                      )}
                    >
                      {left === null ? t.open : left === 0 ? t.ended : `${formatInt(left, lang)} ${t.remaining}`}
                    </span>
                  </div>

                  {/* donor name fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full rounded-xl border p-2"
                      placeholder={t.firstName}
                      aria-label={t.firstName}
                    />
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full rounded-xl border p-2"
                      placeholder={t.lastName}
                      aria-label={t.lastName}
                    />
                  </div>
                  {nameError && <div className="text-sm text-red-600">{nameError}</div>}

                  <div className="text-sm text-neutral-700">
                    <div>
                      {t.raised}: <b>{formatCurrency(liveTotals.totalDonated, c.currency, lang)}</b>
                    </div>
                    <div>
                      {t.goal}: <b>{formatCurrency(c.goalAmount, c.currency, lang)}</b>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {[10, 25, 50, 100].map((v) => (
                      <button
                        key={v}
                        onClick={() => setAmount(v)}
                        className={cls(
                          'rounded-xl border px-3 py-2 text-sm',
                          amount === v ? 'bg-palestine-green text-white border-palestine-green' : 'bg-white hover:bg-neutral-50'
                        )}
                      >
                        {formatInt(v, lang)}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      value={amount}
                      onChange={(e) => setAmount(Math.max(1, Number(e.target.value || 0)))}
                      className="w-full rounded-xl border p-2"
                      placeholder={t.otherAmount}
                    />
                    <span className="text-sm text-neutral-600">{c.currency}</span>
                  </div>

                  <button
                    onClick={doDonate}
                    className="w-full rounded-xl bg-palestine-green text-white py-3 font-semibold hover:opacity-90"
                  >
                    {t.donateNow}
                  </button>

                  <p className="text-xs text-neutral-600 text-center">{t.smallImpact}</p>

                  <div className="pt-2 flex items-center justify-center gap-3 text-sm">
                    <Link href="/contact" className="underline text-palestine-green">{t.contactBtn}</Link>
                    <span>·</span>
                    <Link href="/join" className="underline text-palestine-green">{t.joinBtn}</Link>
                  </div>
                </div>
              </div>

              {c.contact && (
                <div id="contact" className="mt-4 rounded-2xl border p-4 space-y-2 bg-white">
                  <h4 className="font-semibold">{t.contactTitle}</h4>
                  {c.contact.phone && (
                    <div>
                      {t.contactPhone}:&nbsp;
                      <a className="text-palestine-green" href={`tel:${c.contact.phone}`}>
                        {c.contact.phone}
                      </a>
                    </div>
                  )}
                  {c.contact.whatsapp && (
                    <div>
                      {t.contactWhats}:&nbsp;
                      <a
                        className="text-palestine-green"
                        href={`https://wa.me/${c.contact.whatsapp}`}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        {c.contact.whatsapp}
                      </a>
                    </div>
                  )}
                  {c.contact.email && (
                    <div>
                      {t.contactEmail}:&nbsp;
                      <a className="text-palestine-green" href={`mailto:${c.contact.email}`}>
                        {c.contact.email}
                      </a>
                    </div>
                  )}
                  {c.contact.link && (
                    <div>
                      {t.contactLink}:&nbsp;
                      <a className="text-palestine-green" href={c.contact.link} target="_blank" rel="noreferrer noopener">
                        {lang === 'en' ? 'Open' : 'فتح'}
                      </a>
                    </div>
                  )}
                </div>
              )}
            </aside>
          </div>

          {/* Payment modal (Stripe Elements) */}
          {showPayment && (
            <div
              role="dialog"
              aria-modal="true"
              className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
            >
              {/* Backdrop */}
              <button
                aria-label="Close donation"
                onClick={() => setShowPayment(false)}
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              />

              {/* Modal card */}
              <div className="relative w-full max-w-xl rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
                <div className="flex items-center justify-between border-b px-6 py-4">
                  <h3 className="text-lg font-semibold">
                    {c.title_ar} — {t.donateNow}
                  </h3>
                  <button
                    onClick={() => setShowPayment(false)}
                    className="rounded-full p-2 hover:bg-neutral-100"
                    aria-label="Close"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" stroke="currentColor" strokeWidth="2" fill="none">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="px-6 pt-4 pb-6">
                  <div className="mb-4 text-sm text-neutral-600">
                    {formatCurrency(liveTotals.totalDonated, c.currency, lang)} / {formatCurrency(c.goalAmount, c.currency, lang)} • %{pct}
                  </div>

                  {/* Donation-only Stripe Payment Widget */}
                  <DonationPaymentWidget
                    campaignId={c.id}
                    campaignSlug={c.slug}
                    defaultAmount={Number(amount || 0)}
                    currency={String(c.currency) as any}
                    donorFirstName={firstName.trim()}
                    donorLastName={lastName.trim()}
                    onSuccess={async (payload: any) => {
                      // Use actual paid amount from Stripe payload (safer than input field)
                      const paid = Number(payload?.amountPaid || amount || 0);
                      setLiveTotals((prev) => ({
                        totalDonated: prev.totalDonated + paid,
                        donorsCount: prev.donorsCount + 1,
                      }));
                      setShowPayment(false);

                      // Poll server to reconcile real totals (monotonic refresh prevents drop)
                      const stopPolling = pollTotalsAfterSuccess();
                      void stopPolling;
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Sticky donate bar */}
          <div className="sticky bottom-4 px-4">
            <div className="mx-auto max-w-3xl rounded-2xl bg-gradient-to-r from-palestine-green to-palestine-red text-white px-4 py-3 shadow-xl">
              <div className="flex flex-col sm:flex-row items-center gap-3 justify-between">
                <div className="text-left">
                  <div className="font-bold">{t.stickyHeadline}</div>
                  <div className="text-sm text-white/90">
                    {formatCurrency(liveTotals.totalDonated, c.currency, lang)} / {formatCurrency(c.goalAmount, c.currency, lang)} — %{pct}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={doDonate}
                    className="rounded-xl bg-white text-neutral-900 px-4 py-2 font-semibold hover:opacity-90"
                  >
                    {t.stickyCta}
                  </button>
                  <Link href="/donate" className="rounded-xl bg-black/20 px-4 py-2 font-semibold hover:bg-black/30">
                    {t.backToProjects}
                  </Link>
                  <Link href="/contact" className="rounded-xl bg-black/20 px-4 py-2 font-semibold hover:bg-black/30">
                    {t.contactBtn}
                  </Link>
                  <Link href="/join" className="rounded-xl bg-black/20 px-4 py-2 font-semibold hover:bg-black/30">
                    {t.joinBtn}
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Lightbox */}
          {openIndex !== null && mediaSorted[openIndex] && (
            <div
              role="dialog"
              aria-modal="true"
              className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
              onClick={() => setOpenIndex(null)}
            >
              <div className="relative max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setOpenIndex(null)}
                  className="absolute -top-10 right-0 text-white/90 hover:text-white"
                  aria-label="Close"
                >
                  ✕
                </button>
                {mediaSorted.length > 1 && (
                  <>
                    <button
                      onClick={() => setOpenIndex((i) => (i === null ? null : (i - 1 + mediaSorted.length) % mediaSorted.length))}
                      className="absolute left-0 -translate-x-12 top-1/2 -mt-6 text-white/80 hover:text-white text-3xl"
                      aria-label="Previous"
                    >
                      ‹
                    </button>
                    <button
                      onClick={() => setOpenIndex((i) => (i === null ? null : (i + 1) % mediaSorted.length))}
                      className="absolute right-0 translate-x-12 top-1/2 -mt-6 text-white/80 hover:text-white text-3xl"
                      aria-label="Next"
                    >
                      ›
                    </button>
                  </>
                )}
                <div className="bg-black rounded-xl overflow-hidden">
                  {(() => {
                    const m = mediaSorted[openIndex];
                    if (m.type === 'image')
                      return <img src={m.url} alt={m.title || ''} className="w-full h-auto max-h-[78vh] object-contain" />;
                    if (m.type === 'video') return <video src={m.url} controls className="w-full max-h-[78vh] object-contain" />;
                    return (
                      <iframe
                        className="w-full aspect-video"
                        src={normalizeYouTubeEmbed(m.url)}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      />
                    );
                  })()}
                </div>
                {mediaSorted[openIndex]?.title ? (
                  <div className="text-neutral-200 text-sm mt-2">{mediaSorted[openIndex]!.title}</div>
                ) : null}
              </div>
            </div>
          )}
        </main>
      </Layout>
    </>
  );
}
