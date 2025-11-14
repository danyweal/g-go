// components/FlagTheme.tsx
import * as React from 'react';
import { type LucideIcon, Sparkles, CalendarDays, Newspaper, Images, MessageCircle, Mail } from 'lucide-react';

export const FlagRibbon = ({ className = '' }: { className?: string }) => (
  <div className={`grid grid-cols-4 h-1.5 overflow-hidden rounded-full ${className}`} aria-hidden="true">
    <div className="bg-palestine-black" />
    <div className="bg-white" />
    <div className="bg-palestine-green" />
    <div className="bg-palestine-red" />
  </div>
);

export const FlagSection = ({
  children,
  tone = 'light',
  className = '',
}: React.PropsWithChildren<{ tone?: 'light' | 'dark' | 'glass'; className?: string }>) => {
  const toneCls =
    tone === 'dark'
      ? 'bg-palestine-dark text-white'
      : tone === 'glass'
      ? 'relative overflow-hidden bg-white/70 backdrop-blur border border-white/30'
      : 'bg-palestine-light/40';
  return (
    <section className={`rounded-2xl ${toneCls} ${className}`}>
      <div className="relative pointer-events-none absolute inset-0 opacity-30 mix-blend-overlay bg-[conic-gradient(from_210deg,theme(colors.palestine.green),white,theme(colors.palestine.red))]" />
      <div className="relative">{children}</div>
    </section>
  );
};

export const IconHeading = ({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon?: LucideIcon;
  title: string | React.ReactNode;
  subtitle?: string | React.ReactNode;
  action?: React.ReactNode;
}) => (
  <div className="flex items-end justify-between gap-6">
    <div className="flex items-center gap-3">
      {Icon ? <Icon className="h-6 w-6 text-palestine-green" aria-hidden="true" /> : <Sparkles className="h-6 w-6 text-palestine-green" aria-hidden="true" />}
      <div>
        <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-palestine-green via-white to-palestine-red bg-clip-text text-transparent">
          {title}
        </h2>
        {subtitle ? <p className="mt-1 text-sm md:text-base text-palestine-dark/70">{subtitle}</p> : null}
      </div>
    </div>
    {action}
  </div>
);

export const tiles = {
  News: Newspaper,
  Events: CalendarDays,
  Gallery: Images,
  Comments: MessageCircle,
  Contact: Mail,
};
