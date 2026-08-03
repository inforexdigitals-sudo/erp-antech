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
import { formatCurrency, formatDate } from '../../../lib/utils';
import { useQuotations } from '../hooks';
import type { QuotationStatus } from '../api';

const STATUSES: QuotationStatus[] = ['draft', 'pending_approval', 'approved', 'sent', 'accepted', 'rejected', 'expired', 'converted'];

export function QuotationsListPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuotations({ page, pageSize: 20, status: status || undefined });

  return (
    <div>
      <PageHeader
        eyebrow="Delivery"
        title="Quotations"
        actions={<Button variant="primary" onClick={() => navigate('/quotations/new')}>+ New Quotation</Button>}
      />

      <div className="mb-3.5">
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="max-w-[200px]">
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </Select>
      </div>

      <Card>
        {isLoading && <div className="flex justify-center py-8"><Spinner /></div>}
        {error && <ErrorNote>{error instanceof ApiError ? error.message : 'Could not load quotations.'}</ErrorNote>}
        {data && (
          <>
            <TableWrap>
              <DataTable>
                <thead>
                  <tr>
                    <Th>Quotation</Th>
                    <Th>Customer</Th>
                    <Th>Status</Th>
                    <Th numeric>Total</Th>
                    <Th>Valid Until</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.length === 0 && (
                    <tr><td colSpan={5}><EmptyNote>No quotations yet — create one to get started.</EmptyNote></td></tr>
                  )}
                  {data.data.map((q) => (
                    <Tr key={q.id} className="cursor-pointer" onClick={() => navigate(`/quotations/${q.id}`)}>
                      <Td>
                        <div className="font-semibold">{q.quotationNumber}</div>
                        <div className="text-xs text-muted">{q.title}</div>
                      </Td>
                      <Td>{q.customer.name}</Td>
                      <Td><StatusPill domain="quotation" status={q.status} /></Td>
                      <Td numeric>{q.currentRevision ? formatCurrency(q.currentRevision.total) : '—'}</Td>
                      <Td>{q.validUntil ? formatDate(q.validUntil) : '—'}</Td>
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
