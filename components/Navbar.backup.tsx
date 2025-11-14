// components/Navbar.tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';

// Utility to combine class names
const cn = (...classes: (string | false | undefined | null)[]) =>
  classes.filter(Boolean).join(' ');

const NAV_ITEMS = [
  { href: '/', label: 'Home' },
  { href: '/news', label: 'News' },
  { href: '/events', label: 'Events' },
  { href: '/donate', label: 'Donate' },
  { href: '/join', label: 'Join' },
  { href: '/contact', label: 'Contact' },
  { href: '/gallery', label: 'Gallery' },
];

const getInitialTheme = () => {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem('theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
};

export default function Navbar() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    getInitialTheme() as 'light' | 'dark'
  );
  const [scrolled, setScrolled] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const root = window.document.documentElement;
    theme === 'dark'
      ? root.classList.add('dark')
      : root.classList.remove('dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(
    () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
    []
  );

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (
        menuOpen &&
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () =>
      document.removeEventListener('mousedown', onClickOutside);
  }, [menuOpen]);

  useEffect(() => {
    const handle = () => setMenuOpen(false);
    router.events.on('routeChangeStart', handle);
    return () =>
      router.events.off('routeChangeStart', handle);
  }, [router]);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setScrolled(window.scrollY > 5);
          ticking = false;
        });
        ticking = true;
      }
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () =>
      window.removeEventListener('scroll', onScroll);
  }, []);

  const isActive = useCallback(
    (href: string) => {
      if (href === '/') return router.pathname === '/';
      return router.pathname
        .toLowerCase()
        .startsWith(href.toLowerCase());
    },
    [router.pathname]
  );

  return (
    <header
      aria-label="Main navigation"
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-shadow duration-300',
        'bg-black bg-opacity-70 dark:bg-opacity-70',
        'bg-[url("/keffiyeh-pattern.svg")] bg-center bg-cover',
        scrolled ? 'shadow-xl' : ''
      )}
    >
      <div
        ref={containerRef}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-20"
      >
        {/* Logo with Handala icon and styled text */}
        <Link
          href="/"
          aria-label="Home"
          className="flex items-center space-x-2"
        >
          <Image src="/handala.svg" alt="Handala" width={48} height={48} />
          <div className="flex flex-col leading-none">
            <span
              className="text-lg font-extrabold bg-gradient-to-r from-[#CE1126] via-white via-40% via-black via-70% to-[#007A3D] bg-clip-text text-transparent"
              style={{
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Palestinian Community
            </span>
            <span className="text-sm font-semibold text-white">
              Association.{' '}
              <span className="text-[#007A3D]">(NW)</span>
            </span>
          </div>
        </Link>

        {/* Desktop nav items */}
        <nav className="hidden md:flex items-center space-x-10">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={
                isActive(item.href) ? 'page' : undefined
              }
              className={cn(
                'relative pb-1 text-sm font-medium transition-colors',
                isActive(item.href)
                  ? 'text-[#00B33C]'
                  : 'text-white hover:text-[#00B33C]'
              )}
            >
              {item.label}
              {isActive(item.href) && (
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#00B33C]" />
              )}
            </Link>
          ))}
        </nav>

        {/* Mobile & theme toggles */}
        <div className="flex items-center space-x-4">
          <button
            aria-label="Toggle theme"
            onClick={toggleTheme}
            className="p-2 rounded-full hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            {/* Icon goes here */}
          </button>
          <button
            aria-label="Open menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            className="md:hidden p-2 rounded-md hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            {/* Menu icon */}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-black bg-opacity-90">
          <div className="px-4 pt-4 pb-6 space-y-2">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={
                  isActive(item.href) ? 'page' : undefined
                }
                className={cn(
                  'block px-3 py-2 text-base font-medium transition-colors rounded-md',
                  isActive(item.href)
                    ? 'bg-[#00B33C]/20 text-[#00B33C]'
                    : 'text-white hover:text-[#00B33C] hover:bg-white/10'
                )}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
