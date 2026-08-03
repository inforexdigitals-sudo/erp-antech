import { FormEvent, useState } from 'react';
import { LineItemsEditor, type LineItemColumn } from '../../../components/LineItemsEditor';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { EmptyNote, ErrorNote, Spinner } from '../../../components/ui/Feedback';
import { Field, Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Pagination } from '../../../components/ui/Pagination';
import { Select } from '../../../components/ui/Select';
import { StatusPill } from '../../../components/ui/StatusPill';
import { DataTable, Td, Th, TableWrap, Tr } from '../../../components/ui/Table';
import { ApiError } from '../../../lib/api-client';
import { formatDate } from '../../../lib/utils';
import { usePickerProjects } from '../../shared/hooks';
import { useCreateMaterialRequest, useMaterialRequest, useMaterialRequestActions, useMaterialRequests } from '../hooks';
import type { MaterialRequestItemInput, MaterialRequestStatus } from '../material-requests-api';

const STATUSES: MaterialRequestStatus[] = ['draft', 'submitted', 'under_review', 'approved', 'rejected', 'converted_to_po'];

function newItem(): MaterialRequestItemInput {
  return { description: '', unit: '', quantity: 1 };
}

const COLUMNS: LineItemColumn<MaterialRequestItemInput>[] = [
  { key: 'description', label: 'Description', type: 'text', width: '40%' },
  { key: 'unit', label: 'Unit', type: 'text', width: '20%' },
  { key: 'quantity', label: 'Qty', type: 'number', min: 0, step: 0.01, width: '20%' },
  { key: 'estimatedUnitCost', label: 'Est. Unit Cost', type: 'number', min: 0, step: 0.01, width: '20%' },
];

function CreateModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const projects = usePickerProjects();
  const create = useCreateMaterialRequest();
  const [projectId, setProjectId] = useState('');
  const [neededByDate, setNeededByDate] = useState('');
  const [items, setItems] = useState<MaterialRequestItemInput[]>([newItem()]);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await create.mutateAsync({ projectId, neededByDate: neededByDate || undefined, items });
      onClose();
      setItems([newItem()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New Material Request" size="lg">
      <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <Field label="Project" htmlFor="mr-project">
            <Select id="mr-project" required value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="" disabled>Select…</option>
              {projects.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label="Needed By" htmlFor="mr-date">
            <Input id="mr-date" type="date" value={neededByDate} onChange={(e) => setNeededByDate(e.target.value)} />
          </Field>
        </div>
        <LineItemsEditor items={items} onChange={setItems} columns={COLUMNS} newRow={newItem} />
        {error && <p className="text-[12.5px] text-critical">{error}</p>}
        <Button type="submit" variant="primary" disabled={create.isPending || !projectId} className="self-end">
          {create.isPending ? 'Creating…' : 'Create Request'}
        </Button>
      </form>
    </Modal>
  );
}

function DetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: mr, isLoading, error } = useMaterialRequest(id);
  const actions = useMaterialRequestActions(id);
  const [actionError, setActionError] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>) {
    setActionError(null);
    try {
      await fn();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  }

  return (
    <Modal open onClose={onClose} title={mr ? mr.requestNumber : 'Material Request'} size="lg">
      {isLoading && <div className="flex justify-center py-8"><Spinner /></div>}
      {error && <ErrorNote>{error instanceof ApiError ? error.message : 'Could not load this request.'}</ErrorNote>}
      {mr && (
        <div className="flex flex-col gap-3.5">
          <div className="flex items-center justify-between">
            <StatusPill domain="material_request" status={mr.status} />
            <span className="text-xs text-muted">{mr.project.name} · requested by {mr.requester.fullName}</span>
          </div>
          <TableWrap>
            <DataTable>
              <thead><tr><Th>Description</Th><Th numeric>Qty</Th><Th numeric>Est. Cost</Th></tr></thead>
              <tbody>
                {mr.items.map((item) => (
                  <Tr key={item.id}>
                    <Td>{item.description}</Td>
                    <Td numeric>{item.quantity} {item.unit}</Td>
                    <Td numeric>{item.estimatedUnitCost ?? '—'}</Td>
                  </Tr>
                ))}
              </tbody>
            </DataTable>
          </TableWrap>
          {actionError && <ErrorNote>{actionError}</ErrorNote>}
          <div className="flex gap-2">
            {mr.status === 'draft' && (
              <Button variant="primary" onClick={() => run(() => actions.submitForApproval.mutateAsync())}>Submit for Approval</Button>
            )}
            {mr.status === 'under_review' && (
              <>
                <Button variant="primary" onClick={() => run(() => actions.approve.mutateAsync())}>Approve</Button>
                <Button onClick={() => run(() => actions.reject.mutateAsync())}>Reject</Button>
              </>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

export function MaterialRequestsTab() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const { data, isLoading, error } = useMaterialRequests({ page, pageSize: 20, status: status || undefined });

  return (
    <div>
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="max-w-[200px]">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </Select>
        <Button variant="primary" onClick={() => setCreateOpen(true)}>+ New Material Request</Button>
      </div>

      <Card>
        {isLoading && <div className="flex justify-center py-8"><Spinner /></div>}
        {error && <ErrorNote>{error instanceof ApiError ? error.message : 'Could not load material requests.'}</ErrorNote>}
        {data && (
          <>
            <TableWrap>
              <DataTable>
                <thead><tr><Th>Request</Th><Th>Project</Th><Th>Status</Th><Th>Needed By</Th></tr></thead>
                <tbody>
                  {data.data.length === 0 && <tr><td colSpan={4}><EmptyNote>No material requests yet.</EmptyNote></td></tr>}
                  {data.data.map((mr) => (
                    <Tr key={mr.id} className="cursor-pointer" onClick={() => setDetailId(mr.id)}>
                      <Td className="font-semibold">{mr.requestNumber}</Td>
                      <Td>{mr.project.name}</Td>
                      <Td><StatusPill domain="material_request" status={mr.status} /></Td>
                      <Td>{formatDate(mr.neededByDate)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </DataTable>
            </TableWrap>
            <Pagination page={page} pageSize={20} total={data.meta.total} onPageChange={setPage} />
          </>
        )}
      </Card>

      <CreateModal open={createOpen} onClose={() => setCreateOpen(false)} />
      {detailId && <DetailModal id={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}
