// components/Footer.tsx
import { useState } from 'react';

const quickLinks = [
  { href: '/', label: 'Home' },
  { href: '/news', label: 'News' },
  { href: '/events', label: 'Events' },
  { href: '/donate', label: 'Donate' },
  { href: '/join', label: 'Join' },
  { href: '/contact', label: 'Contact' },
  { href: '/about', label: 'About us' },
];

const social = [
  {
    label: 'Facebook',
    href: 'https://www.facebook.com/PalCommunityMcr',
    svg: (
      <svg aria-hidden="true" className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M13.5 2h-3C7.567 2 6 3.567 6 5.5v3C6 9.776 6 14.5 6 14.5s0 4.724 0 5H6v2h3v-2h2v2h3v-2h1s0-4.776 0-5 0-5.5 0-5.5V5.5C15 3.567 13.433 2 11.5 2z" />
      </svg>
    ),
  },
  {
    label: 'X (Twitter)',
    href: 'https://twitter.com',
    svg: (
      <svg aria-hidden="true" className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M22.46 6.011c-.793.352-1.645.59-2.538.699a4.436 4.436 0 001.946-2.448 8.85 8.85 0 01-2.81 1.074 4.417 4.417 0 00-7.522 4.026A12.53 12.53 0 013 4.783a4.416 4.416 0 001.367 5.894 4.385 4.385 0 01-2.002-.554v.056a4.417 4.417 0 003.542 4.33 4.428 4.428 0 01-1.997.075 4.419 4.419 0 004.127 3.062 8.86 8.86 0 01-5.49 1.894c-.357 0-.71-.021-1.058-.062a12.503 12.503 0 006.767 1.983c8.12 0 12.56-6.727 12.56-12.56 0-.192-.004-.384-.013-.574a8.97 8.97 0 002.205-2.285z" />
      </svg>
    ),
  },
  {
    label: 'Instagram',
    href: 'https://instagram.com',
    svg: (
      <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <rect width="18" height="18" x="3" y="3" rx="5" strokeWidth="2" />
        <circle cx="12" cy="12" r="4" strokeWidth="2" />
        <path d="M17.5 6.5h.01" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export default function Footer() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStatus('submitting');
    try {
      // placeholder: wire this to real newsletter backend
      await new Promise(r => setTimeout(r, 600));
      setStatus('done');
      setEmail('');
    } catch {
      setStatus('error');
    }
  };

  return (
    <footer className="bg-palestine-dark text-white pt-16 pb-10">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-10">
        {/* About */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="text-2xl">NW</div>
            <h3 className="text-xl font-bold">Palestinian Community</h3>
          </div>
          <p className="text-sm text-palestine-light/80">
            “Together we make a lasting impact and grow stronger. Every kind of support,membership, volunteering, or donations. brings our Palestinian community to life, deepens our connections, and secures our future.”
            
          </p>
          <div className="flex gap-3 mt-2">
            {social.map(s => (
              <a
                key={s.label}
                href={s.href}
                aria-label={s.label}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition"
              >
                {s.svg}
              </a>
            ))}
          </div>
        </div>

        {/* Quick Links */}
        <div>
          <h4 className="text-lg font-semibold mb-3">Quick Links</h4>
          <ul className="space-y-2 text-sm">
            {quickLinks.map(l => (
              <li key={l.href}>
                <a
                  href={l.href}
                  className="hover:underline flex items-center gap-2 transition"
                >
                  <span className="inline-block w-1 h-1 rounded-full bg-palestine-accent mr-2" />
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Contact */}
        <div>
          <h4 className="text-lg font-semibold mb-3">Contact</h4>
          <p className="text-sm mb-2">
            <strong>Address:</strong> Manchester, North West UK
          </p>
          <p className="text-sm mb-2">
            <strong>Email:</strong>{' '}
            <a
              href="mailto:info@palestiniancommunity.co.uk"
              className="underline hover:text-palestine-accent"
            >
              info@palestiniancommunity.co.uk
            </a>
          </p>
          <p className="text-sm">
            <strong>Phone:</strong>{' '}
            <a href="tel:+441234567890" className="underline hover:text-palestine-accent">
              +447582222118
            </a>
          </p>
        </div>

        {/* Newsletter / Stay updated */}
        <div className="space-y-4">
          <h4 className="text-lg font-semibold">Stay Updated</h4>
          <p className="text-sm text-palestine-light/80">
            Subscribe to our newsletter for the latest news, events, and community updates.
          </p>
          <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-3" noValidate>
            <label htmlFor="footer-newsletter" className="sr-only">
              Email address
            </label>
            <input
              id="footer-newsletter"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="flex-1 px-4 py-3 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-palestine-accent"
              aria-label="Your email"
            />
            <button
              type="submit"
              disabled={status === 'submitting' || status === 'done'}
              className="px-5 py-3 rounded-lg font-semibold bg-palestine-accent text-palestine-dark hover:brightness-105 transition"
            >
              {status === 'done' ? 'Subscribed' : 'Subscribe'}
            </button>
          </form>
          {status === 'error' && (
            <p className="text-xs text-red-400">Subscription failed. Try again.</p>
          )}
          {status === 'done' && (
            <p className="text-xs text-green-300">Thank you for subscribing!</p>
          )}
        </div>
      </div>

      <div className="mt-12 border-t border-palestine-light/30 pt-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center text-sm gap-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <p>
              © {new Date().getFullYear()} Palestinian Community Association. All rights reserved.
            </p>
            <span className="hidden sm:inline">•</span>
            <a href="/privacy" className="hover:underline">
              Privacy Policy
            </a>
            <span className="hidden sm:inline">•</span>
            <a href="/terms" className="hover:underline">
              Terms of Service
            </a>
          </div>
          <div className="text-palestine-light/70">
            Built with community in mind. 🇵🇸
          </div>
        </div>
      </div>
    </footer>
  );
}
