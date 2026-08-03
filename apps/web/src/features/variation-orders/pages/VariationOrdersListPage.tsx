import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../../components/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { EmptyNote, ErrorNote, Spinner } from '../../../components/ui/Feedback';
import { Select } from '../../../components/ui/Select';
import { StatusPill } from '../../../components/ui/StatusPill';
import { DataTable, Td, Th, TableWrap, Tr } from '../../../components/ui/Table';
import { Pagination } from '../../../components/ui/Pagination';
import { ApiError } from '../../../lib/api-client';
import { formatCurrency, titleCase } from '../../../lib/utils';
import { useVariationOrders } from '../hooks';
import type { VariationOrderStatus } from '../api';

const STATUSES: VariationOrderStatus[] = ['draft', 'pending_approval', 'approved', 'rejected', 'client_signoff_pending', 'client_approved'];

export function VariationOrdersListPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const navigate = useNavigate();
  const { data, isLoading, error } = useVariationOrders({ page, pageSize: 20, status: status || undefined });

  return (
    <div>
      <PageHeader
        eyebrow="Commercials"
        title="Variation Orders"
        actions={<Button variant="primary" onClick={() => navigate('/variation-orders/new')}>+ New Variation Order</Button>}
      />

      <div className="mb-3.5">
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="max-w-[220px]">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
        </Select>
      </div>

      <Card>
        {isLoading && <div className="flex justify-center py-8"><Spinner /></div>}
        {error && <ErrorNote>{error instanceof ApiError ? error.message : 'Could not load variation orders.'}</ErrorNote>}
        {data && (
          <>
            <TableWrap>
              <DataTable>
                <thead>
                  <tr>
                    <Th>VO</Th>
                    <Th>Project</Th>
                    <Th>Cause</Th>
                    <Th>Status</Th>
                    <Th numeric>Cost Impact</Th>
                    <Th numeric>Revenue Impact</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.length === 0 && <tr><td colSpan={6}><EmptyNote>No variation orders yet.</EmptyNote></td></tr>}
                  {data.data.map((vo) => (
                    <Tr key={vo.id} className="cursor-pointer" onClick={() => navigate(`/variation-orders/${vo.id}`)}>
                      <Td>
                        <div className="font-semibold">{vo.voNumber}</div>
                        <div className="text-xs text-muted">{vo.title}</div>
                      </Td>
                      <Td>{vo.project.name}</Td>
                      <Td className="capitalize">{vo.cause.replace(/_/g, ' ')}</Td>
                      <Td><StatusPill domain="variation_order" status={vo.status} /></Td>
                      <Td numeric>{formatCurrency(vo.costImpact)}</Td>
                      <Td numeric>{formatCurrency(vo.revenueImpact)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </DataTable>
            </TableWrap>
            <Pagination page={page} pageSize={20} total={data.meta.total} onPageChange={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}
