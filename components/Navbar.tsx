// components/Navbar.tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';

const cn = (...classes: (string | false | undefined | null)[]) =>
  classes.filter(Boolean).join(' ');

// Added Store & Services (same pill style)
const NAV_ITEMS = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About us' },
  { href: '/donate', label: 'Projects' },
  { href: '/news', label: 'News' },
  { href: '/events', label: 'Events' },
  { href: '/gallery', label: 'Rawah Ana' },
  { href: '/contact', label: 'Contact us' },


];

export default function Navbar() {
  const router = useRouter();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const isAdmin = role === 'admin';

  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const handle = () => setMenuOpen(false);
    router.events?.on('routeChangeComplete', handle);
    router.events?.on('hashChangeComplete', handle);
    return () => {
      router.events?.off('routeChangeComplete', handle);
      router.events?.off('hashChangeComplete', handle);
    };
  }, [router.events]);

  const isActive = useCallback(
    (href: string) => {
      if (href === '/') return router.pathname === '/';
      return router.pathname.toLowerCase().startsWith(href.toLowerCase());
    },
    [router.pathname]
  );

  // Unified high-contrast pill style
  const pillBase =
    'inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold transition-colors ring-1 ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#007A3D]';

  const pillIdle =
    'text-neutral-100 dark:text-white ring-white/15 hover:bg-white/10 hover:ring-white/25';

  const pillActive = 'bg-white text-neutral-900 ring-transparent';

  return (
    <header
      aria-label="Main navigation"
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-shadow duration-300',
        'relative overflow-hidden',
        'border-b border-white/10',
        scrolled ? 'shadow-lg' : ''
      )}
    >
      {/* === Dark blended gradient (match provided colors: teal → blue-gray → plum) === */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        {/* Base left→right gradient */}
        <div
          className={cn(
            'absolute inset-0',
            'bg-[linear-gradient(90deg,#0d2021_0%,#5a6272_55%,#2f2330_100%)]'
          )}
        />
        {/* Soft vignettes to mimic the curved falloff in the reference */}
        <div
          className={cn(
            'absolute inset-0 opacity-60',
            'bg-[radial-gradient(900px_420px_at_15%_70%,rgba(9,49,47,0.55),transparent_65%),radial-gradient(1100px_520px_at_85%_25%,rgba(64,55,71,0.45),transparent_65%)]'
          )}
        />
        {/* Subtle top-right sheen */}
        <div className="absolute inset-0 opacity-20 mix-blend-overlay bg-[radial-gradient(1200px_600px_at_70%_-10%,rgba(255,255,255,0.15),transparent_60%)]" />
        {/* Keep it very dark and professional */}
        <div className="absolute inset-0 bg-black/78" />
      </div>

      {/* Slim Palestinian flag accent */}
      <div className="w-full h-1.5 flex">
        <div className="flex-1 bg-black" />
        <div className="flex-1 bg-white" />
        <div className="flex-1 bg-[#007A3D]" />
        <div className="flex-1 bg-[#D32F2F]" />
      </div>

      <div
        ref={containerRef}
        className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-20"
      >
        {/* Logo + Identity */}
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <Link href="/" className="flex items-center gap-2 md:gap-3 min-w-0">
            <Image
              src="/logo.jpg"
              width={60}
              height={48}
              alt="Palestinian Community Association logo"
              className="rounded-md shadow ring-1 ring-black/5 shrink-0"
              priority
            />
            <div className="flex flex-col justify-center leading-[1.06] min-w-[180px] max-w-[240px]">
              <div className="flex flex-col items-start text-left">
                <span
                  dir="rtl"
                  className="text-[12px] sm:text-[14px] font-extrabold tracking-[0.01em] text-white"
                >
                 
                </span>
              </div>
              <span className="mt-[1px] block uppercase text-[16px] sm:text-[15px] font-extrabold tracking-[0.02em] text-white">
                Gaza go
              </span>
              <span className="mt-[4px] block text-[11px] font-medium text-neutral-200">
                Will of nothingness 
              </span>
              <div className="mt-[2px] flex items-center gap-2 text-[11px] font-semibold">
                <span className="text-white whitespace-nowrap">Gaza go</span>
                <span dir="rtl" className="text-[#7EE2AE] whitespace-nowrap">
                  Shall we go..
                </span>
              </div>
            </div>
          </Link>
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-2.5 lg:gap-3">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(pillBase, active ? pillActive : pillIdle)}
              >
                {item.label}
              </Link>
            );
          })}

          {isAdmin && (
            <Link
              href="/auth/admin"
              className={cn(pillBase, isActive('/auth/admin') ? pillActive : pillIdle)}
            >
              Admin
            </Link>
          )}
        </nav>

        {/* Mobile menu button */}
        <div className="flex items-center gap-3">
          <button
            className="md:hidden p-2 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007A3D] hover:bg-white/10 text-white"
            aria-label="Toggle menu"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <svg width="24" height="22" viewBox="0 0 24 24" fill="none">
              {menuOpen ? (
                <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Slim Palestinian flag accent */}
      <div className="w-full h-1.5 flex">
        <div className="flex-1 bg-black" />
        <div className="flex-1 bg-white" />
        <div className="flex-1 bg-[#007A3D]" />
        <div className="flex-1 bg-[#D32F2F]" />
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden">
          <div className="bg-black/70 backdrop-blur px-4 pt-3 pb-6 space-y-2 border-t border-white/10">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'block rounded-full px-4 py-3 text-base font-semibold ring-1 transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#007A3D]',
                    active
                      ? 'bg-white text-neutral-900 ring-transparent'
                      : 'text-white ring-white/15 hover:bg-white/10 hover:ring-white/25'
                  )}
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </Link>
              );
            })}

            {isAdmin && (
              <Link
                href="/auth/admin"
                className={cn(
                  'block rounded-full px-4 py-3 text-base font-semibold ring-1 transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#007A3D]',
                  isActive('/auth/admin')
                    ? 'bg-white text-neutral-900 ring-transparent'
                    : 'text-white ring-white/15 hover:bg-white/10 hover:ring-white/25'
                )}
                onClick={() => setMenuOpen(false)}
              >
                Admin
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
