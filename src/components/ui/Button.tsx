import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const variants: Record<Variant, string> = {
  primary:
    'bg-navy-950 text-white hover:bg-navy-800 disabled:bg-navy-300 disabled:text-white/80',
  secondary:
    'border border-line bg-white text-navy-800 hover:bg-navy-50 disabled:text-navy-300',
  ghost: 'text-navy-600 hover:bg-navy-50 disabled:text-navy-300',
  danger:
    'bg-accent-red text-white hover:bg-red-700 disabled:bg-red-200 disabled:text-white/80',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 gap-1.5 px-3 text-sm',
  md: 'h-10 gap-2 px-4 text-sm',
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      className,
      children,
      disabled,
      type = 'button',
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center rounded-lg font-medium transition-colors disabled:cursor-not-allowed',
          variants[variant],
          sizes[size],
          className,
        )}
        {...rest}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
        {children}
      </button>
    );
  },
);
