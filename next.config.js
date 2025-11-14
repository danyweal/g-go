/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'storage.googleapis.com' },
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
      // Optional extras if you actually load from them:
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'lh4.googleusercontent.com' },
    ],
  },

  eslint: {
    ignoreDuringBuilds: true, // TODO: set to false in CI later
  },
  typescript: {
    ignoreBuildErrors: true, // TODO: set to false in CI later
  },

  experimental: {
    // Only if you actually use Server Actions; otherwise remove this block
    serverActions: {
      allowedOrigins: ['https://pcnw-app.web.app', 'https://pcnw-app.firebaseapp.com'],
    },
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // If you add a CSP here, make sure to include all domains your app needs (Stripe/PayPal/CDNs).
        ],
      },
    ];
  },
};

export default nextConfig;
