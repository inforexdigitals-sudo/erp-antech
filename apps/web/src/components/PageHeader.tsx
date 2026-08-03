import { ReactNode } from 'react';

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-[18px] flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-2">{eyebrow}</div>
        <h1 className="text-xl">{title}</h1>
        {subtitle && <div className="mt-[3px] text-[13px] text-muted">{subtitle}</div>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
