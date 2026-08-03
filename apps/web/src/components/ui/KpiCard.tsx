import { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { Card } from './Card';

export interface KpiCardProps {
  label: string;
  value: ReactNode;
  delta?: ReactNode;
  deltaDirection?: 'up' | 'down' | 'neutral';
}

export function KpiCard({ label, value, delta, deltaDirection = 'neutral' }: KpiCardProps) {
  return (
    <Card className="flex flex-col gap-2 p-4">
      <span className="text-xs font-medium text-muted">{label}</span>
      <span className="num text-[23px] font-bold tracking-tight">{value}</span>
      {delta && (
        <span
          className={cn(
            'flex items-center gap-1 text-[11.5px] font-semibold',
            deltaDirection === 'up' && 'text-success',
            deltaDirection === 'down' && 'text-critical',
            deltaDirection === 'neutral' && 'text-muted',
          )}
        >
          {delta}
        </span>
      )}
    </Card>
  );
}
