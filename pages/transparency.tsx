// pages/transparency.tsx
import Head from 'next/head';
import dynamic from 'next/dynamic';
import React from 'react';
import Link from 'next/link';

/** Dynamic-safe imports (مطابقة لأسلوب about.tsx) */
function pickComponent(mod: unknown, keys: string[]) {
  for (const k of keys) {
    const c = (mod as any)?.[k];
    if (typeof c === 'function') return c;
  }
  return null;
}

const Layout = dynamic(async () => {
  const mod = await import('../components/Layout').catch(() => ({} as unknown));
  return pickComponent(mod, ['default', 'Layout']) as any;
}, { ssr: true });

const Button = dynamic(async () => {
  const mod = await import('../components/Button').catch(() => ({} as unknown));
  return pickComponent(mod, ['default', 'Button']) as any;
}, { ssr: false });

/* ------------------------------------ */
/* Helpers + tiny UI atoms (local only) */
/* ------------------------------------ */

function SectionHeader({ label, title, id, rtl }: { label?: string; title: string; id?: string; rtl?: boolean }) {
  return (
    <div id={id} className={`flex flex-col gap-2 ${rtl ? 'text-right' : 'text-left'}`}>
      {label ? (
        <span className="inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold bg-[#007A3D]/10 text-[#007A3D] ring-1 ring-[#007A3D]/20">
          {label}
        </span>
      ) : null}
      <h2 className="text-2xl md:text-3xl font-black">{title}</h2>
    </div>
  );
}

function Bullet({ children, rtl }: { children: React.ReactNode; rtl?: boolean }) {
  return (
    <li className={`relative pl-4 ${rtl ? 'pl-0 pr-4' : ''}`}>
      <span className={`absolute top-2 h-1.5 w-1.5 rounded-full bg-[#007A3D] ${rtl ? 'right-0' : 'left-0'}`} />
      <span className="text-neutral-800">{children}</span>
    </li>
  );
}

function TwoCol({ left, right, rtl }: { left: React.ReactNode; right: React.ReactNode; rtl?: boolean }) {
  return (
    <div className={`grid gap-6 md:grid-cols-2 ${rtl ? 'text-right' : ''}`} dir={rtl ? 'rtl' : 'ltr'}>
      <div>{left}</div>
      <div>{right}</div>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs bg-white">{children}</span>;
}

/* ---------------------- */
/* Bilingual dictionary   */
/* ---------------------- */

const t = {
  en: {
    metaTitle: 'Transparency & Governance — Gaza Go',
    metaDesc:
      'Full-stack transparency & governance across Gaza Go: policies, roles, reporting cadence, per-program controls and KPIs.',
    toggle: 'العربية',
    hero: {
      title: 'Transparency & Governance',
      sub: 'Auditable by design: clear committees, documented policies, ring-fenced funds, and public reporting across every program.',
      cta: { label: 'Read About Us', href: '/about' },
    },
    nav: {
      overview: 'Overview',
      global: 'Global Principles & Structure',
      khidma: 'Khidma (Bakery • Market • Care)',
      notonly: 'Not Only (Number • Stone • Flower)',
      ants: "Ant's (Momken • Eejabyon • Rawah Ana)",
      reports: 'Reports & Disclosures',
    },
    global: {
      badge: 'Foundation',
      title: 'Principles & Structure',
      principles: [
        'Dignity, accountability, local ownership, youth-first, non-sectarian, do-no-harm.',
        'Zero tolerance for fraud, exploitation, or abuse; protected reporting channels.',
      ],
      structure: [
        'Board committees: Audit & Risk; Ethics & Safeguarding; Investment; Programs & Impact.',
        'Executive: CEO/COO/CFO/CPO/CCO; program leads own delivery; central team owns controls.',
      ],
      policies: [
        'Anti-corruption & AML/CFT, conflicts of interest, procurement, data protection (GDPR-aligned).',
        'Safeguarding (children & vulnerable adults), media consent, whistleblowing, code of conduct.',
      ],
      cadence: [
        'Quarterly public reports; annual independent audit.',
        'Open budget lines for community services + anonymised case verification.',
      ],
    },
    khidma: {
      badge: 'Service & Ventures',
      title: 'Khidma — Governance by Track',
      tracks: {
        bakery: {
          title: 'Bakery (Community Bakery)',
          g: [
            'Cash handling: dual-signature shift recon; daily bank-in; bread-subsidy ledger.',
            'Price policy: fair-price cap indexed to flour & fuel inputs; weekly review.',
          ],
          t: [
            'POS exports + subsidy sheet published monthly.',
            'KPIs: loaves/day, unit cost, wage share %, jobs sustained, complaints resolved.',
          ],
          controls: ['Stock counts (AM/PM), loss ≤1.5%', 'Safety SOP + PPE log', 'Supplier due-diligence (KYC/AML)'],
        },
        market: {
          title: 'Market (Fair-Price Store)',
          g: [
            'Inventory density mechanism to dampen volatility; anti-hoarding thresholds.',
            'Procurement panel with 3-quote rule and COI declarations.',
          ],
          t: [
            'Open price list + margin bands; monthly basket index.',
            'KPIs: basket price vs city median, stock-outs, jobs, beneficiary NPS.',
          ],
          controls: ['Batch/expiry tracking', 'Daily cash variance ≤0.3%', 'Vendor scorecards (quality • reliability • price)'],
        },
        care: {
          title: 'Care (Service Networking)',
          g: [
            'Tripartite contracts (provider-beneficiary-Khidma) with “everyone wins” clause.',
            'Safeguarding screening for partners; grievance redress system.',
          ],
          t: [
            'Published package specs + eligibility rules.',
            'KPIs: people served, SLA compliance, cost per case, escalation resolution time.',
          ],
          controls: ['Consent records & privacy by design', 'Random case audits (5%/month)'],
        },
      },
    },
    notonly: {
      badge: 'Narrative & Rights',
      title: 'Not Only — Editorial Governance',
      lanes: {
        number: {
          title: 'Number',
          g: [
            'Ethics board review for every episode; trauma-informed interviewing.',
            'Identity protection by default for minors and sensitive cases.',
          ],
          t: [
            'Source list with hashed IDs; consent forms; redaction log.',
            'KPIs: episodes published, verified cases, audience reach, referrals to aid.',
          ],
          controls: ['Chain-of-custody for media', 'Geo-safety checks before field work'],
        },
        stone: {
          title: 'Stone',
          g: [
            'Dignity-first portrayal; no graphic content; family liaison mandatory.',
            'Verification with satellite/OSINT when feasible.',
          ],
          t: [
            'Case Dossier (dates, witnesses, location) with anonymised IDs.',
            'KPIs: verified stories, support pathways triggered, safety incidents = 0.',
          ],
          controls: ['Legal review pre-publish', 'Risk assessment matrix attached to each story'],
        },
        flower: {
          title: 'Flower',
          g: [
            'Victim-support protocol (psychosocial, scholarship, or productive sponsorship).',
            'Guardian consent and post-publication follow-up.',
          ],
          t: [
            'Public pledge tracker per case.',
            'KPIs: funds routed to support tracks, follow-ups completed, well-being checks.',
          ],
          controls: ['Do-no-harm checklist signed', 'Community representative sign-off'],
        },
      },
    },
    ants: {
      badge: 'Capacity',
      title: "Ant’s (Kayan) — Teams & Safeguards",
      squads: {
        momken: {
          title: 'Momken (Specialist Squads)',
          g: ['Skills vetting & code of conduct', 'Conflict-of-interest declarations per assignment'],
          t: ['Published TORs; delivery logs; mentor feedback', 'KPIs: deployments, task completion SLA, placements'],
          controls: ['Access control (least privilege)', 'Data handling SOP'],
        },
        eejabyon: {
          title: 'Eejabyon (Civic Ultras)',
          g: ['Moderation charter; anti-harassment rules; rapid de-escalation playbook'],
          t: ['Participation metrics and action logs', 'KPIs: mobilisations, reach, safety incidents = 0'],
          controls: ['Channel audits', 'Two-admin rule for announcements'],
        },
        rawah: {
          title: 'Rawah Ana (Podcast & Talent)',
          g: ['Guest consent; brand safety; rights management'],
          t: ['Release forms + content log', 'KPIs: episodes, talent showcases, opportunities created'],
          controls: ['Music/asset licensing checks', 'Archival & backup policy'],
        },
      },
    },
    reports: {
      title: 'Public Reports & Disclosures',
      note:
        'Quarterly roll-ups and annual audited statements will be posted here. Until then, contact us for supporting documents and raw exports.',
      ctaPrimary: 'Open Reports',
      ctaSecondary: 'Contact Us',
    },
  },

  ar: {
    metaTitle: 'الشفافية والحوكمة — Gaza Go',
    metaDesc:
      'حوكمة وشفافية كاملة عبر Gaza Go: السياسات، الأدوار، دورية التقارير، وضوابط كل برنامج مع مؤشرات أداء.',
    toggle: 'English',
    hero: {
      title: 'الشفافية والحوكمة',
      sub: 'تصميم قابل للتدقيق: لجان واضحة، سياسات موثّقة، صناديق محمية، وتقارير علنية لكل برنامج.',
      cta: { label: 'من نحن', href: '/about' },
    },
    nav: {
      overview: 'نظرة عامة',
      global: 'المبادئ والهيكل العام',
      khidma: 'خِدمة (المخبز • السوق • الرعاية)',
      notonly: 'Not Only (رقم • حجر • زهرة)',
      ants: 'كيان Ant’s (ممكن • إيجابيون • رواه أنا)',
      reports: 'التقارير والإفصاحات',
    },
    global: {
      badge: 'الأساس',
      title: 'المبادئ والهيكل',
      principles: [
        'الكرامة، المساءلة، الملكية المحلية، أولوية الشباب، اللّاإقصائية، وعدم الإضرار.',
        'عدم التسامح مع الاحتيال أو الاستغلال أو الإساءة؛ قنوات إبلاغ آمنة.',
      ],
      structure: [
        'لجان المجلس: التدقيق والمخاطر؛ الأخلاقيات والحماية؛ الاستثمار؛ البرامج والأثر.',
        'تنفيذي: مدير عام/تشغيل/مالي/برامج/اتصال؛ قيادات البرامج للتنفيذ والفريق المركزي للضوابط.',
      ],
      policies: [
        'مكافحة الفساد وغسل الأموال وتمويل الإرهاب، تضارب المصالح، المشتريات، حماية البيانات (متوائم مع GDPR).',
        'الحماية (الأطفال والفئات الضعيفة)، موافقات النشر، الإبلاغ الآمن، ميثاق السلوك.',
      ],
      cadence: [
        'تقارير ربع سنوية علنية؛ تدقيق سنوي مستقل.',
        'بنود ميزانية مفتوحة للخدمات وتوثيق الحالات بمعرّفات مُجهّلة.',
      ],
    },
    khidma: {
      badge: 'الخدمة والمشروعات',
      title: 'خِدمة — حوكمة على مستوى المسارات',
      tracks: {
        bakery: {
          title: 'المخبز (خبز مجتمعي)',
          g: [
            'إدارة النقد: جرد بنظام توقيعين لكل وردية؛ توريد يومي؛ سجل دعم الرغيف.',
            'سياسة تسعير عادل مربوطة بتكلفة الدقيق والوقود؛ مراجعة أسبوعية.',
          ],
          t: [
            'نُشر مخرجات نقاط البيع + ورقة الدعم شهريًا.',
            'المؤشرات: أرغفة/اليوم، تكلفة الوحدة، نسبة الأجور، الوظائف المستدامة، الشكاوى المعالجة.',
          ],
          controls: ['جرد صباحي/مسائي (فاقد ≤ 1.5%)', 'SOP سلامة + سجل معدات الوقاية', 'تحقق موردين (KYC/AML)'],
        },
        market: {
          title: 'السوق (مثبّت الأسعار)',
          g: [
            'آلية كثافة المخزون لتخفيف التذبذب؛ حدود مانعة للتخزين الاحتكاري.',
            'لجنة مشتريات بقاعدة ثلاث عروض وتصاريح تضارب مصالح.',
          ],
          t: [
            'قائمة أسعار مفتوحة وهوامش ربح معلنة؛ مؤشر سلة شهري.',
            'المؤشرات: سعر السلة مقارنة بمتوسط المدينة، النواقص، الوظائف، رضا المستفيدين.',
          ],
          controls: ['تتبّع الدُفعات والصلاحيات', 'فرق النقد اليومي ≤ 0.3%', 'تقييمات الموردين (جودة • موثوقية • سعر)'],
        },
        care: {
          title: 'الرعاية (تشبيك خدمي)',
          g: [
            'عقود ثلاثية (مزود-مستفيد-خِدمة) ببند «الكل يكسب».',
            'فحص حماية للشركاء؛ آلية تظلّم فعّالة.',
          ],
          t: [
            'نشر مواصفات الباقات وقواعد الاستحقاق.',
            'المؤشرات: المستفيدون، الالتزام بالخدمة، تكلفة الحالة، زمن حلّ التصعيد.',
          ],
          controls: ['سجلات موافقات وخصوصية بالتصميم', 'تدقيق عشوائي 5% من الحالات شهريًا'],
        },
      },
    },
    notonly: {
      badge: 'السرد والحقوق',
      title: 'Not Only — حوكمة تحريرية',
      lanes: {
        number: {
          title: 'رقم',
          g: [
            'مراجعة لجنة الأخلاقيات لكل حلقة؛ مقابلات تراعي الصدمة.',
            'حماية الهوية تلقائيًا للقُصّر والحالات الحساسة.',
          ],
          t: [
            'سجل مصادر بمعرّفات مُجزّأة؛ نماذج موافقات؛ سجل اختزال/طمس.',
            'المؤشرات: حلقات منشورة، حالات موثقة، الوصول الجماهيري، الإحالات للدعم.',
          ],
          controls: ['سلسلة حيازة للمواد', 'فحوص أمان جغرافي قبل النزول للميدان'],
        },
        stone: {
          title: 'حجر',
          g: [
            'كرامة أولًا؛ بدون محتوى صادم؛ تنسيق أسري إلزامي.',
            'تحقّق بالأقمار الصناعية/المصادر المفتوحة عندما يكون ممكنًا.',
          ],
          t: [
            'ملف حالة (تواريخ، شهود، موقع) بمعرّفات مُجهّلة.',
            'المؤشرات: قصص موثقة، مسارات دعم مفعّلة، حوادث أمان = 0.',
          ],
          controls: ['مراجعة قانونية قبل النشر', 'مصفوفة تقييم مخاطر مرفقة بكل قصة'],
        },
        flower: {
          title: 'زهرة',
          g: [
            'بروتوكول دعم (نفسي/تعليمي/كفالة إنتاجية).',
            'موافقة وليّ الأمر والمتابعة بعد النشر.',
          ],
          t: [
            'مُتتبّع تعهّدات عام لكل حالة.',
            'المؤشرات: أموال محوّلة لمسارات الدعم، متابعات مكتملة، فحوص رفاه.',
          ],
          controls: ['قائمة «عدم الإضرار» موقّعة', 'اعتماد ممثل مجتمعي'],
        },
      },
    },
    ants: {
      badge: 'القدرات',
      title: 'كيان Ant’s — فرق وضوابط',
      squads: {
        momken: {
          title: 'ممكن (فرق اختصاص)',
          g: ['تحقق مهارات + ميثاق سلوك', 'تصاريح تضارب مصالح لكل تكليف'],
          t: ['نشر توصيف المهام وسجلات الإنجاز', 'المؤشرات: نشر الفرق، الالتزام بالمهلة، التوظيف'],
          controls: ['صلاحيات وصول دنيا', 'SOP للتعامل مع البيانات'],
        },
        eejabyon: {
          title: 'إيجابيون (ألتراس مدني)',
          g: ['ميثاق تنظيم؛ قواعد ضد الإساءة؛ كتيّب تهدئة سريعة'],
          t: ['قياس المشاركة وسجل التحركات', 'المؤشرات: تعبئات، وصول، حوادث أمان = 0'],
          controls: ['تدقيق قنوات دوري', 'قاعدة «مشرفان» للإعلانات'],
        },
        rawah: {
          title: 'رواه أنا (بودكاست ومواهب)',
          g: ['موافقة ضيوف؛ أمان العلامة؛ إدارة الحقوق'],
          t: ['نماذج إتاحة + سجل المحتوى', 'المؤشرات: حلقات، عروض مواهب، فرص مُولَّدة'],
          controls: ['فحص تراخيص الموسيقى/الأصول', 'سياسة أرشفة ونسخ احتياطي'],
        },
      },
    },
    reports: {
      title: 'التقارير والإفصاحات',
      note:
        'سيتم نشر التقارير الربع سنوية والبيانات المدققة سنويًا هنا. ولحين اكتمالها، تواصل معنا لطلب المستندات والتقارير الخام.',
      ctaPrimary: 'فتح التقارير',
      ctaSecondary: 'تواصل معنا',
    },
  },
} as const;

type Lang = keyof typeof t;

export default function TransparencyPage() {
  const [lang, setLang] = React.useState<Lang>('ar');
  const dict = t[lang];
  const rtl = lang === 'ar';

  const logos = {
    khidma: '/images/khidma.png',
    bakery: '/images/khidma_bakery.png',
    market: '/images/khidma_market.png',
    care: '/images/khidma_care.png',
    notOnly: '/images/not-only.png',
    number: '/images/not-only-number.png',
    stone: '/images/not-only-stone.png',
    flower: '/images/not-only-flower.png',
    ants: '/images/ants.png',
    momken: '/images/Momken.png',
    eejabyon: '/images/Ejabeyon.png',
    rawah: '/images/Rawah_Ana_right.png',
  } as const;

  return (
    <Layout announcement="">
      <Head>
        <title>{dict.metaTitle}</title>
        <meta name="description" content={dict.metaDesc} />
      </Head>

      {/* Language toggle */}
      <div className="fixed top-4 right-4 z-40">
        <button
          onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
          className="rounded-full bg-white/90 backdrop-blur px-3 py-1.5 text-sm font-semibold border shadow hover:bg-white"
          aria-label="Toggle language"
        >
          {dict.toggle}
        </button>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10 md:py-14">
        {/* Hero */}
        <div className={`relative rounded-2xl overflow-hidden ${rtl ? 'text-right' : ''}`} dir={rtl ? 'rtl' : 'ltr'}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/cover-transparency.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="relative px-6 py-16 md:py-20 text-white bg-black/40">
            <h1 className="text-3xl md:text-4xl font-black">{dict.hero.title}</h1>
            <p className="mt-2 max-w-3xl text-white/90">{dict.hero.sub}</p>
            <div className={`mt-5 flex flex-wrap gap-3 ${rtl ? 'justify-end' : ''}`}>
              <Link href={dict.hero.cta.href} className="rounded-full bg-[#007A3D] px-5 py-2.5 font-semibold text-white hover:bg-[#026b35]">
                {dict.hero.cta.label}
              </Link>
              <Link href="/contact" className="rounded-full bg-white/10 ring-1 ring-white/30 px-5 py-2.5 font-semibold text-white hover:bg-white/20">
                {lang === 'ar' ? 'تواصل معنا' : 'Contact Us'}
              </Link>
            </div>
          </div>
        </div>

        {/* Nav chips */}
        <div className={`mt-6 flex flex-wrap gap-2 ${rtl ? 'justify-end' : ''}`}>
          <a href="#global" className="rounded-full px-3 py-1.5 text-sm border bg-white hover:bg-neutral-50">{dict.nav.global}</a>
          <a href="#khidma" className="rounded-full px-3 py-1.5 text-sm border bg-white hover:bg-neutral-50">{dict.nav.khidma}</a>
          <a href="#notonly" className="rounded-full px-3 py-1.5 text-sm border bg-white hover:bg-neutral-50">{dict.nav.notonly}</a>
          <a href="#ants" className="rounded-full px-3 py-1.5 text-sm border bg-white hover:bg-neutral-50">{dict.nav.ants}</a>
          <a href="#reports" className="rounded-full px-3 py-1.5 text-sm border bg-white hover:bg-neutral-50">{dict.nav.reports}</a>
        </div>

        {/* Global */}
        <section id="global" className={`mt-10 ${rtl ? 'text-right' : ''}`} dir={rtl ? 'rtl' : 'ltr'}>
          <SectionHeader label={dict.global.badge} title={dict.global.title} />
          <TwoCol
            rtl={rtl}
            left={
              <div className="rounded-2xl border bg-white p-6 shadow-sm">
                <div className="font-semibold mb-2">{lang === 'ar' ? 'المبادئ' : 'Principles'}</div>
                <ul className="space-y-2">{dict.global.principles.map((x) => <Bullet key={x} rtl={rtl}>{x}</Bullet>)}</ul>
                <div className="font-semibold mt-5 mb-2">{lang === 'ar' ? 'السياسات' : 'Policies'}</div>
                <ul className="space-y-2">{dict.global.policies.map((x) => <Bullet key={x} rtl={rtl}>{x}</Bullet>)}</ul>
              </div>
            }
            right={
              <div className="rounded-2xl border bg-white p-6 shadow-sm">
                <div className="font-semibold mb-2">{lang === 'ar' ? 'الهيكل والأدوار' : 'Structure & Roles'}</div>
                <ul className="space-y-2">{dict.global.structure.map((x) => <Bullet key={x} rtl={rtl}>{x}</Bullet>)}</ul>
                <div className="font-semibold mt-5 mb-2">{lang === 'ar' ? 'دورية التقارير' : 'Reporting Cadence'}</div>
                <ul className="space-y-2">{dict.global.cadence.map((x) => <Bullet key={x} rtl={rtl}>{x}</Bullet>)}</ul>
              </div>
            }
          />
        </section>

        {/* KHIDMA */}
        <section id="khidma" className={`mt-12 ${rtl ? 'text-right' : ''}`} dir={rtl ? 'rtl' : 'ltr'}>
          <div className={`flex items-center justify-between ${rtl ? 'flex-row-reverse' : ''}`}>
            <SectionHeader label={dict.khidma.badge} title={dict.khidma.title} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logos.khidma} alt="Khidma" className="h-16 md:h-20 w-auto rounded-md ring-1 ring-neutral-200 bg-white p-2" />
          </div>

          {/* Tracks */}
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {(['bakery','market','care'] as const).map((k) => {
              const lane = (dict.khidma.tracks as any)[k];
              const logo = (logos as any)[k];
              return (
                <div key={k} className="rounded-2xl border bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logo} alt="" className="h-12 w-12 rounded-xl object-contain ring-1 ring-neutral-200 bg-white p-1" />
                    <div className="font-extrabold text-lg">{lane.title}</div>
                  </div>

                  <div className="mt-4 grid gap-4">
                    <div>
                      <div className="text-sm font-semibold">{lang==='ar'?'الحوكمة':'Governance'}</div>
                      <ul className="mt-1 space-y-2">{lane.g.map((x:string)=> <Bullet key={x} rtl={rtl}>{x}</Bullet>)}</ul>
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{lang==='ar'?'الشفافية والمؤشرات':'Transparency & KPIs'}</div>
                      <ul className="mt-1 space-y-2">{lane.t.map((x:string)=> <Bullet key={x} rtl={rtl}>{x}</Bullet>)}</ul>
                    </div>
                    {'controls' in lane && (
                      <div>
                        <div className="text-sm font-semibold">{lang==='ar'?'ضوابط التشغيل':'Operational Controls'}</div>
                        <ul className="mt-1 space-y-2">{(lane.controls as string[]).map((x)=> <Bullet key={x} rtl={rtl}>{x}</Bullet>)}</ul>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* NOT ONLY */}
        <section id="notonly" className={`mt-12 ${rtl ? 'text-right' : ''}`} dir={rtl ? 'rtl' : 'ltr'}>
          <div className={`flex items-center justify-between ${rtl ? 'flex-row-reverse' : ''}`}>
            <SectionHeader label={dict.notonly.badge} title={dict.notonly.title} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logos.notOnly} alt="Not Only" className="h-16 md:h-20 w-auto rounded-md ring-1 ring-neutral-200 bg-white p-2" />
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {(['number','stone','flower'] as const).map((k) => {
              const lane = (dict.notonly.lanes as any)[k];
              const logo = (logos as any)[k];
              return (
                <div key={k} className="rounded-2xl border bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logo} alt="" className="h-12 w-12 rounded-xl object-contain ring-1 ring-neutral-200 bg-white p-1" />
                    <div className="font-extrabold text-lg">{lane.title}</div>
                  </div>
                  <div className="mt-4 grid gap-4">
                    <div>
                      <div className="text-sm font-semibold">{lang==='ar'?'حوكمة التحرير':'Editorial Governance'}</div>
                      <ul className="mt-1 space-y-2">{lane.g.map((x:string)=> <Bullet key={x} rtl={rtl}>{x}</Bullet>)}</ul>
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{lang==='ar'?'الشفافية والمؤشرات':'Transparency & KPIs'}</div>
                      <ul className="mt-1 space-y-2">{lane.t.map((x:string)=> <Bullet key={x} rtl={rtl}>{x}</Bullet>)}</ul>
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{lang==='ar'?'ضوابط الأمان':'Safety Controls'}</div>
                      <ul className="mt-1 space-y-2">{lane.controls.map((x:string)=> <Bullet key={x} rtl={rtl}>{x}</Bullet>)}</ul>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ANTS */}
        <section id="ants" className={`mt-12 ${rtl ? 'text-right' : ''}`} dir={rtl ? 'rtl' : 'ltr'}>
          <div className={`flex items-center justify-between ${rtl ? 'flex-row-reverse' : ''}`}>
            <SectionHeader label={dict.ants.badge} title={dict.ants.title} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logos.ants} alt="Ants" className="h-16 md:h-20 w-auto rounded-md ring-1 ring-neutral-200 bg-white p-2" />
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {(['momken','eejabyon','rawah'] as const).map((k) => {
              const lane = (dict.ants.squads as any)[k];
              const logo = (logos as any)[k];
              return (
                <div key={k} className="rounded-2xl border bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logo} alt="" className="h-12 w-12 rounded-xl object-contain ring-1 ring-neutral-200 bg-white p-1" />
                    <div className="font-extrabold text-lg">{lane.title}</div>
                  </div>
                  <div className="mt-4 grid gap-4">
                    <div>
                      <div className="text-sm font-semibold">{lang==='ar'?'الحوكمة':'Governance'}</div>
                      <ul className="mt-1 space-y-2">{lane.g.map((x:string)=> <Bullet key={x} rtl={rtl}>{x}</Bullet>)}</ul>
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{lang==='ar'?'الشفافية والمؤشرات':'Transparency & KPIs'}</div>
                      <ul className="mt-1 space-y-2">{lane.t.map((x:string)=> <Bullet key={x} rtl={rtl}>{x}</Bullet>)}</ul>
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{lang==='ar'?'ضوابط التشغيل':'Operational Controls'}</div>
                      <ul className="mt-1 space-y-2">{lane.controls.map((x:string)=> <Bullet key={x} rtl={rtl}>{x}</Bullet>)}</ul>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Reports */}
        <section id="reports" className={`mt-12 ${rtl ? 'text-right' : ''}`} dir={rtl ? 'rtl' : 'ltr'}>
          <SectionHeader title={dict.reports.title} />
          <p className="mt-2 text-neutral-700">{dict.reports.note}</p>
          <div className={`mt-4 flex gap-3 ${rtl ? 'justify-end' : ''}`}>
            <Link href="/reports" className="rounded-xl bg-[#007A3D] text-white px-4 py-2 font-semibold hover:opacity-90">
              {dict.reports.ctaPrimary}
            </Link>
            <Link href="/contact" className="rounded-xl bg-white ring-1 ring-neutral-200 px-4 py-2 font-semibold hover:bg-neutral-50">
              {dict.reports.ctaSecondary}
            </Link>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Pill>{lang==='ar'?'تقرير ربع سنوي':'Quarterly Report'}</Pill>
            <Pill>{lang==='ar'?'تدقيق سنوي':'Annual Audit'}</Pill>
            <Pill>{lang==='ar'?'لوحة مؤشرات':'Impact Dashboard'}</Pill>
            <Pill>{lang==='ar'?'سياسة الخصوصية':'Privacy Policy'}</Pill>
          </div>
        </section>
      </div>
    </Layout>
  );
}
