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
import { formatCurrency, formatDate, titleCase } from '../../../lib/utils';
import { useClaims } from '../hooks';
import type { ClaimStatus } from '../api';

const STATUSES: ClaimStatus[] = ['draft', 'submitted', 'under_review', 'certified', 'rejected', 'paid'];

export function ClaimsListPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const navigate = useNavigate();
  const { data, isLoading, error } = useClaims({ page, pageSize: 20, status: status || undefined });

  return (
    <div>
      <PageHeader
        eyebrow="Commercials"
        title="Progress Claims"
        actions={<Button variant="primary" onClick={() => navigate('/claims/new')}>+ New Claim</Button>}
      />

      <div className="mb-3.5">
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="max-w-[200px]">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
        </Select>
      </div>

      <Card>
        {isLoading && <div className="flex justify-center py-8"><Spinner /></div>}
        {error && <ErrorNote>{error instanceof ApiError ? error.message : 'Could not load claims.'}</ErrorNote>}
        {data && (
          <>
            <TableWrap>
              <DataTable>
                <thead>
                  <tr>
                    <Th>Claim</Th>
                    <Th>Project</Th>
                    <Th>Type</Th>
                    <Th>Status</Th>
                    <Th numeric>Net Amount</Th>
                    <Th>Period</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.length === 0 && <tr><td colSpan={6}><EmptyNote>No claims yet.</EmptyNote></td></tr>}
                  {data.data.map((c) => (
                    <Tr key={c.id} className="cursor-pointer" onClick={() => navigate(`/claims/${c.id}`)}>
                      <Td className="font-semibold">{c.claimNumber}</Td>
                      <Td>{c.project.name}</Td>
                      <Td className="capitalize">{c.claimType}</Td>
                      <Td><StatusPill domain="claim" status={c.status} /></Td>
                      <Td numeric>{formatCurrency(c.netClaimAmount)}</Td>
                      <Td>{formatDate(c.claimPeriodStart)} – {formatDate(c.claimPeriodEnd)}</Td>
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
