// pages/about.tsx — Gaza Go / Gazago (EN/AR)
// Matches donate page language toggle UI (button under navbar), no navbar/footer coupling.
// Titles and all Arabic content flip RTL; English is LTR. Dynamic imports + fallbacks kept.

import Head from 'next/head';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import React from 'react';

/** Helper: pick a valid React component function from a module */
function pickComponent(mod: unknown, keys: string[]) {
  for (const k of keys) {
    const c = (mod as any)?.[k];
    if (typeof c === 'function') return c;
  }
  return null;
}

/** Fallbacks (only used if dynamic imports fail) */
const FallbackLayout: React.FC<{ announcement?: string; children?: React.ReactNode }> = ({ announcement, children }) => (
  <div>
    {announcement ? (
      <div className="w-full bg-emerald-50 text-emerald-800 border border-emerald-200 py-2 text-center text-sm">
        {announcement}
      </div>
    ) : null}
    <main className="min-h-screen pt-20">{children}</main>
  </div>
);

const FallbackHero: React.FC<{
  headline: string;
  subheadline?: string;
  ctaPrimary?: { label: string; href: string };
  ctaSecondary?: { label: string; href: string };
  backgroundImage?: string;
  stats?: { label: string; value: string }[];
}> = ({ headline, subheadline, ctaPrimary, ctaSecondary, backgroundImage, stats }) => (
  <div className="relative rounded-2xl overflow-hidden">
    {backgroundImage ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={backgroundImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
    ) : (
      <div className="absolute inset-0 bg-neutral-100" />
    )}
    <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/20 to-transparent" />
    <div className="relative px-6 py-16 md:py-20 text-white max-w-6xl mx-auto">
      <h1 className="text-3xl md:text-5xl font-black tracking-tight drop-shadow-sm">{headline}</h1>
      {subheadline && <p className="mt-2 md:text-lg text-white/90 max-w-2xl">{subheadline}</p>}
      <div className="mt-5 flex flex-wrap gap-3">
        {ctaPrimary && (
          <Link href={ctaPrimary.href} className="rounded-full bg-[#007A3D] px-5 py-2.5 font-semibold text-white hover:bg-[#026b35]">
            {ctaPrimary.label}
          </Link>
        )}
        {ctaSecondary && (
          <Link href={ctaSecondary.href} className="rounded-full bg-white/10 ring-1 ring-white/30 px-5 py-2.5 font-semibold text-white hover:bg-white/20">
            {ctaSecondary.label}
          </Link>
        )}
      </div>
      {!!stats?.length && (
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl bg-white/10 ring-1 ring-white/20 backdrop-blur p-3">
              <div className="text-white font-bold">{s.value}</div>
              <div className="text-white/80 text-sm">{s.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
);

const FallbackButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className, children, ...rest }) => (
  <button
    className={`rounded-full px-4 py-2 text-sm font-semibold bg-neutral-900 text-white hover:bg-black ${className || ''}`}
    {...rest}
  >
    {children}
  </button>
);

const FallbackTeamMemberCard: React.FC<{ member: { name: string; role: string; photo?: string; bio?: string } }> = ({ member }) => (
  <div className="bg-white rounded-xl shadow-card overflow-hidden border">
    {member.photo ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={member.photo} alt={member.name} className="w-full h-48 object-cover" />
    ) : (
      <div className="w-full h-48 bg-neutral-100 flex items-center justify-center text-xl font-bold">{member.name[0]}</div>
    )}
    <div className="p-5">
      <div className="font-bold">{member.name}</div>
      <div className="text-sm text-neutral-600">{member.role}</div>
      {member.bio && <p className="mt-2 text-sm text-neutral-700">{member.bio}</p>}
    </div>
  </div>
);

/** Dynamic-safe imports */
const Layout = dynamic(async () => {
  const mod = await import('../components/Layout').catch(() => ({} as unknown));
  return pickComponent(mod, ['default', 'Layout']) ?? FallbackLayout;
}, { ssr: true });

const Hero = dynamic(async () => {
  const mod = await import('../components/Hero').catch(() => ({} as unknown));
  return pickComponent(mod, ['default', 'Hero']) ?? FallbackHero;
}, { ssr: false });

const Button = dynamic(async () => {
  const mod = await import('../components/Button').catch(() => ({} as unknown));
  return pickComponent(mod, ['default', 'Button']) ?? FallbackButton;
}, { ssr: false });

const TeamMemberCard = dynamic(async () => {
  const mod = await import('../components/TeamMemberCard').catch(() => ({} as unknown));
  return pickComponent(mod, ['default', 'TeamMemberCard']) ?? FallbackTeamMemberCard;
}, { ssr: false });

/** In-page bilingual dictionary */
const t = {
  en: {
    metaTitle: 'About — Gaza Go',
    metaDesc:
      "Gaza Go is a hybrid social enterprise moving from relief to sustainable, locally-led prosperity. Learn about our vision, philosophy, structure, sustainability, partnerships, and our three flagship programs: Khedma, Not Only, and Ant's.",
    announcement: 'People. Dignity. Sustainable Futures.',
    toggleLabel: 'العربية',
    hero: {
      title: 'Who We Are',
      sub: 'From relief to resilience: transparent governance, youth-first capacity, and revenue-backed community services.',
      primary: 'Our Roadmap',
      secondary: 'Transparency',
    },
    nav: {
      overview: 'Overview',
      vision: 'Vision',
      philosophy: 'Philosophy',
      structure: 'Structure',
      sustainability: 'Sustainability',
      partnerships: 'Partnerships',
      khedma: 'Program: Service Go (Khedma)',
      notOnly: 'Program: Not Only',
      ants: "Program: Ant's (Kayan)",
      conclusion: 'Conclusion',
    },
    overview: {
      title: 'Overview',
      body:
        'Gaza Go operates across two tracks: sustainable, revenue-positive ventures and high-trust community services. On this page, explore our vision, philosophy, structure, sustainability model, international partnerships, and three execution programs designed to create jobs, stabilize essentials, and elevate the narrative with dignity.',
    },
    vision: {
      title: 'Gaza Go Vision',
      body:
        'Gaza Go is not merely an economic or media project; it is a human-centered development system pulsing from the heart of the Palestinian experience. Our vision is to turn support into partnership, suffering into production, and ideas into action.',
    },
    philosophy: {
      title: 'Born out of Nothingness',
      body:
        'We are born from nothingness—and from the ashes we craft light. This phrase embodies our spirit: transforming emptiness into a beginning, and despair into constructive energy.',
    },
    structure: {
      title: 'Administrative & Operational Structure',
      body:
        'Each program has its own operational lead, while a central leadership unifies vision, strategy, and resource integration—balancing flexibility with clear accountability.',
    },
    sustainability: {
      title: 'Sustainability & Self-Funding',
      body:
        'Gaza Go relies on an integrated production model: revenues from service ventures fund content and training, targeting medium-term financial independence.',
    },
    partnerships: {
      title: 'International Partnerships',
      body:
        'We seek partnerships in China, Dubai, and beyond—building bridges for production and market resilience, and culturally rooted products that carry the spirit of Palestine to global markets.',
    },
    khedma: {
      badge: 'Service & Ventures',
      title: 'Service Go (Khedma): Community-Rooted Ventures',
      intro:
        'A portfolio of professional ventures with a service ethos and sustainability at the core—launched across three specialist tracks.',
      tracksTitle: 'Specialist Tracks',
      tracks: [
        {
          title: 'Khedma Bakery',
          body:
            'A municipal-style bakery for traditional bread and pastries, 100% labor-driven, creating ~15–20 sustained jobs prioritizing youth and women. Scales with demand and capacity.',
          meta: ['~15–20 jobs to start', 'Labor-first model', 'Traditional bread & pastry'],
        },
        {
          title: 'Khedma Market (Price Stabilizer)',
          body:
            'A community essentials retail service keeping prices stable despite supply shocks. Runs an inventory-density mechanism to dampen volatility and discourage hoarding. Targets ~30–50 jobs.',
          meta: ['Price stability system', '30–50 jobs', 'Anti-hoarding design'],
        },
        {
          title: 'Khedma Care (Community Partnerships)',
          body:
            'A networked service brokering win–win collaborations between public/private providers and beneficiaries. We curate seasonal care bundles under an “everyone wins” principle.',
          meta: ['Public–private mesh', 'Brokered services', 'Seasonal bundles'],
        },
      ],
    },
    notOnly: {
      badge: 'Narrative & Culture',
      title: 'Not Only — Season One',
      intro:
        'A symbolic editorial line that reveals the unseen side of lived experience—via three platforms.',
      items: [
        {
          title: 'Not Only Number',
          body: 'Cinematically documenting families erased from civil registries—or with only a single survivor—restoring names and context beyond aggregates.',
        },
        {
          title: 'Not Only Stone',
          body: 'Stories of families whose homes became de facto graves due to collapse and impossibility of safe recovery—handled with utmost dignity.',
        },
        {
          title: 'Not Only Flower',
          body: 'Portraits of those martyred while seeking aid—most of them “in the age of flowers”—honoring their dignity and rights.',
        },
      ],
    },
    ants: {
      badge: 'Capacity & Talent',
      title: "Ant's (Kayan): Discipline, Meshwork, Delivery",
      intro:
        'We mirror the disciplined, distributed, and persistent work ethic of ants—forming specialist squads, rapid response circles, and talent showcases.',
      items: [
        {
          title: 'Momken (Specialist Squads)',
          body: 'Build and deploy legal, logistics, and technical squads directly into priority ventures—then into wider market demand.',
          meta: ['Legal', 'Logistics', 'Tech'],
        },
        {
          title: 'Eejabyon (Civic Ultras)',
          body: 'A highly interactive mesh of supporters in constant readiness for mobilization, advocacy, and positive participation—an always-on virtual ultras.',
          meta: ['Mobilize', 'Advocate', 'Sustain Participation'],
        },
        {
          title: 'Rawah Ana (Podcast & Talent)',
          body: 'A two-headed track: a podcast where guests speak in the present “I” (professional/skill/civic focus), and a talent lane to surface unique gifts with production and promotion.',
          meta: ['Podcast', 'Talent Studio', 'Responsible Voice'],
        },
      ],
    },
    conclusion: {
      title: "Let's Go — Gaza Go",
      body:
        "Let’s gather what remains of our love, and dissolve within us the love of the self. If the present separates us, memories will bring us back together… Let’s Go.",
    },
    ctas: {
      contact: 'Contact Us',
      donate: 'Support us',
    },
  },
  ar: {
    metaTitle: 'من نحن — Gaza Go',
    metaDesc:
      "غزة غو كيان اجتماعي/اقتصادي هجين ينتقل من الإغاثة إلى الازدهار المستدام بقيادة محلية. تعرّف على رؤيتنا وفلسفتنا وبنيتنا التشغيلية ونموذج الاستدامة وشراكاتنا وبرامجنا الثلاثة: خِدمة، Not Only، وكيان Ant's.",
    announcement: 'الناس. الكرامة. مستقبل مستدام.',
    toggleLabel: 'English',
    hero: {
      title: 'من نحن؟',
      sub: 'من الإغاثة إلى القدرة على الصمود: حوكمة شفافة، أولوية للشباب، وخدمات مجتمعية مدعومة بالإيراد.',
      primary: 'خارطة الطريق',
      secondary: 'الشفافية والحوكمة',
    },
    nav: {
      overview: 'نظرة عامة',
      vision: 'الرؤية',
      philosophy: 'الفلسفة',
      structure: 'الهيكل',
      sustainability: 'الاستدامة',
      partnerships: 'الشراكات',
      khedma: 'البرنامج: خدمة Go (خِدمة)',
      notOnly: 'البرنامج: لو Not Only',
      ants: "البرنامج: كيان Ant's",
      conclusion: 'الخاتمة',
    },
    overview: {
      title: 'نظرة عامة',
      body:
        'تعمل Gaza Go على مسارين: مشروعات ربحية مستدامة وخدمات مجتمعية عالية الثقة. في هذه الصفحة نستعرض الرؤية والفلسفة والهيكل ونموذج الاستدامة والشراكات الدولية وبرامج التنفيذ الثلاثة التي تُولِّد وظائف وتثبّت الأساسيات وتُعلي السرد بكرامة.',
    },
    vision: {
      title: 'رؤية Gaza Go',
      body:
        'غزة غو ليست مجرد مشروع اقتصادي أو إعلامي؛ بل هي منظومة تنموية إنسانية تنبض من قلب التجربة الفلسطينية. رؤيتنا أن يتحول الدعم إلى شراكة، والمعاناة إلى إنتاج، والفكرة إلى فعل.',
    },
    philosophy: {
      title: 'وُلدنا من العدم',
      body:
        'من العدم وُلدنا، ومن الرماد نصنع الضوء. تُجسِّد هذه العبارة روح المشروع: تحويل الفراغ إلى بداية، واليأس إلى طاقة بنّاءة.',
    },
    structure: {
      title: 'الهيكل الإداري والتشغيلي',
      body:
        'لكل برنامج قيادة تشغيلية متخصصة، بينما تتولى القيادة المركزية توحيد الرؤية والتخطيط وتكامل الموارد — بما يوازن بين المرونة ووضوح المسؤولية.',
    },
    sustainability: {
      title: 'الاستدامة والتمويل الذاتي',
      body:
        'يعتمد Gaza Go على تكامل إنتاجي؛ إذ تُموِّل أرباح المشاريع الخدمية المحتوى والتدريب، بهدف الوصول إلى استقلال مالي متوسط الأجل.',
    },
    partnerships: {
      title: 'الشراكات الدولية',
      body:
        'نسعى إلى شراكات مع الصين ودبي والعالم، لخلق جسور إنتاج وتسويق ومنتجات تحمل روح فلسطين إلى الأسواق العالمية وتعزز الصمود الثقافي والاقتصادي.',
    },
    khedma: {
      badge: 'الخدمة والمشروعات',
      title: 'خدمة Go (خِدمة): مشروعات مجتمعية مستدامة',
      intro:
        'حافظة مشروعات محترفة بروح خدمية واستدامة في الجوهر — تُطرح عبر ثلاث منصات اختصاصية.',
      tracksTitle: 'المنصات الاختصاصية',
      tracks: [
        {
          title: 'خِدمة للمخبوزات',
          body:
            'فرن للخبز البلدي والمعجنات يعتمد على الأيدي العاملة بنسبة 100%، يوفّر نحو 15–20 فرصة عمل مستدامة مع أولوية للشباب والنساء، وقابل للزيادة مع نمو المشروع.',
          meta: ['15–20 وظيفة مبدئياً', 'نموذج قائم على العمل', 'خبز بلدي ومعجّنات'],
        },
        {
          title: 'خِدمة للتسوّق (مُثبّت الأسعار)',
          body:
            'خدمة لتقديم السلع الأساسية بأسعار مستقرة وجودة جيدة، مع آلية لكبح تذبذب الأسعار عبر كثافة المخزون؛ بما يحدّ من الاحتكار والقفزات السعرية. يستهدف 30–50 فرصة عمل.',
          meta: ['نظام ثبات الأسعار', '30–50 وظيفة', 'تصميم مضاد للاحتكار'],
        },
        {
          title: 'خِدمة للرعاية (شراكات مجتمعية)',
          body:
            'تشبيك مع مقدّمي الخدمات في القطاعات العامة والخاصة وفق قاعدة "الكل يكسب" — مقدم الخدمة والمتلقي والوسيط. سنطرح باقات تشبيكية موسمية.',
          meta: ['تشبيك عام/خاص', 'وساطة خدمات', 'باقات موسمية'],
        },
      ],
    },
    notOnly: {
      badge: 'السرد والثقافة',
      title: 'لو Not Only — الموسم الأول',
      intro:
        'خط تحريري رمزي يُظهر الجانب غير المرئي من التجربة المعيشة — عبر ثلاث منصات.',
      items: [
        {
          title: 'Not Only Number',
          body: 'توثيق مرئي لعائلات مُحيت من السجل المدني أو لم يبق منها سوى فرد واحد — لإعادة الأسماء والسياق خلف الأرقام.',
        },
        {
          title: 'Not Only Stone',
          body: 'سرديات عائلات تحوّلت بيوتها إلى قبور فعليّة بسبب الانهيار واستحالة الانتشال الآمن — بأقصى درجات الكرامة.',
        },
        {
          title: 'Not Only Flower',
          body: 'بورتريهات لمن استُشهدوا أثناء محاولتهم الحصول على المساعدات — وكان أغلبهم في "عمر الورود" — تكريماً لكرامتهم وحقوقهم.',
        },
      ],
    },
    ants: {
      badge: 'القدرات والمواهب',
      title: "كيان Ant's: انضباط، تشابك، إنجاز",
      intro:
        'نحاكي أسلوب عمل النمل: فرق اختصاصية، وشبكات جاهزية دائمة، ومضمار لإبراز المواهب بدعم وإنتاج وترويج.',
      items: [
        {
          title: 'Momken ممكن (فرق اختصاصية)',
          body: 'تكوين فرق قانونية/لوجستية/تقنية تُرفَد مباشرة في مشروعات الأولوية، ثم إلى احتياجات سوق العمل الأوسع.',
          meta: ['قانونية', 'لوجستية', 'تقنية'],
        },
        {
          title: 'Eejabyon إيجابيون (ألتراس مدني)',
          body: 'شبكة تفاعلية عالية الجاهزية للدعم والتحشيد والمناصرة — ألتراس افتراضي دائم.',
          meta: ['تحشيد', 'مناصرة', 'مشاركة مستدامة'],
        },
        {
          title: 'Rawah Ana رواه أنا (بودكاست & مواهب)',
          body: 'مسار برأسين: بودكاست يتحدث فيه الضيوف بصيغة الحاضر "أنا" (مهنية/مهارية/وطنية)، ومسار لإبراز المواهب مع دعم إنتاجي وترويجي.',
          meta: ['بودكاست', 'استوديو مواهب', 'صوت مسؤول'],
        },
      ],
    },
    conclusion: {
      title: 'يلا — Gaza Go',
      body:
        'يلا نلملم في محبتنا، ونلغي فينا حب الذات؛ إن فرّقنا الحاضر، ستجمعنا الذكريات… هيا بنا.',
    },
    ctas: {
      contact: 'تواصل معنا',
      donate: 'ادعمنا',
    },
  },
} as const;

type Lang = keyof typeof t;

/** Icons (inline SVG) — to match donate page button */
function IconGlobe() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
    </svg>
  );
}

/** Direction helpers (scoped, not global, so navbar/footer unaffected) */
function useDir(lang: Lang) {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const align = lang === 'ar' ? 'text-right' : 'text-left';
  return { dir, align } as const;
}

// Brand/highlight classes
const HIGHLIGHT_TEXT = 'text-neutral-900';
const BRAND = '#007A3D';
const BRAND_BG_10 = 'rgba(0,122,61,0.10)';
const BRAND_BORDER_20 = 'rgba(0,122,61,0.20)';

/** Section primitives — RTL-aware with anchorable titles */
function AnchorTitle({ id, children, rtl }: { id: string; children: React.ReactNode; rtl?: boolean }) {
  return (
    <a href={`#${id}`} className={`group inline-flex items-baseline gap-2 ${rtl ? 'flex-row-reverse' : ''}`} aria-label={`Jump to ${id}`}>
      <span
        className={
          `relative ${HIGHLIGHT_TEXT} text-3xl md:text-4xl font-extrabold tracking-tight inline-block`
        }
        style={{
          backgroundImage: `linear-gradient(${rtl ? 'to left' : 'to right'}, rgba(0,122,61,0.14), rgba(0,122,61,0.0))`,
          paddingInline: '0.25rem',
          borderRadius: '0.5rem',
        }}
      >
        {children}
      </span>
      <span className="opacity-0 group-hover:opacity-100 transition text-sm" style={{ color: BRAND }}>#</span>
    </a>
  );
}

function SectionHeader({ label, title, id, rtl, subtitle }: { label?: string; title: string; id: string; rtl?: boolean; subtitle?: string }) {
  return (
    <div className={`flex flex-col gap-2 ${rtl ? 'text-right' : 'text-left'}`}>
      {label ? (
        <span className="inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
          style={{ backgroundColor: BRAND_BG_10, color: BRAND, border: `1px solid ${BRAND_BORDER_20}` }} >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 2l3 7h7l-5.5 4 2.5 7-7-4.5L5.5 20 8 13 2 9h7l3-7z" />
          </svg>
          {label}
        </span>
      ) : null}
      <AnchorTitle id={id} rtl={rtl}>{title}</AnchorTitle>
      {subtitle ? <p className={`text-neutral-600 ${rtl ? 'text-right' : ''}`}>{subtitle}</p> : null}
    </div>
  );
}

function Section({ id, rtl, children, className }: { id: string; rtl?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={`scroll-mt-28 pt-10 mt-10 border-t border-neutral-200 ${rtl ? 'text-right' : ''} ${className || ''}`} dir={rtl ? 'rtl' : 'ltr'}>
      {children}
    </section>
  );
}

function TrackCard({
  title, body, meta, rtl, logo,
}: { title: string; body: string; meta?: string[]; rtl?: boolean; logo?: string }) {
  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm hover:shadow-md transition">
      <div className="flex items-start justify-between gap-5">
        <div className="flex-1">
          <div className="flex items-center gap-5">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo}
                alt={`${title} logo`}
                loading="eager"
                className="h-20 w-20 md:h-24 md:w-24 rounded-2xl object-contain ring-1 ring-neutral-200 bg-white p-2"
              />
            ) : null}
            <div className="font-extrabold text-xl md:text-2xl">{title}</div>
          </div>
          <p className={`mt-4 text-base md:text-lg leading-relaxed text-neutral-700 ${rtl ? 'text-right' : ''}`}>
            {body}
          </p>
        </div>
        <div className="shrink-0">
          <div className="h-12 w-12 rounded-2xl bg-[#007A3D]/10 text-[#007A3D] flex items-center justify-center" aria-hidden>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M20 6l-11 11-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </div>
      {!!meta?.length && (
        <div className={`mt-5 flex flex-wrap gap-2.5 ${rtl ? 'justify-end' : ''}`}>
          {meta.map((m) => (
            <span key={m} className="inline-flex items-center rounded-full border px-3 py-1.5 text-sm text-neutral-700 bg-white">
              {m}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** The page */
export default function AboutPage() {
  const [lang, setLang] = React.useState<Lang>('ar'); // default Arabic if you want
  const dict = t[lang];
  const { dir, align } = useDir(lang);
  const rtl = dir === 'rtl';

  // Local logo map — ensure these files exist under /public/images
  const logos = {
    khedmaMarket: '/images/khidma_market.png',
    khedmaCare: '/images/khidma_care.png',
    khidmaBakery: '/images/khidma_bakery.png',
    khidmaBrand: '/images/khidma.png',
    momken: '/images/Momken.png',
    eejabeyon: '/images/Ejabeyon.png',
    rawahAna: '/images/Rawah_Ana_right.png',
    notOnlyMain: '/images/not-only.png',
    notOnlyNumber: '/images/not-only-number.png',
    notOnlyStone: '/images/not-only-ston.png',
    notOnlyFlower: '/images/not-only-flower.png',
    antsKayan: '/images/ants.png',
  } as const;

  return (
    <Layout announcement={dict.announcement}>
      <Head>
        <title>{dict.metaTitle}</title>
        <meta name="description" content={dict.metaDesc} />
      </Head>

      {/* Language toggle UNDER navbar — same UX as donate page */}
      <div className="container mx-auto px-4 pt-4">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => setLang(prev => (prev === 'en' ? 'ar' : 'en'))}
            className="inline-flex items-center gap-2 rounded-xl bg-white ring-1 ring-neutral-200 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50"
            aria-label={lang === 'en' ? 'التبديل إلى العربية' : 'Switch to English'}
          >
            <IconGlobe />
            <span>{dict.toggleLabel}</span>
          </button>
        </div>
      </div>

      {/* Page content — scoped direction so navbar/footer stay as-is */}
      <main dir={dir} className={`${align}`}>
        <div className="max-w-6xl mx-auto px-6 py-6 md:py-10">
          {/* Hero */}
          <Hero
            headline={dict.hero.title}
            subheadline={dict.hero.sub}
            ctaPrimary={{ label: dict.hero.primary, href: '#overview' }}
            ctaSecondary={{ label: dict.hero.secondary, href: '/transparency' }}
            backgroundImage="/images/cover-about.jpg"
          />

          {/* Navigation chips (sticky) */}
          <div className={`mt-6 sticky top-3 z-30 ${rtl ? 'text-right' : ''}`}>
            <div className={`inline-flex flex-wrap gap-2 ${rtl ? 'justify-end' : ''}`}>
              <a href="#overview" className="rounded-full px-3 py-1.5 text-sm border bg-white hover:bg-neutral-50">{dict.nav.overview}</a>
              <a href="#vision" className="rounded-full px-3 py-1.5 text-sm border bg-white hover:bg-neutral-50">{dict.nav.vision}</a>
              <a href="#philosophy" className="rounded-full px-3 py-1.5 text-sm border bg-white hover:bg-neutral-50">{dict.nav.philosophy}</a>
              <a href="#structure" className="rounded-full px-3 py-1.5 text-sm border bg-white hover:bg-neutral-50">{dict.nav.structure}</a>
              <a href="#sustainability" className="rounded-full px-3 py-1.5 text-sm border bg-white hover:bg-neutral-50">{dict.nav.sustainability}</a>
              <a href="#partnerships" className="rounded-full px-3 py-1.5 text-sm border bg-white hover:bg-neutral-50">{dict.nav.partnerships}</a>
              <a href="#khedma" className="rounded-full px-3 py-1.5 text-sm border bg-white hover:bg-neutral-50">{dict.nav.khedma}</a>
              <a href="#notonly" className="rounded-full px-3 py-1.5 text-sm border bg-white hover:bg-neutral-50">{dict.nav.notOnly}</a>
              <a href="#ants" className="rounded-full px-3 py-1.5 text-sm border bg-white hover:bg-neutral-50">{dict.nav.ants}</a>
              <a href="#conclusion" className="rounded-full px-3 py-1.5 text-sm border bg-white hover:bg-neutral-50">{dict.nav.conclusion}</a>
            </div>
          </div>

          {/* Overview */}
          <Section id="overview" rtl={rtl}>
            <SectionHeader id="overview" title={dict.overview.title} rtl={rtl} />
            <p className="mt-3 text-neutral-700 leading-relaxed max-w-3xl">{dict.overview.body}</p>
          </Section>

          {/* Vision */}
          <Section id="vision" rtl={rtl}>
            <SectionHeader id="vision" title={dict.vision.title} rtl={rtl} />
            <p className="mt-3 text-neutral-700 leading-relaxed max-w-3xl">{dict.vision.body}</p>
          </Section>

          {/* Philosophy */}
          <Section id="philosophy" rtl={rtl}>
            <SectionHeader id="philosophy" title={dict.philosophy.title} rtl={rtl} />
            <p className="mt-3 text-neutral-700 leading-relaxed max-w-3xl">{dict.philosophy.body}</p>
          </Section>

          {/* Structure */}
          <Section id="structure" rtl={rtl}>
            <SectionHeader id="structure" title={dict.structure.title} rtl={rtl} />
            <p className="mt-3 text-neutral-700 leading-relaxed max-w-3xl">{dict.structure.body}</p>
          </Section>

          {/* Sustainability */}
          <Section id="sustainability" rtl={rtl}>
            <SectionHeader id="sustainability" title={dict.sustainability.title} rtl={rtl} />
            <p className="mt-3 text-neutral-700 leading-relaxed max-w-3xl">{dict.sustainability.body}</p>
          </Section>

          {/* Partnerships */}
          <Section id="partnerships" rtl={rtl}>
            <SectionHeader id="partnerships" title={dict.partnerships.title} rtl={rtl} />
            <p className="mt-3 text-neutral-700 leading-relaxed max-w-3xl">{dict.partnerships.body}</p>
          </Section>

          {/* Khedma / Service Go */}
          <Section id="khedma" rtl={rtl}>
            <div className={`flex items-center justify-between ${rtl ? 'flex-row-reverse' : ''}`}>
              <SectionHeader id="khedma" label={dict.khedma.badge} title={dict.khedma.title} rtl={rtl} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logos.khidmaBrand}
                alt="Khidma"
                className="h-16 md:h-20 w-auto rounded-md ring-1 ring-neutral-200 bg-white p-2"
              />
            </div>
            <p className="mt-3 text-neutral-700 leading-relaxed max-w-3xl">{dict.khedma.intro}</p>

            <div className="mt-6">
              <div className="text-sm font-semibold text-neutral-600 mb-3">{dict.khedma.tracksTitle}</div>
              <div className="grid sm:grid-cols-2 gap-4">
                <TrackCard
                  key={(dict.khedma.tracks[0] as any).title}
                  title={(dict.khedma.tracks[0] as any).title}
                  body={(dict.khedma.tracks[0] as any).body}
                  meta={(dict.khedma.tracks[0] as any).meta}
                  rtl={rtl}
                  logo={logos.khidmaBakery}
                />
                <TrackCard
                  key={(dict.khedma.tracks[1] as any).title}
                  title={(dict.khedma.tracks[1] as any).title}
                  body={(dict.khedma.tracks[1] as any).body}
                  meta={(dict.khedma.tracks[1] as any).meta}
                  rtl={rtl}
                  logo={logos.khedmaMarket}
                />
                <TrackCard
                  key={(dict.khedma.tracks[2] as any).title}
                  title={(dict.khedma.tracks[2] as any).title}
                  body={(dict.khedma.tracks[2] as any).body}
                  meta={(dict.khedma.tracks[2] as any).meta}
                  rtl={rtl}
                  logo={logos.khedmaCare}
                />
              </div>
            </div>
          </Section>

          {/* Not Only */}
          <Section id="notonly" rtl={rtl}>
            <div className={`flex items-center justify-between ${rtl ? 'flex-row-reverse' : ''}`}>
              <SectionHeader id="notonly" label={dict.notOnly.badge} title={dict.notOnly.title} rtl={rtl} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logos.notOnlyMain}
                alt="Not Only"
                className="h-16 md:h-20 w-auto rounded-md ring-1 ring-neutral-200 bg-white p-2"
              />
            </div>
            <p className="mt-3 text-neutral-700 leading-relaxed max-w-3xl">{dict.notOnly.intro}</p>

            <div className="mt-6 grid sm:grid-cols-3 gap-4">
              <TrackCard title={dict.notOnly.items[0].title} body={dict.notOnly.items[0].body} rtl={rtl} logo={logos.notOnlyNumber} />
              <TrackCard title={dict.notOnly.items[1].title} body={dict.notOnly.items[1].body} rtl={rtl} logo={logos.notOnlyStone} />
              <TrackCard title={dict.notOnly.items[2].title} body={dict.notOnly.items[2].body} rtl={rtl} logo={logos.notOnlyFlower} />
            </div>
          </Section>

          {/* Ants */}
          <Section id="ants" rtl={rtl}>
            <div className={`flex items-center justify-between ${rtl ? 'flex-row-reverse' : ''}`}>
              <SectionHeader id="ants" label={dict.ants.badge} title={dict.ants.title} rtl={rtl} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logos.antsKayan} alt="Ant's Kayan" className="h-16 w-auto rounded-md ring-1 ring-neutral-200 bg-white" />
            </div>
            <p className="mt-3 text-neutral-700 leading-relaxed max-w-3xl">{dict.ants.intro}</p>

            <div className="mt-6 grid sm:grid-cols-3 gap-4">
              <TrackCard
                key={(dict.ants.items[0] as any).title}
                title={(dict.ants.items[0] as any).title}
                body={(dict.ants.items[0] as any).body}
                meta={(dict.ants.items[0] as any).meta}
                rtl={rtl}
                logo={logos.momken}
              />
              <TrackCard
                key={(dict.ants.items[1] as any).title}
                title={(dict.ants.items[1] as any).title}
                body={(dict.ants.items[1] as any).body}
                meta={(dict.ants.items[1] as any).meta}
                rtl={rtl}
                logo={logos.eejabeyon}
              />
              <TrackCard
                key={(dict.ants.items[2] as any).title}
                title={(dict.ants.items[2] as any).title}
                body={(dict.ants.items[2] as any).body}
                meta={(dict.ants.items[2] as any).meta}
                rtl={rtl}
                logo={logos.rawahAna}
              />
            </div>
          </Section>

          {/* Conclusion */}
          <Section id="conclusion" rtl={rtl}>
            <SectionHeader id="conclusion" title={dict.conclusion.title} rtl={rtl} />
            <p className="mt-3 text-neutral-700 leading-relaxed max-w-3xl">{dict.conclusion.body}</p>
          </Section>

          {/* CTAs */}
          <div className={`mt-12 flex flex-wrap gap-3 ${rtl ? 'justify-end' : ''}`}>
            <Link href="/contact" className="rounded-full bg-[#007A3D] px-5 py-2.5 font-semibold text-white hover:bg-[#026b35]">{dict.ctas.contact}</Link>
            <Link href="/donate" className="rounded-full bg-[#CE1126] px-5 py-2.5 font-semibold text-white hover:bg-[#b10e20]">{dict.ctas.donate}</Link>
          </div>
        </div>
      </main>
    </Layout>
  );
}
