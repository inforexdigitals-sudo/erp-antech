import { Card } from './ui/Card';

export function ComingSoon({ title }: { title: string }) {
  return (
    <div>
      <div className="mb-[18px] flex items-end justify-between gap-4">
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-2">Module</div>
          <h1 className="text-xl">{title}</h1>
        </div>
      </div>
      <Card className="p-6 text-center">
        <p className="text-sm text-muted">
          {title} isn&apos;t wired up in the frontend yet — the backend API for it may or may not exist either. Check{' '}
          <code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs">apps/api/README.md</code> for what&apos;s built
          so far.
        </p>
      </Card>
    </div>
  );
}
