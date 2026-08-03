import { cn } from '../../lib/utils';

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        'inline-block h-4 w-4 animate-spin rounded-full border-2 border-line-strong border-t-accent',
        className,
      )}
    />
  );
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-3.5 text-[12.5px] text-muted">{children}</p>;
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-3.5 text-[12.5px] text-critical">{children}</p>;
}
