import React, { useEffect, useMemo, useRef, useState } from 'react';
import Navbar from './Navbar';
import Footer from './Footer';
import { motion, MotionConfig } from 'framer-motion';
import clsx from 'clsx';

/**
 * Ultra Layout (Pro)
 * ------------------------------------------------------------
 * • Crisp, modern visuals (subtle grid + vignette, soft shadows)
 * • Accessibility-first (skip link, ARIA, focus rings, motion-aware)
 * • Zero-jank back-to-top via IntersectionObserver
 * • Dismissible announcement (session-persistent)
 * • Scroll progress bar (top, 1px on mobile, 2px+ on desktop)
 * • Safe-area padding for mobile (env(safe-area-inset-*)))
 * • Flexible container control (withContainer, className)
 */

export type LayoutProps = React.PropsWithChildren<{
  /** Optional announcement banner content shown below the navbar */
  announcement?: React.ReactNode;
  /** Unique ID to persist announcement dismissal within the session */
  announcementId?: string;
  /** Optional: add classes to the outermost wrapper */
  className?: string;
  /** Optional: wrap children in a max-width container (defaults to true) */
  withContainer?: boolean;
}>;

const scrollToTop = () => {
  if (typeof window !== 'undefined') {
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      window.scrollTo(0, 0);
    }
  }
};

export default function Layout({
  children,
  announcement,
  announcementId = 'global-announcement',
  className,
  withContainer = true,
}: LayoutProps) {
  const [showTop, setShowTop] = useState(false);
  const [bannerOpen, setBannerOpen] = useState(true);
  const [progress, setProgress] = useState(0);
  const topSentinelRef = useRef<HTMLSpanElement | null>(null);

  // Persist banner dismissal per session (new tab resets; switch to localStorage for permanent)
  useEffect(() => {
    if (!announcement) return;
    if (typeof window === 'undefined') return;
    const k = `banner.dismissed:${announcementId}`;
    const dismissed = sessionStorage.getItem(k) === '1';
    setBannerOpen(!dismissed);
  }, [announcement, announcementId]);

  const onDismissBanner = () => {
    setBannerOpen(false);
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(`banner.dismissed:${announcementId}`, '1');
      } catch {}
    }
  };

  // Back-to-top visibility via IntersectionObserver (no scroll listener when supported)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const el = topSentinelRef.current;
    if (!el || !('IntersectionObserver' in window)) {
      const onScroll = () => setShowTop(window.scrollY > 400);
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
      return () => window.removeEventListener('scroll', onScroll);
    }
    const obs = new IntersectionObserver(
      (entries) => setShowTop(!entries[0]?.isIntersecting),
      { threshold: 0.01 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Lightweight scroll progress (uses scroll listener, throttled by rAF)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let ticking = false;
    const calc = () => {
      const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
      const total = Math.max(scrollHeight - clientHeight, 1);
      setProgress(Math.min(1, Math.max(0, scrollTop / total)));
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(calc);
      }
    };
    calc();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Motion preferences (memo avoids re-renders)
  const transitions = useMemo(
    () => ({ duration: 0.35, ease: [0.2, 0.65, 0.3, 1] as unknown }),
    []
  );

  return (
    <div
      className={clsx(
        'min-h-screen flex flex-col transition-colors',
        // Base background
        'bg-gradient-to-b from-palestine-light to-white dark:from-[#0b0f0c] dark:to-black',
        // Subtle grid & vignette overlay using pseudo-element-like layers
        'relative',
        className
      )}
    >
      {/* Decorative background layers (no layout impact) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        {/* Grid */}
        <div
          className={clsx(
            'absolute inset-0 opacity-[0.06] dark:opacity-[0.08]'
          )}
          style={{
            backgroundImage:
              'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            color: 'rgba(0,0,0,0.65)'
          }}
        />
        {/* Vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_50%_-10%,rgba(22,163,74,0.08),transparent),radial-gradient(1000px_500px_at_90%_10%,rgba(220,38,38,0.06),transparent)]" />
      </div>

      {/* Invisible sentinel at the very top used by IntersectionObserver */}
      <span ref={topSentinelRef} aria-hidden="true" />

      {/* Skip link (visible on keyboard focus) */}
      <a
        href="#main"
        className={clsx(
          'fixed top-[max(1rem,env(safe-area-inset-top))] left-[max(1rem,env(safe-area-inset-left))] z-[60] rounded-md bg-palestine-green text-white px-4 py-2 text-sm font-medium',
          'focus:outline-none focus:ring-2 focus:ring-palestine-accent transition-opacity opacity-0 focus:opacity-100'
        )}
      >
        Skip to content
      </a>

      {/* Top scroll progress bar */}
      <div aria-hidden className="fixed inset-x-0 top-0 z-[55] h-[3px] sm:h-1 bg-transparent">
        <div
          className="h-full bg-palestine-green transition-[width] duration-150 ease-out"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>

      {/* Main nav (render ONLY here to avoid duplicates) */}
      <Navbar />

      {/* Optional announcement (polite to AT; dismissible) */}
      {announcement && bannerOpen && (
        <div
          role="status"
          aria-live="polite"
          className="w-full relative isolate overflow-hidden bg-palestine-green text-white"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-center gap-3 text-center">
            <span className="text-sm font-medium">{announcement}</span>
            <button
              type="button"
              aria-label="Dismiss announcement"
              className="ml-2 inline-flex items-center justify-center rounded-md p-1 text-white/90 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/50"
              onClick={onDismissBanner}
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          {/* subtle bottom border via gradient */}
          <div className="pointer-events-none h-[1px] w-full bg-gradient-to-r from-white/0 via-white/40 to-white/0" />
        </div>
      )}

      {/* Content */}
      <main
        id="main"
        className={clsx(
          'flex-grow w-full',
          withContainer && 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10',
          'pb-[max(2.5rem,env(safe-area-inset-bottom))]'
        )}
      >
        <MotionConfig reducedMotion="user">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={transitions}>
            {children}
          </motion.div>
        </MotionConfig>
      </main>

      {/* Footer (render ONLY here to avoid duplicates) */}
      <Footer />

      {/* Back-to-top */}
      <button
        aria-label="Scroll to top"
        title="Scroll to top"
        onClick={scrollToTop}
        className={clsx(
          'fixed right-[max(1.25rem,env(safe-area-inset-right))] bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-[60] flex items-center justify-center rounded-full shadow-lg transition-opacity backdrop-blur-sm',
          showTop ? 'opacity-100' : 'pointer-events-none opacity-0',
          // size & colors
          'p-3 bg-white text-palestine-green ring-1 ring-black/10 hover:bg-white/90 dark:bg-black/60 dark:text-white dark:ring-white/10'
        )}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 6L5 11H8V14H12V11H15L10 6Z" fill="currentColor" />
        </svg>
        <span className="sr-only">Back to top</span>
      </button>
    </div>
  );
}
