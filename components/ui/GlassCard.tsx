// components/ui/GlassCard.tsx
import * as React from 'react';
import clsx from 'clsx';

type GlassCardOwnProps = {
  className?: string;
  children?: React.ReactNode;
};

type GlassCardProps<E extends React.ElementType> = GlassCardOwnProps & {
  as?: E;
} & Omit<React.ComponentPropsWithoutRef<E>, keyof GlassCardOwnProps | 'as'>;

export default function GlassCard<E extends React.ElementType = 'div'>(
  { as, className = '', children, ...rest }: GlassCardProps<E>
): React.ReactElement {
  const Comp = (as || 'div') as React.ElementType;

  return (
    <Comp
      className={clsx(
        'relative rounded-2xl border border-white/20 bg-white/60 backdrop-blur-md shadow-xl',
        'dark:bg-white/5 dark:border-white/10',
        className
      )}
      {...rest}
    >
      {/* subtle flag tint */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-25 mix-blend-overlay bg-[conic-gradient(from_210deg,theme(colors.palestine.green),white,theme(colors.palestine.red))]"
      />
      <div className="relative">{children}</div>
    </Comp>
  );
}
