import { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export type PillTone = 'neutral' | 'info' | 'success' | 'warning' | 'critical';

export interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: PillTone;
}

const tones: Record<PillTone, string> = {
  neutral: 'bg-surface-2 text-muted border border-line',
  info: 'bg-accent-soft text-accent-ink',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  critical: 'bg-critical-soft text-critical',
};

export function Pill({ tone = 'neutral', className, children, ...props }: PillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11.5px] font-semibold',
        tones[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
