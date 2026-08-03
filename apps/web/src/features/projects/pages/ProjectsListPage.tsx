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
import { useProjects } from '../hooks';
import type { ProjectStatus } from '../api';

const STATUSES: ProjectStatus[] = ['planning', 'active', 'on_hold', 'completed', 'closed', 'cancelled'];

export function ProjectsListPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const navigate = useNavigate();
  const { data, isLoading, error } = useProjects({ page, pageSize: 20, status: status || undefined });

  return (
    <div>
      <PageHeader
        eyebrow="Delivery"
        title="Projects"
        actions={
          <>
            <Button onClick={() => navigate('/projects/import')}>Import from PDF</Button>
            <Button variant="primary" onClick={() => navigate('/projects/new')}>+ New Project</Button>
          </>
        }
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
        {error && <ErrorNote>{error instanceof ApiError ? error.message : 'Could not load projects.'}</ErrorNote>}
        {data && (
          <>
            <TableWrap>
              <DataTable>
                <thead>
                  <tr>
                    <Th>Project</Th>
                    <Th>Customer</Th>
                    <Th>Status</Th>
                    <Th numeric>Contract Value</Th>
                    <Th>Planned End</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.length === 0 && (
                    <tr><td colSpan={5}><EmptyNote>No projects yet.</EmptyNote></td></tr>
                  )}
                  {data.data.map((p) => (
                    <Tr key={p.id} className="cursor-pointer" onClick={() => navigate(`/projects/${p.id}`)}>
                      <Td>
                        <div className="font-semibold">{p.name}</div>
                        <div className="text-xs text-muted">{p.projectNumber}</div>
                      </Td>
                      <Td>{p.customer.name}</Td>
                      <Td><StatusPill domain="project" status={p.status} /></Td>
                      <Td numeric>{formatCurrency(p.contractValue)}</Td>
                      <Td>{formatDate(p.plannedEndDate)}</Td>
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
