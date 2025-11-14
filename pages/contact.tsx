// pages/contact.tsx
import Head from 'next/head';
import React, { useState, ReactNode } from 'react';
import Layout from '../components/Layout';
import Button from '../components/Button';

/* =========================
   Config (سهّل التعديل هنا)
   ========================= */
const ORG_NAME = 'Palestinian Community Association – North West UK';
const WHATSAPP = '+447582222118'; // بدون + لروابط wa.me
const EMAIL = 'info@palestiniancommunity.co.uk';
const ADDRESS = 'Manchester, UK';
const GOOGLE_MAPS_QUERY = encodeURIComponent(ADDRESS);

/* =========================
   Utilities
   ========================= */
function cls(...a: (string | false | null | undefined)[]) {
  return a.filter(Boolean).join(' ');
}
async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

/* =========================
   Icons
   ========================= */
function IconGlobe() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
    </svg>
  );
}

/* =========================
   Minimal accessible Accordion
   ========================= */
interface AccordionItem { title: string; children: ReactNode; key?: string; }
function Accordion({ items }: { items: AccordionItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const toggle = (i: number) => setOpenIndex((prev) => (prev === i ? null : i));
  return (
    <div className="space-y-4">
      {items.map((item, idx) => {
        const isOpen = openIndex === idx;
        const panelId = `accordion-panel-${idx}`;
        const buttonId = `accordion-btn-${idx}`;
        return (
          <div key={item.key || idx} className="border border-gray-200 rounded-2xl overflow-hidden shadow-sm bg-white">
            <h3 className="m-0">
              <button
                id={buttonId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(idx)}
                className="w-full flex justify-between items-center px-5 py-4 text-left hover:bg-palestine-light/30 transition font-medium"
              >
                <span>{item.title}</span>
                <span aria-hidden className={cls('ml-4 transition-transform duration-300', isOpen && 'rotate-180')}>
                  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              className={cls('px-5 pt-0 overflow-hidden transition-[max-height] duration-300', isOpen ? 'pb-5' : 'max-h-0 pb-0')}
              style={{ maxHeight: isOpen ? undefined : 0 }}
            >
              <div className="pt-4 text-sm text-gray-700">{item.children}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* =========================
   Simple Hero Banner
   ========================= */
interface HeroBannerProps {
  headline: string; subheadline?: string;
  ctaPrimary?: { label: string; href: string };
  backgroundImage?: string;
}
function HeroBanner({ headline, subheadline, ctaPrimary, backgroundImage }: HeroBannerProps) {
  return (
    <div
      className="relative w-full rounded-2xl overflow-hidden mb-10"
      style={{
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
        backgroundSize: 'cover', backgroundPosition: 'center', minHeight: '320px'
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
      <div className="relative max-w-6xl mx-auto px-6 py-16 md:py-20 text-white">
        <h1 className="text-3xl md:text-5xl font-black leading-tight">{headline}</h1>
        {subheadline && <p className="mt-3 text-white/90 max-w-2xl">{subheadline}</p>}
        {ctaPrimary && (
          <a href={ctaPrimary.href} className="inline-block mt-6">
            <Button variant="primary">{ctaPrimary.label}</Button>
          </a>
        )}
      </div>
    </div>
  );
}

/* =========================
   i18n (same donation-page pattern)
   ========================= */
type Lang = 'en' | 'ar';
const t = (lang: Lang) => {
  const isEn = lang === 'en';
  return {
    seoTitle: isEn ? 'Contact Us | Palestinian Community Association' : 'اتصل بنا | جمعية الجالية الفلسطينية',
    seoDesc: isEn
      ? 'Contact the Palestinian Community Association via WhatsApp or Email. Find us on the map.'
      : 'تواصل مع جمعية الجالية الفلسطينية عبر واتساب أو البريد الإلكتروني. اعثر علينا على الخريطة.',
    announcement: isEn
      ? 'Need help? Reach out — we’re here for the community.'
      : 'بحاجة لمساعدة؟ تواصل معنا — نحن هنا من أجل المجتمع.',
    toggleLabel: isEn ? 'عربي' : 'English',

    heroHeadline: isEn ? 'We’d Love to Hear From You' : 'يسعدنا سماعك دائمًا',
    heroSub: isEn
      ? 'Contact us on WhatsApp or email — whichever is easiest for you.'
      : 'تواصل معنا عبر واتساب أو البريد الإلكتروني — بما يناسبك.',
    heroCta: isEn ? 'Contact options' : 'خيارات التواصل',

    // Quick actions (removed Call Us)
    qa: [
      { label: 'WhatsApp', sub: '+' + WHATSAPP },
      { label: isEn ? 'Email' : 'البريد الإلكتروني', sub: EMAIL },
      { label: isEn ? 'Find Us' : 'اعثر علينا', sub: isEn ? 'Open in Google Maps' : 'افتح في خرائط جوجل' },
      { label: isEn ? 'Donate' : 'تبرّع', sub: isEn ? 'Make an impact today' : 'اصنع أثرًا اليوم' },
    ],

    // Info cards (no phone, no hours)
    infoEmail: isEn ? 'Email' : 'البريد الإلكتروني',
    infoAddress: isEn ? 'Address' : 'العنوان',
    infoOpenMap: isEn ? 'Open Map' : 'افتح الخريطة',
    infoCopy: isEn ? 'Copy' : 'نسخ',
    infoCopied: isEn ? 'Copied' : 'تم النسخ',

    // FAQ (remove call + form mentions)
    faqTitle: isEn ? 'Frequently Asked Questions' : 'أسئلة شائعة',
    faqs: [
      {
        title: isEn ? 'How can I get in touch with the community team?' : 'كيف أتواصل مع فريق الجالية؟',
        body: isEn
          ? <>Use WhatsApp or email us at <a href={`mailto:${EMAIL}`} className="underline text-palestine-green">{EMAIL}</a>. We aim to reply within 48 hours.</>
          : <>راسلنا عبر واتساب أو البريد الإلكتروني <a href={`mailto:${EMAIL}`} className="underline text-palestine-green">{EMAIL}</a>. نسعى للرد خلال 48 ساعة.</>,
      },
      {
        title: isEn ? 'Can I request a collaboration or event?' : 'هل يمكنني طلب تعاون أو فعالية؟',
        body: isEn
          ? <>Yes. Share your idea via WhatsApp or email and we’ll follow up with next steps.</>
          : <>نعم. شارك فكرتك عبر واتساب أو البريد وسنتابع معك الخطوات التالية.</>,
      },
      {
        title: isEn ? 'Is there support for new members?' : 'هل هناك دعم للأعضاء الجدد؟',
        body: isEn
          ? <>Absolutely. Mention that you are new and we’ll connect you with a community buddy.</>
          : <>بالتأكيد. اذكر أنك جديد وسنوصلك بصديق من المجتمع لمساعدتك.</>,
      },
    ],

    // Secondary CTA
    talkTitle: isEn ? 'Prefer to chat?' : 'تفضّل الدردشة؟',
    talkBody: isEn ? 'Message us on WhatsApp or email and we’ll respond as soon as possible.' : 'أرسل لنا على واتساب أو عبر البريد وسنرد بأسرع ما يمكن.',
  };
};

/* =========================
   Page
   ========================= */
export default function ContactPage() {
  const [lang, setLang] = useState<Lang>('en');
  const copy = t(lang);
  const [copied, setCopied] = useState<string | null>(null);

  const mapEmbedSrc = `https://www.google.com/maps?q=${GOOGLE_MAPS_QUERY}&hl=${lang === 'en' ? 'en' : 'ar'}&z=14&output=embed`;

  const faqs: AccordionItem[] = copy.faqs.map((f, i) => ({
    title: f.title,
    children: <p>{f.body}</p>,
    key: `faq-${i}`,
  }));

  const quickActions = [
    {
      label: copy.qa[0].label,
      onClick: () => window.open(`https://wa.me/${WHATSAPP}`, '_blank', 'noopener,noreferrer'),
      sub: copy.qa[0].sub,
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
          <path d="M20.52 3.48A11.94 11.94 0 0 0 12 .5 11.5 11.5 0 0 0 .5 12c0 2 .53 3.93 1.54 5.64L.5 23.5l6-1.56A11.43 11.43 0 0 0 12 23.5 11.5 11.5 0 0 0 23.5 12c0-3.19-1.24-6.19-3.48-8.52zM12 21a9 9 0 0 1-4.6-1.26l-.33-.2-3.58.93.96-3.49-.21-.34A9 9 0 1 1 12 21zm5.35-6.5c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.68.15-.2.29-.78.97-.95 1.17-.18.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.8-1.48-1.78-1.66-2.08-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.53.15-.18.2-.29.3-.49.1-.2.05-.37-.02-.52-.07-.15-.68-1.63-.93-2.24-.25-.6-.5-.52-.68-.53h-.58c-.2 0-.52.07-.79.37s-1.04 1.02-1.04 2.5 1.07 2.9 1.22 3.1c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.5 1.69.64.71.23 1.36.2 1.87.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.31.18-1.42-.07-.11-.25-.18-.55-.33z"/>
        </svg>
      )
    },
    {
      label: copy.qa[1].label,
      onClick: () => { window.location.href = `mailto:${EMAIL}`; },
      sub: copy.qa[1].sub,
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 4h16v16H4z" />
          <path d="M22 6l-10 7L2 6" />
        </svg>
      )
    },
    {
      label: copy.qa[2].label,
      onClick: () => window.open(`https://maps.google.com/?q=${GOOGLE_MAPS_QUERY}`, '_blank', 'noopener,noreferrer'),
      sub: copy.qa[2].sub,
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 21s6-5.33 6-10a6 6 0 0 0-12 0c0 4.67 6 10 6 10z" />
          <circle cx="12" cy="11" r="2.5" />
        </svg>
      )
    },
    {
      label: copy.qa[3].label,
      onClick: () => { window.location.href = '/donate'; },
      sub: copy.qa[3].sub,
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
          <path d="M12 21s-7-4.35-7-10.1A4.9 4.9 0 0 1 12 7a4.9 4.9 0 0 1 7 3.9C19 16.65 12 21 12 21Z" />
        </svg>
      )
    }
  ];

  return (
    <>
      <Head>
        <title>{copy.seoTitle}</title>
        <meta name="description" content={copy.seoDesc} />
      </Head>

      <Layout announcement={copy.announcement}>
        {/* Top bar: language toggle (LTR) */}
        <div className="container mx-auto px-6 pt-4">
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setLang(prev => (prev === 'en' ? 'ar' : 'en'))}
              className="inline-flex items-center gap-2 rounded-xl bg-white ring-1 ring-neutral-200 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50"
              aria-label="Toggle language"
            >
              <IconGlobe />
              <span>{copy.toggleLabel}</span>
            </button>
          </div>
        </div>

        {/* HERO */}
        <section className="section">
          <HeroBanner
            headline={copy.heroHeadline}
            subheadline={copy.heroSub}
            ctaPrimary={{ label: copy.heroCta, href: '#contact-form' }}
            backgroundImage="/images/slide3.jpg"
          />
        </section>

        {/* Quick Actions (no Call Us) */}
        <section className="section">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {quickActions.map((a, i) => (
                <button
                  key={i}
                  onClick={a.onClick}
                  className="group rounded-2xl border bg-white px-4 py-4 text-left shadow-sm hover:shadow-md transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="rounded-lg bg-palestine-light/60 p-2 text-palestine-green">{a.icon}</span>
                    <div>
                      <div className="font-semibold">{a.label}</div>
                      <div className="text-xs text-neutral-600">{a.sub}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Main (Info + FAQ + Map) — removed phone card, removed hours card, removed form */}
        <section id="contact-form" className="section">
          <div className="max-w-7xl mx-auto px-6 grid gap-12 lg:grid-cols-3">
            {/* Info + FAQ + Map */}
            <div className="space-y-6 lg:col-span-1">
              {/* Info Cards */}
              <div className="grid grid-cols-1 gap-4">
                <div className="rounded-2xl border bg-white p-5 shadow-card">
                  <div className="font-semibold">{copy.infoEmail}</div>
                  <div className="text-sm text-neutral-700 mt-1">{EMAIL}</div>
                  <div className="mt-3 flex gap-2">
                    <Button onClick={() => (window.location.href = `mailto:${EMAIL}`)} variant="secondary">{copy.infoEmail}</Button>
                    <Button
                      onClick={async () => { if (await copyText(EMAIL)) setCopied('email'); }}
                      variant="ghost"
                    >
                      {copy.infoCopy}
                    </Button>
                  </div>
                </div>

                <div className="rounded-2xl border bg-white p-5 shadow-card">
                  <div className="font-semibold">{copy.infoAddress}</div>
                  <div className="text-sm text-neutral-700 mt-1">{ADDRESS}</div>
                  <div className="mt-3 flex gap-2">
                    <Button onClick={() => window.open(`https://maps.google.com/?q=${GOOGLE_MAPS_QUERY}`, '_blank', 'noopener,noreferrer')} variant="secondary">{copy.infoOpenMap}</Button>
                    <Button
                      onClick={async () => { if (await copyText(ADDRESS)) setCopied('address'); }}
                      variant="ghost"
                    >
                      {copy.infoCopy}
                    </Button>
                  </div>
                </div>

                {copied && <div className="text-xs text-emerald-700">{copy.infoCopied} {copied} ✓</div>}
              </div>

              {/* FAQ */}
              <div>
                <h3 className="text-xl font-bold mb-3">{copy.faqTitle}</h3>
                <Accordion items={faqs} />
              </div>

              {/* Map */}
              <div className="rounded-2xl overflow-hidden border shadow-sm bg-white">
                <iframe
                  title={`${ORG_NAME} - Map`}
                  src={mapEmbedSrc}
                  className="w-full h-64"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
                <div className="p-3 text-xs text-neutral-600 flex items-center justify-between">
                  <span>{ADDRESS}</span>
                  <a
                    className="text-palestine-green underline"
                    href={`https://maps.google.com/?q=${GOOGLE_MAPS_QUERY}`}
                    target="_blank" rel="noreferrer"
                  >
                    {copy.qa[2].sub}
                  </a>
                </div>
              </div>
            </div>

            {/* Right column removed (was the send message form) */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl shadow-card p-8 flex items-center justify-center min-h-[240px]">
                <div className="text-center text-sm text-neutral-600">
                  {lang === 'en' ? (
                    <>
                      <p>Prefer WhatsApp? Use the quick action above to open a chat.</p>
                      <p className="mt-1">Or email us and we’ll get back to you shortly.</p>
                    </>
                  ) : (
                    <>
                      <p>تفضّل واتساب؟ استخدم زر الإجراءات السريعة بالأعلى لفتح محادثة.</p>
                      <p className="mt-1">أو أرسل لنا بريدًا وسنعاود الاتصال بك قريبًا.</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Secondary CTA — WhatsApp only (removed Call) */}
        <section className="section">
          <div className="max-w-5xl mx-auto px-6">
            <div className="rounded-2xl bg-gradient-to-r from-palestine-green to-palestine-red text-white p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg">
              <div>
                <div className="text-lg font-semibold">{copy.talkTitle}</div>
                <div className="text-white/90 text-sm">{copy.talkBody}</div>
              </div>
              <div className="flex gap-3">
                <Button onClick={() => window.open(`https://wa.me/${WHATSAPP}`, '_blank', 'noopener,noreferrer')} variant="white">WhatsApp</Button>
                <Button onClick={() => (window.location.href = `mailto:${EMAIL}`)} variant="white">Email</Button>
              </div>
            </div>
          </div>
        </section>
      </Layout>
    </>
  );
}
