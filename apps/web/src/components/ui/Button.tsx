import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'ghost';
  size?: 'default' | 'sm';
}

const base =
  'inline-flex items-center justify-center gap-1.5 rounded font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
  default: 'border border-line-strong bg-surface text-ink hover:bg-surface-2',
  primary: 'border border-accent bg-accent text-white hover:bg-accent-ink hover:border-accent-ink',
  ghost: 'border border-transparent bg-transparent hover:bg-surface-2',
};

const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
  default: 'px-3.5 py-[7px] text-[13px]',
  sm: 'px-2.5 py-[5px] text-xs',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => (
    <button ref={ref} className={cn(base, variants[variant], sizes[size], className)} {...props} />
  ),
);
Button.displayName = 'Button';
