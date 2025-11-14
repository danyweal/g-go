import ProHeroSlider, { ProSlide } from '@/components/ProHeroSlider';

const slides: ProSlide[] = [
  {
    src: '/images/hero/1.jpg',
    thumb: '/images/hero/thumbs/1.jpg',
    alt: 'Community event',
    headline: 'Expert consulting that drives real growth',
    subtext: 'Elevate your organization with tailored strategies and unwavering support.',
    ctaPrimary: { label: 'Get in touch', href: '/contact' },
    ctaSecondary: { label: 'What we do', href: '/about' },
  },
  // ...add the rest up to 10
];

export default function Home() {
  return (
    <ProHeroSlider
      slides={slides}
      autoPlayMs={6000}
      pauseOnHover
      showThumbs
      fixedAspect="16/10"
      desktopHeight={680}
    />
  );
}
