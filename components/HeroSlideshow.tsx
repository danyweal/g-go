// Harmonized / Professional palette for PCA hero
// Base: slate (neutrals) | Primary: emerald | Accent (subtle, sparing): rose
// Notes:
// - Removed harsh multi‑color gradients; replaced with a clean emerald border
// - Unified dividers, dots, buttons, and panels to the same palette
// - Kept Arabic/English layout and accessibility attributes intact

import * as React from "react";

export type Slide = {
  src: string;
  alt: string;
  headline?: string | React.ReactNode;
  subtext?: string | React.ReactNode;
  headlineAr?: string | React.ReactNode;
  headlineEn?: string | React.ReactNode;
  subtextAr?: string | React.ReactNode;
  subtextEn?: string | React.ReactNode;
  icon?: string;
  cta?: { label: string | React.ReactNode; href: string; ariaLabel?: string };
};

export type HeroSlideshowProps = { slides: Slide[]; intervalMs?: number };

export default function HeroSlideshow(props: HeroSlideshowProps) {
  const { slides, intervalMs = 5000 } = props;
  const [i, setI] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const total = slides.length;

  // No slides => render nothing
  if (!total) return null;

  React.useEffect(() => {
    if (paused || total <= 1) return;
    const t = setInterval(() => setI((x) => (x + 1) % total), intervalMs);
    return () => clearInterval(t);
  }, [paused, total, intervalMs]);

  const go = (n: number) => setI(((n % total) + total) % total);

  const s = slides[i];

  const headlineAr = s.headlineAr ?? (typeof s.headline === "string" ? s.headline : null);
  const headlineEn = s.headlineEn ?? null;
  const subtextAr = s.subtextAr ?? (typeof s.subtext === "string" ? s.subtext : null);
  const subtextEn = s.subtextEn ?? null;

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      role="region"
      aria-label="Hero slideshow"
    >
      {/* Outer gradient frame + inner container (unified palette) */}
      <div className="rounded-2xl p-[1.5px] bg-[linear-gradient(135deg,#0a0a0a_0%,#0f5132_38%,#e5e7eb_58%,#7f1d1d_100%)] shadow-xl">
        <div className="relative rounded-2xl overflow-hidden bg-slate-900/70 backdrop-blur-xl ring-1 ring-white/10">
          {/* Grid: text (left) | divider | image (right) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-0 items-stretch relative">
            <div
              aria-hidden="true"
              className="hidden md:block absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[linear-gradient(180deg,rgba(255,255,255,0.22)_0%,rgba(15,81,50,0.5)_50%,rgba(127,29,29,0.45)_100%)]"
            />

            {/* Text column */}
            <div className="flex order-2 md:order-1">
              <div className="relative flex-1 bg-slate-900/60 p-6 md:p-8 md:pl-8 text-slate-50 shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
                {/* Icon pill */}
                {s.icon && (
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 mb-4">
                    <span aria-hidden="true" className="text-2xl">
                      {s.icon}
                    </span>
                    <span className="text-[11px] md:text-xs font-semibold tracking-[0.22em] uppercase text-slate-100/80">
                      Community
                    </span>
                  </div>
                )}

                {/* Arabic headline */}
                {(headlineAr || s.headline) && (
                  <h2
                    className="text-3xl md:text-5xl font-extrabold leading-tight text-emerald-300"
                    dir="rtl"
                    lang="ar"
                    style={{ textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}
                  >
                    {headlineAr ?? s.headline}
                  </h2>
                )}

                {/* English headline */}
                {headlineEn && (
                  <h3
                    className="mt-1 md:mt-2 text-xl md:text-3xl font-bold text-emerald-200"
                    dir="ltr"
                    lang="en"
                    style={{ textShadow: "0 2px 8px rgba(0,0,0,0.45)" }}
                  >
                    {headlineEn}
                  </h3>
                )}

                {/* Arabic text */}
                {subtextAr && (
                  <p
                    className="mt-4 text-base md:text-lg text-slate-100/95 leading-relaxed"
                    dir="rtl"
                    lang="ar"
                    style={{ textShadow: "0 1px 6px rgba(0,0,0,0.4)" }}
                  >
                    {subtextAr}
                  </p>
                )}

                {/* English text */}
                {subtextEn && (
                  <p
                    className="mt-2 text-sm md:text-base text-slate-100/90 leading-relaxed"
                    dir="ltr"
                    lang="en"
                    style={{ textShadow: "0 1px 5px rgba(0,0,0,0.35)" }}
                  >
                    {subtextEn}
                  </p>
                )}

                {/* CTA */}
                {s.cta && (
                  <div className="mt-5">
                    <a
                      href={s.cta.href}
                      aria-label={s.cta.ariaLabel ?? "Go to section"}
                      className="group inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-semibold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-600 ring-1 ring-emerald-400/40 shadow-[0_8px_30px_rgba(0,0,0,0.35)] transition"
                    >
                      <span>{s.cta.label}</span>
                      <span aria-hidden="true" className="translate-x-0 group-hover:translate-x-0.5 transition">
                        ›
                      </span>
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Image column — show full image without cropping */}
            <div className="relative overflow-hidden order-1 md:order-3 md:border-l md:border-white/15 h-[420px] md:h-[520px] bg-slate-900">
              <img
                key={i}
                src={s.src}
                alt={s.alt}
                className="absolute inset-0 w-full h-full object-contain object-center"
              />
              {/* Subtle shading */}
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-900/30 via-transparent to-transparent"
                aria-hidden="true"
              />
            </div>
          </div>

          {/* Horizontal divider (mobile only) */}
          <div className="md:hidden px-6 mt-4">
            <div
              aria-hidden="true"
              className="h-px w-full rounded-full bg-[linear-gradient(90deg,rgba(255,255,255,0.22)_0%,rgba(15,81,50,0.5)_50%,rgba(127,29,29,0.45)_100%)]"
            />
          </div>

          {/* Controls */}
          <div className="px-6 md:px-8 py-4 flex items-center justify-between">
            {/* Prev/Next */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => go(i - 1)}
                className="h-11 w-11 rounded-full border border-white/20 bg-slate-900/60 hover:bg-slate-900/80 backdrop-blur-md shadow-[0_8px_30px_rgba(0,0,0,0.35)] transition grid place-items-center text-white"
                aria-label="Previous slide"
                title="Previous"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => go(i + 1)}
                className="h-11 w-11 rounded-full border border-white/20 bg-slate-900/60 hover:bg-slate-900/80 backdrop-blur-md shadow-[0_8px_30px_rgba(0,0,0,0.35)] transition grid place-items-center text-white"
                aria-label="Next slide"
                title="Next"
              >
                ›
              </button>
            </div>

            {/* Dots */}
            <div className="flex gap-2">
              {slides.map((_, idx) => {
                const active = idx === i;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => go(idx)}
                    aria-label={`Go to slide ${idx + 1}`}
                    title={`Slide ${idx + 1}`}
                    className={`h-2 rounded-full transition backdrop-blur ${active ? "w-9 md:w-10" : "w-5 md:w-6"}`}
                    style=
                      {active
                        ? {
                            background:
                              "linear-gradient(90deg, #0f5132 0%, #e5e7eb 50%, #7f1d1d 100%)",
                            boxShadow:
                              "0 0 0 1px rgba(255,255,255,0.55) inset, 0 2px 6px rgba(0,0,0,0.4)",
                          }
                        : { background: "rgba(255,255,255,0.45)" }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Keyboard navigation (container focusable for arrows) */}
      <div
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(i + 1);
          if (e.key === "ArrowLeft") go(i - 1);
        }}
      />
    </div>
  );
}
