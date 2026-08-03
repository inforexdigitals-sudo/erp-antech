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
import { formatCurrency } from '../../../lib/utils';
import { usePickerProjects, usePickerSuppliers } from '../../shared/hooks';
import { useCreateRfq, useRfq, useRfqActions, useRfqs } from '../hooks';
import type { RfqItemInput, RfqStatus } from '../rfqs-api';

const STATUSES: RfqStatus[] = ['draft', 'sent', 'responses_received', 'closed'];

function newItem(): RfqItemInput {
  return { description: '', unit: '', quantity: 1 };
}

const COLUMNS: LineItemColumn<RfqItemInput>[] = [
  { key: 'description', label: 'Description', type: 'text', width: '50%' },
  { key: 'unit', label: 'Unit', type: 'text', width: '25%' },
  { key: 'quantity', label: 'Qty', type: 'number', min: 0, step: 0.01, width: '25%' },
];

function CreateModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const projects = usePickerProjects();
  const suppliers = usePickerSuppliers();
  const create = useCreateRfq();
  const [projectId, setProjectId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [supplierIds, setSupplierIds] = useState<string[]>([]);
  const [items, setItems] = useState<RfqItemInput[]>([newItem()]);
  const [error, setError] = useState<string | null>(null);

  function toggleSupplier(id: string) {
    setSupplierIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await create.mutateAsync({ projectId: projectId || undefined, dueDate: dueDate || undefined, items, supplierIds: supplierIds.length ? supplierIds : undefined });
      onClose();
      setItems([newItem()]);
      setSupplierIds([]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New RFQ" size="lg">
      <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <Field label="Project" htmlFor="rfq-project">
            <Select id="rfq-project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">None</option>
              {projects.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label="Due Date" htmlFor="rfq-due">
            <Input id="rfq-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
        </div>
        <LineItemsEditor items={items} onChange={setItems} columns={COLUMNS} newRow={newItem} />
        <div>
          <div className="mb-1.5 text-[11.5px] font-semibold text-muted">Send to Suppliers</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {suppliers.data?.map((s) => (
              <label key={s.id} className="flex items-center gap-1.5 text-[13px]">
                <input type="checkbox" checked={supplierIds.includes(s.id)} onChange={() => toggleSupplier(s.id)} />
                {s.name}
              </label>
            ))}
            {!suppliers.data?.length && <span className="text-xs text-muted">No active suppliers yet.</span>}
          </div>
        </div>
        {error && <p className="text-[12.5px] text-critical">{error}</p>}
        <Button type="submit" variant="primary" disabled={create.isPending} className="self-end">
          {create.isPending ? 'Creating…' : 'Create RFQ'}
        </Button>
      </form>
    </Modal>
  );
}

function RecordResponseForm({ rfqId, items, onDone }: { rfqId: string; items: { id: string; description: string }[]; onDone: () => void }) {
  const suppliers = usePickerSuppliers();
  const { recordResponse } = useRfqActions(rfqId);
  const [supplierId, setSupplierId] = useState('');
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await recordResponse.mutateAsync({
        supplierId,
        items: items.map((i) => ({ rfqItemId: i.id, unitPrice: prices[i.id] ?? 0, quantity: 1 })),
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not record this response.');
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2.5 border-t border-line p-4">
      <Field label="Supplier" htmlFor="resp-supplier">
        <Select id="resp-supplier" required value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="max-w-[240px]">
          <option value="" disabled>Select…</option>
          {suppliers.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
      </Field>
      {items.map((item) => (
        <div key={item.id} className="flex items-center justify-between gap-2.5 text-[13px]">
          <span className="min-w-0 flex-1 truncate">{item.description}</span>
          <Input type="number" min={0} step={0.01} className="w-28" value={prices[item.id] ?? ''} onChange={(e) => setPrices((p) => ({ ...p, [item.id]: Number(e.target.value) }))} />
        </div>
      ))}
      {error && <p className="text-[12.5px] text-critical">{error}</p>}
      <Button type="submit" variant="primary" disabled={!supplierId || recordResponse.isPending} className="self-end">Record Response</Button>
    </form>
  );
}

function DetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: rfq, isLoading, error } = useRfq(id);
  const actions = useRfqActions(id);
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
    <Modal open onClose={onClose} title={rfq ? rfq.rfqNumber : 'RFQ'} size="lg">
      {isLoading && <div className="flex justify-center py-8"><Spinner /></div>}
      {error && <ErrorNote>{error instanceof ApiError ? error.message : 'Could not load this RFQ.'}</ErrorNote>}
      {rfq && (
        <div className="flex flex-col gap-3.5">
          <div className="flex items-center justify-between">
            <StatusPill domain="rfq" status={rfq.status} />
            <span className="text-xs text-muted">{rfq.recipients.length} recipient{rfq.recipients.length === 1 ? '' : 's'}</span>
          </div>

          <TableWrap>
            <DataTable>
              <thead><tr><Th>Description</Th><Th numeric>Qty</Th></tr></thead>
              <tbody>{rfq.items.map((item) => (<Tr key={item.id}><Td>{item.description}</Td><Td numeric>{item.quantity} {item.unit}</Td></Tr>))}</tbody>
            </DataTable>
          </TableWrap>

          {actionError && <ErrorNote>{actionError}</ErrorNote>}
          {rfq.status === 'draft' && (
            <Button variant="primary" className="self-start" onClick={() => run(() => actions.send.mutateAsync())} disabled={rfq.recipients.length === 0}>
              Send to Suppliers
            </Button>
          )}

          {rfq.responses.length > 0 && (
            <div>
              <h3 className="mb-2 text-[13px] font-semibold">Responses</h3>
              <TableWrap>
                <DataTable>
                  <thead><tr><Th>Supplier</Th><Th numeric>Total</Th><Th numeric>Lead Time</Th><Th></Th></tr></thead>
                  <tbody>
                    {rfq.responses.map((r) => (
                      <Tr key={r.id}>
                        <Td>{r.supplier.name} {r.isSelected && <StatusPill domain="rfq" status="closed" />}</Td>
                        <Td numeric>{r.totalAmount ? formatCurrency(r.totalAmount) : '—'}</Td>
                        <Td numeric>{r.leadTimeDays ?? '—'} days</Td>
                        <Td>
                          {rfq.status !== 'closed' && (
                            <Button size="sm" onClick={() => run(() => actions.selectResponse.mutateAsync(r.id))}>Select</Button>
                          )}
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </DataTable>
              </TableWrap>
            </div>
          )}

          {rfq.status !== 'draft' && rfq.status !== 'closed' && (
            <div>
              <h3 className="mb-2 text-[13px] font-semibold">Record a Response</h3>
              <Card><RecordResponseForm rfqId={id} items={rfq.items} onDone={() => {}} /></Card>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

export function RfqsTab() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const { data, isLoading, error } = useRfqs({ page, pageSize: 20, status: status || undefined });

  return (
    <div>
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="max-w-[200px]">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </Select>
        <Button variant="primary" onClick={() => setCreateOpen(true)}>+ New RFQ</Button>
      </div>

      <Card>
        {isLoading && <div className="flex justify-center py-8"><Spinner /></div>}
        {error && <ErrorNote>{error instanceof ApiError ? error.message : 'Could not load RFQs.'}</ErrorNote>}
        {data && (
          <>
            <TableWrap>
              <DataTable>
                <thead><tr><Th>RFQ</Th><Th>Project</Th><Th>Status</Th><Th numeric>Responses</Th></tr></thead>
                <tbody>
                  {data.data.length === 0 && <tr><td colSpan={4}><EmptyNote>No RFQs yet.</EmptyNote></td></tr>}
                  {data.data.map((rfq) => (
                    <Tr key={rfq.id} className="cursor-pointer" onClick={() => setDetailId(rfq.id)}>
                      <Td className="font-semibold">{rfq.rfqNumber}</Td>
                      <Td>{rfq.project?.name ?? '—'}</Td>
                      <Td><StatusPill domain="rfq" status={rfq.status} /></Td>
                      <Td numeric>{rfq.responses.length}</Td>
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
