import { useState } from 'react';
import { PageHeader } from '../../../components/PageHeader';
import { Tabs } from '../../../components/ui/Tabs';
import { PeriodsTab } from './PeriodsTab';
import { StatutoryRulesTab } from './StatutoryRulesTab';

export function PayrollPage() {
  const [tab, setTab] = useState('periods');

  return (
    <div>
      <PageHeader eyebrow="Workforce" title="Payroll" />
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'periods', label: 'Periods' },
          { key: 'rules', label: 'Statutory Rules' },
        ]}
      />
      {tab === 'periods' && <PeriodsTab />}
      {tab === 'rules' && <StatutoryRulesTab />}
    </div>
  );
}
