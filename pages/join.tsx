// pages/join.tsx
import Head from 'next/head';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import React from 'react';
import { useRouter } from 'next/router';

/* -----------------------------------------------------------------------------
  Helpers + Fallbacks
----------------------------------------------------------------------------- */

function pick(mod: unknown, keys: string[]) {
  for (const k of keys) {
    const c = (mod as any)?.[k];
    if (typeof c === 'function') return c;
  }
  return null;
}

const siteBase =
  (typeof process !== 'undefined' && (process as any).env.NEXT_PUBLIC_BASE_URL) ||
  (typeof window !== 'undefined' ? window.location.origin : '');

/** Layout (fallback) */
const FallbackLayout: React.FC<{ announcement?: string; children?: React.ReactNode }> = ({
  announcement,
  children,
}) => (
  <div>
    {announcement ? (
      <div className="w-full bg-emerald-50 text-emerald-800 border border-emerald-200 py-2 text-center text-sm">
        {announcement}
      </div>
    ) : null}
    <main className="min-h-screen pt-20">{children}</main>
  </div>
);

/** Hero (fallback) */
const FallbackHero: React.FC<{
  headline: string;
  subheadline?: string;
  ctaPrimary?: { label: string; href: string };
  ctaSecondary?: { label: string; href: string };
  backgroundImage?: string;
}> = ({ headline, subheadline, ctaPrimary, ctaSecondary, backgroundImage }) => (
  <section className="relative rounded-2xl overflow-hidden">
    {backgroundImage ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={backgroundImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
    ) : (
      <div className="absolute inset-0 bg-neutral-100" />
    )}
    <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,.55),rgba(0,0,0,.25),transparent)]" />
    <div className="relative px-6 py-16 md:py-24 text-white max-w-6xl mx-auto">
      <h1 className="text-3xl md:text-5xl font-black leading-tight">{headline}</h1>
      {subheadline && <p className="mt-3 text-white/90 max-w-2xl text-lg">{subheadline}</p>}
      <div className="mt-6 flex flex-wrap gap-3">
        {ctaPrimary && (
          <Link href={ctaPrimary.href} className="rounded-full bg-[#007A3D] px-6 py-3 font-semibold text-white hover:bg-[#026b35]">
            {ctaPrimary.label}
          </Link>
        )}
        {ctaSecondary && (
          <Link
            href={ctaSecondary.href}
            className="rounded-full bg-white/10 ring-1 ring-white/30 px-6 py-3 font-semibold text-white hover:bg-white/20"
          >
            {ctaSecondary.label}
          </Link>
        )}
      </div>
    </div>
  </section>
);

/** Accordion (fallback) */
const FallbackAccordion: React.FC<{ items: { title: string; children: React.ReactNode }[] }> = ({ items }) => {
  const [open, setOpen] = React.useState<number | null>(0);
  return (
    <div className="space-y-3">
      {items.map((it, i) => {
        const isOpen = open === i;
        return (
          <div key={i} className="border rounded-xl overflow-hidden bg-white">
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              className="w-full flex justify-between items-center px-5 py-4 text-left font-medium hover:bg-neutral-50"
              aria-expanded={isOpen}
            >
              <span>{it.title}</span>
              <span className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden>
                ⌄
              </span>
            </button>
            <div className={`px-5 transition-[max-height] ${isOpen ? 'py-4' : 'max-h-0 overflow-hidden'}`}>{it.children}</div>
          </div>
        );
      })}
    </div>
  );
};

/** JoinForm (fallback) */
const FallbackJoinForm: React.FC<{
  defaultFee?: number;
  PaymentWidget?: React.ComponentType<unknown>;
  initialApplicationId?: string;
}> = ({ defaultFee = 11.99 }) => (
  <div className="rounded-2xl border bg-amber-50 text-amber-800 p-4">
    ⚠️ تعذّر تحميل نموذج العضوية. تأكّد من وجود الملف
    <code className="mx-1 px-1 rounded bg-amber-100 border border-amber-200">components/Joinform.tsx</code>
    وتصدير المكوّن الافتراضي. سيتم استخدام قيمة افتراضية للرسوم: <b>£{defaultFee}</b>.
  </div>
);

/* -----------------------------------------------------------------------------
  Dynamic Imports (keep paths consistent)
----------------------------------------------------------------------------- */

const Layout = dynamic(async () => {
  const mod = await import('../components/Layout').catch(() => ({} as unknown));
  return (pick(mod, ['default', 'Layout']) as any) ?? FallbackLayout;
}, { ssr: true });

const Hero = dynamic(async () => {
  const mod = await import('../components/Hero').catch(() => ({} as unknown));
  return (pick(mod, ['default', 'Hero']) as any) ?? FallbackHero;
}, { ssr: false });

const Accordion = dynamic(async () => {
  const mod = await import('../components/Accordion').catch(() => ({} as unknown));
  return (pick(mod, ['default', 'Accordion']) as any) ?? FallbackAccordion;
}, { ssr: false });

/** NOTE: file name is Joinform.tsx (lowercase "f") */
const JoinForm = dynamic(async () => {
  const mod = await import('/components/Joinform').catch(() => ({} as unknown));
  return (pick(mod, ['default', 'JoinForm']) as any) ?? FallbackJoinForm;
}, { ssr: false }) as React.ComponentType<{
  defaultFee?: number;
  PaymentWidget?: React.ComponentType<unknown>;
  initialApplicationId?: string;
}>;

const PaymentWidget = dynamic(async () => {
  const mod = await import('../components/payments/PaymentWidget').catch(() => ({} as unknown));
  const Comp = (pick(mod, ['default', 'PaymentWidget']) as any);
  return Comp ?? (() => (
    <div className="rounded-2xl border bg-amber-50 text-amber-800 p-4">
      ⚠️ تعذّر تحميل بوابات الدفع. تأكّد من وجود الملف
      <code className="mx-1 px-1 rounded bg-amber-100 border border-amber-200">components/payments/PaymentWidget.tsx</code>
      وضبط مفاتيح البيئة الخاصة بـ <b>Stripe</b> و<b>PayPal</b>.
    </div>
  ));
}, { ssr: false });

/* -----------------------------------------------------------------------------
  Icons
----------------------------------------------------------------------------- */

function IconGlobe() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
    </svg>
  );
}

/* -----------------------------------------------------------------------------
  i18n (same pattern as Donate page, but LTR layout)
----------------------------------------------------------------------------- */

type Lang = 'en' | 'ar';

const t = (lang: Lang) => ({
  // SEO
  seoTitle: lang === 'en'
    ? 'Join the Community | Palestinian Community Association'
    : 'انضم إلى الجالية | Palestinian Community Association',
  seoDesc: lang === 'en'
    ? 'Join the Palestinian Community Association in North West UK — easy membership with optional monthly support from £0.'
    : 'انضم للجالية الفلسطينية في شمال غرب بريطانيا — عضوية ميسّرة، والدعم الشهري اختياري يبدأ من صفر.',
  announce: lang === 'en'
    ? 'Welcome — Membership open to all. Monthly support is optional starting from £0.'
    : 'أهلًا بك — الانضمام متاح للجميع، والدعم الشهري اختياري يبدأ من صفر.',
  // Language toggle
  toggleLabel: lang === 'en' ? 'عربي' : 'English',

  // Hero
  heroHeadline: lang === 'en'
    ? 'Join… because our hearts and identity are one'
    : 'انضم… لأن القلب واحد والهوية واحدة',
  heroSub: lang === 'en'
    ? 'Be part of the Palestinian community in North West UK. A community that embraces, supports, and grows with you.'
    : 'كن جزءًا من الجالية الفلسطينية في شمال غرب بريطانيا. مجتمعٌ يحتضنك، يساندك، ويكبر بك.',
  heroCtaPrimary: lang === 'en' ? 'Join Now' : 'انضم الآن',
  heroCtaSecondary: lang === 'en' ? 'Why Join?' : 'لماذا الانضمام؟',

  // Why Join section
  whyJoinTitle: lang === 'en' ? 'Why join today?' : 'لماذا تنضمّ اليوم؟',
  whyJoinBody: lang === 'en'
    ? 'We’re here to keep names and faces connected, stand together in hardship, and celebrate joy together. Your membership creates a safe space, a living identity, and timely support for those in need.'
    : 'لأننا هنا لنحفظ الوجوه والأسماء، ونشدّ الأزر وقت الشدائد، ونحتفي بفرحنا معًا. عضويتك تصنع مساحة آمنة، وهوية حيّة، وعونًا يصل لمن يحتاج.',
  planPickerLabel: lang === 'en' ? 'Choose your monthly support (optional)' : 'اختر دعمك الشهري (اختياري)',
  planFree: lang === 'en' ? '£0 (Free)' : '£0 (مجانًا)',
  planMonthly: (fee: number) => (lang === 'en' ? `£${fee} / month` : `£${fee} / شهريًا`),
  planNote: lang === 'en'
    ? 'You can start free today — and support later when you can ♥'
    : 'يمكنك البدء مجانًا اليوم — والدعم لاحقًا حين تستطيع ♥',
  planContinueFree: lang === 'en' ? 'Join Free' : 'انضم مجانًا',
  planContinuePaid: (fee: number) => (lang === 'en' ? `Continue — £${fee}/mo` : `أكمل — £${fee}/شهريًا`),

  // Benefits
  benefits: lang === 'en'
    ? [
        { icon: '🤝', title: 'A community that has your back', description: 'Instant updates, charity initiatives, and volunteer opportunities that make real impact.' },
        { icon: '🎉', title: 'Identity & culture', description: 'Dabke, stories, and festivals that keep memory alive and hearts united.' },
        { icon: '🌱', title: 'Space for youth', description: 'Mentorship, skills programs, leadership growth, and open doors for the future.' },
        { icon: '📣', title: 'A heard voice', description: 'Partnerships, civic impact, and a dignified Palestinian presence in the North West.' },
      ]
    : [
        { icon: '🤝', title: 'مجتمعٌ يساندك', description: 'تحديثات فورية، مبادرات خيرية، وفرص تطوّع تصنع فرقًا حقيقيًا.' },
        { icon: '🎉', title: 'هوية وثقافة', description: 'دبكة وحكايات ومهرجانات تُبقي الذاكرة حيّة وتجمع القلوب.' },
        { icon: '🌱', title: 'مساحة للشباب', description: 'إرشاد وبرامج مهارية وصقل للقيادة وفتح لأبواب المستقبل.' },
        { icon: '📣', title: 'صوتٌ مسموع', description: 'شراكات وتأثير مدني وحضورٌ فلسطيني كريم في شمال غرب بريطانيا.' },
      ],

  // Teaser card
  teaserTitle: lang === 'en' ? 'Your membership is hope' : 'عضويتك أمل',
  teaserSub: lang === 'en' ? 'Quick form, no account required.' : 'نموذج سريع، بلا حساب ولا تعقيد.',
  teaserBullets: lang === 'en'
    ? [
        { icon: '✅', t: 'Community access', s: 'Events, news, and initiatives' },
        { icon: '🌍', t: 'Identity alive', s: 'Heritage living across generations' },
        { icon: '🧡', t: 'Impactful giving', s: 'Solidarity from heart to heart' },
      ]
    : [
        { icon: '✅', t: 'وصول للمجتمع', s: 'أحداث، أخبار، ومبادرات' },
        { icon: '🌍', t: 'هوية حاضرة', s: 'تراثٌ يُحيا مع الأجيال' },
        { icon: '🧡', t: 'عطاءٌ مؤثّر', s: 'تضامنٌ يصل من القلب إلى القلب' },
      ],
  teaserBadge: lang === 'en' ? 'No login required' : 'بلا تسجيل دخول',
  teaserGetStarted: lang === 'en' ? 'Get Started' : 'ابدأ الآن',

  // Form section
  formTitle: lang === 'en' ? 'Community Membership Form' : 'استمارة عضوية الجالية',
  formIntroA: lang === 'en'
    ? 'Fill in the details and we will get in touch. After creating your application, an'
    : 'املأ البيانات التالية وسنتواصل معك. بعد إنشاء الطلب سيظهر',
  formIntroB: lang === 'en'
    ? 'will appear below the form. You can activate subscription or pay via'
    : 'أسفل الاستمارة، وتستطيع تفعيل الاشتراك أو الدفع عبر',
  formIntroC: lang === 'en'
    ? 'directly inside the form.'
    : 'من داخل الاستمارة مباشرة.',
  formNote: lang === 'en'
    ? '(You can also choose a custom membership amount — including free.)'
    : '(يمكنك أيضًا اختيار مبلغ عضوية مخصّص — بما في ذلك مجانًا)',
  applicationId: lang === 'en' ? 'Application ID' : 'رقم الطلب (Application ID)',

  // FAQ
  faqTitle: lang === 'en' ? 'Frequently Asked Questions' : 'أسئلة شائعة',
  faqSubtitle: lang === 'en'
    ? 'If you have any doubts, this will reassure you before joining.'
    : 'إذا كان لديك أي تساؤل، ستجد هنا ما يطمئنك قبل الانضمام.',
  faqItems: lang === 'en'
    ? [
        {
          title: 'Do I need an account or login to join?',
          body: 'No. Joining is easy and quick—just fill in the form and we’ll contact you. No login required.',
        },
        {
          title: 'Is my data safe?',
          body: 'Yes. We do not share your information without consent. Your data is used for community purposes and kept secure.',
        },
        {
          title: 'Can I edit my details later?',
          body: 'Absolutely. Reach out via the contact page and we’ll update your preferences with pleasure.',
        },
        {
          title: 'How will you contact me?',
          body: 'By email and sometimes WhatsApp/Telegram if you opt in. You can change your preferences at any time.',
        },
      ]
    : [
        {
          title: 'هل الانضمام يتطلّب حسابًا أو تسجيل دخول؟',
          body: 'لا. الانضمام سهل وسريع — فقط املأ الاستمارة وسنتواصل معك. لا حاجة لأي تسجيل دخول.',
        },
        {
          title: 'هل بياناتي آمنة؟',
          body: 'نعم. لا نشارك معلوماتك دون موافقتك. تُستخدم بياناتك فقط لأغراض مجتمعية وبأمان.',
        },
        {
          title: 'هل يمكنني تعديل بياناتي لاحقًا؟',
          body: 'بالتأكيد. تواصل معنا عبر صفحة التواصل وسنقوم بتحديث تفضيلاتك بكل سرور.',
        },
        {
          title: 'كيف سيتم التواصل معي؟',
          body: 'عبر البريد الإلكتروني وأحيانًا الواتساب/التلغرام إذا رغبت بذلك. ويمكنك تغيير تفضيلاتك متى شئت.',
        },
      ],

  // Help card
  helpTitle: lang === 'en' ? 'Need help?' : 'بحاجة لمساعدة؟',
  helpBody: lang === 'en'
    ? 'Our team is happy to help with any question. Contact us anytime.'
    : 'يسعد فريقنا بمساعدتك في أي استفسار. تواصل معنا بكل أريحية.',
  helpCta: lang === 'en' ? 'Contact Us' : 'تواصل معنا',

  // Final CTA
  finalTitle: lang === 'en' ? 'This is home… this is family' : 'هنا البيت… وهنا العائلة',
  finalBody: lang === 'en'
    ? 'Join today and be part of a story bigger than all of us—a people who make hope wherever they are.'
    : 'انضم اليوم، وكن جزءًا من قصة أكبر منّا جميعًا — قصة شعبٍ يصنع الأمل أينما كان.',
  finalCta: lang === 'en' ? 'Fill the Form' : 'املأ الاستمارة',
});

/* -----------------------------------------------------------------------------
  Page
----------------------------------------------------------------------------- */

export default function JoinPage() {
  const router = useRouter();

  // language (donation-page pattern)
  const [lang, setLang] = React.useState<Lang>('en');
  const copy = React.useMemo(() => t(lang), [lang]);

  // Initial fee selection – supports 0, 11.99, 21.99, 44.99 (custom is handled inside Joinform)
  const [pickedFee, setPickedFee] = React.useState<number>(0);

  // Pre-fill application id from query (?app=...) or hash (#payment:ID)
  const [initialApplicationId, setInitialApplicationId] = React.useState<string>('');

  React.useEffect(() => {
    if (!router.isReady) return;
    const q = (router.query as any)?.app;
    const app = Array.isArray(q) ? q[0] : q;
    if (app) setInitialApplicationId(app);

    if (typeof window !== 'undefined') {
      const hash = window.location.hash || '';
      if (hash.startsWith('#payment:')) {
        const id = hash.replace('#payment:', '').trim();
        if (id) setInitialApplicationId(id);
      }
    }
  }, [router.isReady, router.query]);

  const canonical = `${siteBase || ''}/join`;

  return (
    <>
      <Head>
        <title>{copy.seoTitle}</title>
        <meta name="description" content={copy.seoDesc} />
        <link rel="canonical" href={canonical} />
        {/* Open Graph */}
        <meta property="og:title" content={copy.seoTitle} />
        <meta property="og:description" content={copy.seoDesc} />
        <meta property="og:url" content={canonical} />
        <meta property="og:type" content="website" />
        {/* JSON-LD */}
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'Palestinian Community Association (North West UK)',
              url: canonical,
              areaServed: 'GB',
            }),
          }}
        />
      </Head>

      {/* Full page LTR with top-right language toggle */}
      <Layout announcement={copy.announce}>
        <main dir="ltr" className="text-left">
          {/* top bar: language toggle */}
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

          {/* Hero (LTR layout) */}
          <section className="mb-16">
            <div className="container mx-auto px-6">
              <Hero
                headline={copy.heroHeadline}
                subheadline={copy.heroSub}
                ctaPrimary={{ label: copy.heroCtaPrimary, href: '#join-form' }}
                ctaSecondary={{ label: copy.heroCtaSecondary, href: '#why-join' }}
                backgroundImage="/images/slide1.jpg"
              />
            </div>
          </section>

          {/* Why Join (LTR) */}
          <section id="why-join" className="section">
            <div className="max-w-7xl mx-auto grid gap-12 md:grid-cols-2 items-start px-6">
              {/* copy + quick plan picker */}
              <div className="space-y-5">
                <h2 className="text-3xl font-extrabold">{copy.whyJoinTitle}</h2>
                <p className="text-lg text-palestine-muted leading-8">
                  {copy.whyJoinBody}
                </p>

                {/* Pick a plan */}
                <div className="mt-2">
                  <div className="text-sm font-semibold mb-2">{copy.planPickerLabel}</div>
                  <div className="grid grid-cols-4 gap-2 max-w-xl">
                    {[0, 11.99, 21.99, 49.99].map((fee) => (
                      <button
                        key={fee}
                        type="button"
                        onClick={() => setPickedFee(fee)}
                        className={`rounded-full border px-4 py-2 text-sm transition
                          ${pickedFee === fee ? 'bg-[#007A3D] text-white border-[#007A3D]' : 'bg-white hover:bg-neutral-50'}`}
                      >
                        {fee === 0 ? copy.planFree : copy.planMonthly(fee)}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 text-xs text-neutral-600">{copy.planNote}</div>
                  <div className="mt-4">
                    <Link
                      href="#join-form"
                      className="inline-block rounded-full bg-[#007A3D] text-white px-6 py-2.5 font-semibold hover:bg-[#026b35]"
                    >
                      {pickedFee === 0 ? copy.planContinueFree : copy.planContinuePaid(pickedFee)}
                    </Link>
                  </div>
                </div>

                {/* Benefits */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  {copy.benefits.map((b) => (
                    <div key={b.title} className="flex gap-4 p-5 bg-white rounded-xl border shadow-sm hover:shadow-md transition">
                      <div className="text-3xl leading-none">{b.icon}</div>
                      <div className="flex-1">
                        <h3 className="font-semibold">{b.title}</h3>
                        <p className="text-sm mt-1 text-gray-600 leading-7">{b.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Teaser */}
              <div className="relative">
                <div className="bg-white p-6 rounded-2xl shadow-card border">
                  <div className="text-center mb-4">
                    <div className="text-3xl font-extrabold text-[#007A3D]">{copy.teaserTitle}</div>
                    <div className="text-sm text-palestine-muted mt-1">{copy.teaserSub}</div>
                  </div>
                  <div className="flex flex-col gap-3">
                    {copy.teaserBullets.map((x) => (
                      <div key={x.t} className="flex items-center gap-2">
                        <div className="text-xl">{x.icon}</div>
                        <div>
                          <div className="font-medium">{x.t}</div>
                          <div className="text-xs text-gray-600">{x.s}</div>
                        </div>
                      </div>
                    ))}
                    <Link href="#join-form" className="inline-block">
                      <button className="mt-2 w-full rounded-full bg-[#007A3D] text-white px-5 py-2.5 font-semibold hover:bg-[#026b35]">
                        {copy.teaserGetStarted}
                      </button>
                    </Link>
                  </div>
                </div>
                <div className="absolute -top-4 -right-4 bg-palestine-accent text-palestine-dark px-4 py-2 rounded-full font-semibold shadow-lg">
                  {copy.teaserBadge}
                </div>
              </div>
            </div>
          </section>

          {/* Join Form (LTR) */}
          <section id="join-form" className="section bg-white">
            <div className="max-w-4xl mx-auto px-6">
              <div className="mb-8 text-center">
                <h2 className="text-3xl font-extrabold">{copy.formTitle}</h2>
                <p className="text-palestine-muted mt-2">
                  {copy.formIntroA} <b>{copy.applicationId}</b> {copy.formIntroB} <b>Stripe</b> {lang === 'en' ? 'or' : 'أو'} <b>PayPal</b> {copy.formIntroC}
                </p>
                <p className="text-xs text-neutral-500 mt-1">{copy.formNote}</p>
              </div>

              <JoinForm
                defaultFee={pickedFee}
                PaymentWidget={PaymentWidget as unknown}
                initialApplicationId={initialApplicationId}
              />
            </div>
          </section>

          {/* FAQ (LTR) */}
          <section className="section">
            <div className="max-w-7xl mx-auto grid gap-12 md:grid-cols-2 px-6">
              <div>
                <h2 className="text-3xl font-extrabold mb-2">{copy.faqTitle}</h2>
                <p className="text-palestine-muted mb-6">{copy.faqSubtitle}</p>
                <Accordion
                  items={copy.faqItems.map((f) => ({
                    title: f.title,
                    children: <p className="text-sm text-gray-700">{f.body}</p>,
                  })) as any}
                />
              </div>
              <div className="flex items-center justify-center">
                <div className="p-6 bg-palestine-green/10 rounded-xl shadow-md border">
                  <h3 className="text-xl font-semibold mb-2">{copy.helpTitle}</h3>
                  <p className="text-sm text-gray-700 mb-4">{copy.helpBody}</p>
                  <Link href="/contact">
                    <button className="rounded-full bg-neutral-900 text-white px-5 py-2 text-sm font-semibold hover:bg-black">
                      {copy.helpCta}
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          </section>

          {/* Final CTA (LTR) */}
          <section className="section bg-palestine-dark text-white rounded-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-palestine-green/70 to-palestine-red/70 mix-blend-overlay" />
            <div className="relative max-w-6xl mx-auto px-6 py-16 grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h2 className="text-4xl font-extrabold mb-2">{copy.finalTitle}</h2>
                <p className="mb-5 text-lg text-white/95">
                  {copy.finalBody}
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link href="#join-form">
                    <button className="rounded-full bg-white text-neutral-900 px-6 py-2.5 font-semibold hover:bg-neutral-100">
                      {copy.finalCta}
                    </button>
                  </Link>
                </div>
              </div>
              <div className="justify-self-center md:justify-self-end">
                <div className="w-40 h-40 md:w-48 md:h-48 bg-palestine-accent rounded-full flex items-center justify-center text-palestine-dark font-extrabold text-3xl shadow-lg">
                  🇵🇸
                </div>
              </div>
            </div>
          </section>
        </main>
      </Layout>
    </>
  );
}
