import { useState } from 'react';
import { PageHeader } from '../../../components/PageHeader';
import { Tabs } from '../../../components/ui/Tabs';
import { PurchaseOrdersTab } from '../../purchase-orders/pages/PurchaseOrdersTab';
import { SubcontractorsPage } from '../../subcontractors/pages/SubcontractorsPage';
import { SuppliersPage } from '../../suppliers/pages/SuppliersPage';
import { MaterialRequestsTab } from './MaterialRequestsTab';
import { RfqsTab } from './RfqsTab';

export function ProcurementPage() {
  const [tab, setTab] = useState('purchase-orders');

  return (
    <div>
      <PageHeader eyebrow="Delivery" title="Procurement & PO" />
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'purchase-orders', label: 'Purchase Orders' },
          { key: 'material-requests', label: 'Material Requests' },
          { key: 'rfqs', label: 'RFQs' },
          { key: 'suppliers', label: 'Suppliers' },
          { key: 'subcontractors', label: 'Subcontractors' },
        ]}
      />
      {tab === 'purchase-orders' && <PurchaseOrdersTab />}
      {tab === 'material-requests' && <MaterialRequestsTab />}
      {tab === 'rfqs' && <RfqsTab />}
      {tab === 'suppliers' && <SuppliersPage />}
      {tab === 'subcontractors' && <SubcontractorsPage />}
    </div>
  );
}
