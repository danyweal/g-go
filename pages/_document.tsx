// pages/_document.tsx

import Document, {
  Html,
  Head,
  Main,
  NextScript,
  DocumentContext,
  DocumentInitialProps,
} from 'next/document';

const setInitialColorMode = `
(function() {
  function getStoredTheme() {
    try { return localStorage.getItem('theme'); } catch(e){ return null; }
  }
  function getPreferredTheme() {
    const stored = getStoredTheme();
    if (stored) return stored;
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    return 'light';
  }
  const theme = getPreferredTheme();
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  }
  document.documentElement.dataset.theme = theme;
})();
`;

interface MyDocumentProps extends DocumentInitialProps {
  // add custom props here if needed in the future
}

export default class MyDocument extends Document<MyDocumentProps> {
  static async getInitialProps(
    ctx: DocumentContext
  ): Promise<MyDocumentProps> {
    const initialProps = await Document.getInitialProps(ctx);
    return { ...initialProps };
  }

  render() {
    const canonical = 'http://Palestiniancommunity.co.uk'; // replace or inject dynamically
    return (
      <Html lang="en" className="antialiased">
        <Head>
          {/* Basic meta */}
          <meta charSet="utf-8" />
          <meta
            name="viewport"
            content="width=device-width,initial-scale=1,viewport-fit=cover"
          />
          <meta name="format-detection" content="telephone=no" />
          <meta
            name="theme-color"
            content="#f5f5f5"
            media="(prefers-color-scheme: light)"
          />
          <meta
            name="theme-color"
            content="#1e1e1e"
            media="(prefers-color-scheme: dark)"
          />
          <link rel="canonical" href={canonical} />

          {/* Preconnect & preload fonts */}
          <link
            rel="preconnect"
            href="https://fonts.googleapis.com"
            crossOrigin="anonymous"
          />
          <link
            rel="preconnect"
            href="https://fonts.gstatic.com"
            crossOrigin="anonymous"
          />
          <link
            href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&family=Inter:wght@300;400;600;700&display=swap"
            rel="stylesheet"
          />

          {/* Favicons */}
          <link rel="icon" href="/favicon.ico" />
          <link
            rel="apple-touch-icon"
            sizes="180x180"
            href="/apple-touch-icon.png"
          />
          <link
            rel="mask-icon"
            href="/safari-pinned-tab.svg"
            color="#007A3D"
          />
          <meta name="msapplication-TileColor" content="#007A3D" />

          {/* Open Graph / Twitter */}
          <meta property="og:type" content="website" />
          <meta
            property="og:title"
            content="Palestinian Community Association"
          />
          <meta
            property="og:description"
            content="Connecting Palestinians across the North West UK. Join, donate, stay informed."
          />
          <meta property="og:image" content="/og-image.png" />
          <meta property="og:url" content={canonical} />
          <meta name="twitter:card" content="summary_large_image" />
          <meta
            name="twitter:title"
            content="Palestinian Community Association"
          />
          <meta
            name="twitter:description"
            content="Connecting Palestinians across the North West UK. Join, donate, stay informed."
          />
          <meta name="twitter:image" content="/og-image.png" />

          {/* JSON-LD Organization Schema */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'Organization',
                name: 'Palestinian Community Association',
                url: canonical,
                logo: `${canonical}/logo.png`,
                sameAs: [
                  'https://www.facebook.com/PalCommunityMcr',
                  'https://twitter.com/',
                ],
                contactPoint: [
                  {
                    '@type': 'ContactPoint',
                    telephone: '+44 1234 567 890',
                    contactType: 'customer support',
                    areaServed: 'GB',
                    availableLanguage: ['English'],
                  },
                ],
              }),
            }}
          />

          {/* Prevent flash-of-incorrect-theme */}
          <script
            dangerouslySetInnerHTML={{
              __html: setInitialColorMode,
            }}
          />

          {/* Minor critical CSS to avoid white flash on dark mode */}
          <style>{`
            html { background-color: #f5f5f5; }
            .dark html { background-color: #1e1e1e; }
            body { margin:0; }
          `}</style>

          {/* Performance hint for LCP */}
          <link rel="preload" as="image" href="/images/slide1.jpg" />
        </Head>

        <body className="text-base leading-relaxed antialiased bg-[var(--color-bg,#f5f5f5)]">
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
