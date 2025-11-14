import * as React from 'react';

type Props = React.PropsWithChildren<{
  className?: string;
  from?: string;
  via?: string;
  to?: string;
}>;

export default function GradientText({
  children,
  className = '',
  from = 'from-palestine-green',
  via = 'via-white',
  to = 'to-palestine-red',
}: Props) {
  return (
    <span
      className={`bg-gradient-to-r ${from} ${via} ${to} bg-clip-text text-transparent ${className}`}
    >
      {children}
    </span>
  );
}
