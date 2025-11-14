import Head from 'next/head'

interface SeoProps {
  title?: string
  description?: string
  image?: string
  url?: string
}

const defaultTitle = 'Palestinian Community Association North West'
const defaultDescription = 'Official site for news, events, and community engagement.'
const defaultImage = '/logo.png'
const defaultUrl = 'https://your-domain.com/' // <-- Update this to your actual URL!

export function Seo({
  title = defaultTitle,
  description = defaultDescription,
  image = defaultImage,
  url = defaultUrl,
}: SeoProps) {
  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:url" content={url} />
      <meta name="twitter:card" content="summary_large_image" />
      <link rel="icon" href="/favicon.ico" />
    </Head>
  )
}
