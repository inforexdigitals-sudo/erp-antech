import { useState } from 'react';
import { PageHeader } from '../../../components/PageHeader';
import { Tabs } from '../../../components/ui/Tabs';
import { LeaveTab } from './LeaveTab';
import { TimesheetsTab } from './TimesheetsTab';

export function TimesheetsPage() {
  const [tab, setTab] = useState('timesheets');

  return (
    <div>
      <PageHeader eyebrow="Workforce" title="Timesheets" />
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'timesheets', label: 'Timesheets' },
          { key: 'leave', label: 'Leave' },
        ]}
      />
      {tab === 'timesheets' && <TimesheetsTab />}
      {tab === 'leave' && <LeaveTab />}
    </div>
  );
}
