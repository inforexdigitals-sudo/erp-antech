import { useState } from 'react';
import { PageHeader } from '../../../components/PageHeader';
import { Tabs } from '../../../components/ui/Tabs';
import { RolesTab } from '../../user-management/pages/RolesTab';
import { UsersTab } from '../../user-management/pages/UsersTab';
import { CompanyProfileTab } from './CompanyProfileTab';

export function SettingsPage() {
  const [tab, setTab] = useState('company');

  return (
    <div>
      <PageHeader
        eyebrow="Insight & Admin"
        title="Settings & RBAC"
        subtitle="Company letterhead, user accounts, and role-based access."
      />
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'company', label: 'Company Profile' },
          { key: 'users', label: 'Users' },
          { key: 'roles', label: 'Roles' },
        ]}
      />
      {tab === 'company' && <CompanyProfileTab />}
      {tab === 'users' && <UsersTab />}
      {tab === 'roles' && <RolesTab />}
    </div>
  );
}
