import * as React from 'react';
import clsx from 'clsx';

type Props = React.PropsWithChildren<{
  id?: string;
  className?: string;
  tone?: 'plain' | 'light' | 'dark' | 'glass';
}>;

export default function Section({ id, children, className = '', tone = 'plain' }: Props) {
  const toneCls =
    tone === 'dark'
      ? 'bg-palestine-dark text-white'
      : tone === 'light'
      ? 'bg-palestine-light/50'
      : tone === 'glass'
      ? 'bg-white/60 backdrop-blur border border-white/20 dark:bg-white/5 dark:border-white/10'
      : '';
  return (
    <section id={id} className={clsx('py-16', toneCls, className)}>
      <div className="max-w-7xl mx-auto px-6">{children}</div>
    </section>
  );
}
