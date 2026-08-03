import { cn } from '../../lib/utils';

export interface TabItem {
  key: string;
  label: string;
}

export function Tabs({ tabs, active, onChange }: { tabs: TabItem[]; active: string; onChange: (key: string) => void }) {
  return (
    <div className="mb-4 flex gap-4 overflow-x-auto border-b border-line">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={cn(
            'whitespace-nowrap border-b-2 border-transparent px-1 py-2.5 text-[13px] font-semibold text-muted',
            active === tab.key && 'border-accent text-accent-ink',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
