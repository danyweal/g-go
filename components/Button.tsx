// components/Button.tsx
import React, {
  forwardRef,
  ReactNode,
  ElementType,
  ComponentPropsWithoutRef,
  ForwardedRef,
} from 'react';
import clsx from 'clsx';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface BaseButtonProps {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  className?: string;
  loading?: boolean;
  disabled?: boolean;
  /** Icon to show before the label */
  leadingIcon?: ReactNode;
  /** Icon to show after the label */
  trailingIcon?: ReactNode;
  /** If true, makes the button full width */
  block?: boolean;
  'aria-label'?: string;
}

/**
 * Polymorphic Button: renders as T (default 'button'),
 * merging its own props with that element’s native props.
 */
type ButtonProps<T extends ElementType> = BaseButtonProps &
  Omit<ComponentPropsWithoutRef<T>, keyof BaseButtonProps> & {
    as?: T;
  };

const variantStyles: Record<Variant, string> = {
  primary:
    'bg-palestine-green text-white hover:brightness-105 focus-visible:ring-2 focus-visible:ring-palestine-accent',
  secondary:
    'bg-palestine-red text-white hover:brightness-105 focus-visible:ring-2 focus-visible:ring-palestine-accent',
  outline:
    'bg-transparent border border-palestine-green text-palestine-green hover:bg-palestine-green/10 focus-visible:ring-2 focus-visible:ring-palestine-accent',
  ghost:
    'bg-transparent text-palestine-dark hover:bg-palestine-light/50 dark:text-white focus-visible:ring-2 focus-visible:ring-palestine-accent',
};

const sizeStyles: Record<Size, string> = {
  sm: 'text-sm px-4 py-2',
  md: 'text-base px-6 py-3',
  lg: 'text-lg px-8 py-4',
};

const Spinner = () => (
  <svg
    aria-hidden="true"
    className="w-4 h-4 animate-spin"
    viewBox="0 0 24 24"
    fill="none"
    role="img"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
    />
  </svg>
);

const Button = forwardRef(
  <T extends ElementType = 'button'>(
    {
      as,
      children,
      variant = 'primary',
      size = 'md',
      className = '',
      loading = false,
      disabled = false,
      leadingIcon,
      trailingIcon,
      block = false,
      ...rest
    }: ButtonProps<T>,
    ref: ForwardedRef<Element>
  ) => {
    const Component = as || ('button' as ElementType);
    const isDisabled = disabled || loading;

    // Only pass 'type' when rendering a real <button>
    const extraProps =
      Component === 'button'
        ? { type: (rest as ComponentPropsWithoutRef<'button'>).type || 'button' }
        : {};

    return (
      <Component
        ref={ref}
        aria-busy={loading || undefined}
        aria-disabled={isDisabled || undefined}
        className={clsx(
          'inline-flex items-center justify-center font-semibold rounded-lg transition shadow-sm focus:outline-none relative overflow-hidden',
          variantStyles[variant],
          sizeStyles[size],
          block && 'w-full',
          isDisabled ? 'opacity-60 cursor-not-allowed' : 'hover:shadow-md',
          className
        )}
        {...(isDisabled
          ? {
              // prevent interactions when disabled on non-button elements
              'aria-disabled': true,
              tabIndex: -1,
            }
          : {})}
        {...extraProps}
        {...(rest as Omit<ComponentPropsWithoutRef<T>, keyof BaseButtonProps>)}
      >
        <span className="flex items-center gap-2">
          {loading && (
            <span className="mr-1 flex items-center">
              <Spinner />
            </span>
          )}
          {leadingIcon && !loading && (
            <span className="mr-1 flex items-center">{leadingIcon}</span>
          )}
          <span className={clsx(loading && 'opacity-90')}>{children}</span>
          {trailingIcon && !loading && (
            <span className="ml-1 flex items-center">{trailingIcon}</span>
          )}
        </span>
      </Component>
    );
  }
) as <T extends ElementType = 'button'>(
  props: ButtonProps<T> & { ref?: ForwardedRef<Element> }
) => JSX.Element;

Button.displayName = 'Button';

export default Button;
