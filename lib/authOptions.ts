// lib/authOptions.ts
import type { NextAuthOptions, User } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';

/** ---------------- helpers ---------------- */
function getEnv(
  name: string,
  { requiredInProd = true, defaultValue = '' }: { requiredInProd?: boolean; defaultValue?: string } = {}
) {
  const v = process.env[name] ?? defaultValue;
  if (requiredInProd && process.env.NODE_ENV === 'production' && !v) {
    throw new Error(`[auth] Missing required env: ${name}`);
  }
  return v;
}

function parseEmailList(envVar: string): string[] {
  return (process.env[envVar] || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function isAdminEmail(email?: string | null) {
  if (!email) return false;
  const list = parseEmailList('ADMIN_EMAILS');
  return list.includes(email.toLowerCase());
}

/** --------------- env + safety --------------- */
const NEXTAUTH_SECRET = getEnv('NEXTAUTH_SECRET');
const NEXTAUTH_URL = getEnv('NEXTAUTH_URL', { requiredInProd: true });

// Allow “any host” at runtime by trusting Host header (set this in env, not here):
//   AUTH_TRUST_HOST=true
// NextAuth reads it automatically; no code changes needed.

if (process.env.NODE_ENV === 'production') {
  // Guard against accidental localhost in prod. You can still serve any public domain.
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(String(NEXTAUTH_URL))) {
    throw new Error(
      `[auth] NEXTAUTH_URL points to localhost in production: ${NEXTAUTH_URL}. ` +
        `Set it to your live domain and redeploy.`
    );
  }
}

// Providers (Google optional; Credentials always available)
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';

// Admin controls
const ADMIN_SHARED_PASSWORD = getEnv('ADMIN_SHARED_PASSWORD', { requiredInProd: true });
const ADMIN_USER = (process.env.ADMIN_USER || '').trim().toLowerCase();

// Optional: allow HTTP (insecure) when you really need it
// Set FORCE_INSECURE_COOKIE=1 to disable secure cookies (e.g., on LAN over http://).
const INSECURE = process.env.FORCE_INSECURE_COOKIE === '1';

/** --------------- providers --------------- */
const providers = [
  ...(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET
    ? [
        GoogleProvider({
          clientId: GOOGLE_CLIENT_ID,
          clientSecret: GOOGLE_CLIENT_SECRET,
        }),
      ]
    : []),
  CredentialsProvider({
    name: 'Credentials',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      const email = (credentials?.email || '').trim().toLowerCase();
      const password = credentials?.password || '';

      if (!email || !password) return null;
      if (!ADMIN_SHARED_PASSWORD || password !== ADMIN_SHARED_PASSWORD) return null;

      const adminUserMatch =
        !!ADMIN_USER &&
        (email === ADMIN_USER || (email.includes('@') && email.split('@')[0] === ADMIN_USER));

      const allowed = isAdminEmail(email) || adminUserMatch;
      if (!allowed) return null;

      const user: User & { role: 'admin' } = {
        id: email,
        name: email.split('@')[0] || 'admin',
        email,
        role: 'admin',
      };
      return user;
    },
  }),
];

/** --------------- options --------------- */
export const authOptions: NextAuthOptions = {
  pages: { signIn: '/auth/admin/login' },
  session: { strategy: 'jwt' },
  secret: NEXTAUTH_SECRET,
  providers,

  // Host-agnostic cookies:
  // - Do NOT set cookie.domain → host-only cookies work on whatever domain you deploy.
  // - Secure in prod by default; can be forced off with FORCE_INSECURE_COOKIE=1 (for HTTP).
  useSecureCookies: !INSECURE && process.env.NODE_ENV === 'production',
  cookies: {
    sessionToken: {
      name:
        !INSECURE && process.env.NODE_ENV === 'production'
          ? '__Secure-next-auth.session-token'
          : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: !INSECURE && process.env.NODE_ENV === 'production', // true on HTTPS prod; false if INSECURE
        // domain: undefined // keep host-only so it works on any domain
      },
    },
  },

  callbacks: {
    async signIn() {
      // Add extra runtime checks (IP allowlist/blocklist, etc.) here if you want.
      return true;
    },

    async jwt({ token, user, profile }) {
      const email =
        (typeof token?.email === 'string' && token.email) ||
        ((user as unknown as { email?: string })?.email ?? '') ||
        ((profile as unknown as { email?: string })?.email ?? '') ||
        '';

      const adminUserMatch =
        !!ADMIN_USER &&
        (email.toLowerCase() === ADMIN_USER ||
          (email.includes('@') && email.split('@')[0].toLowerCase() === ADMIN_USER));

      const isAdmin =
        (user as unknown as { role?: string })?.role === 'admin' || isAdminEmail(email) || adminUserMatch;

      (token as Record<string, unknown>).role = isAdmin
        ? 'admin'
        : ((token as Record<string, unknown>).role || 'user');

      return token;
    },

    async session({ session, token }) {
      (session.user as Record<string, unknown>).role =
        (token as Record<string, unknown>).role || 'user';
      return session;
    },
  },
};
