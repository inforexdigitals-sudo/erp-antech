import { FormEvent, useState } from 'react';
import { DownloadPdfButton } from '../../../components/DownloadPdfButton';
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
import { formatCurrency, formatDate } from '../../../lib/utils';
import { COST_CATEGORIES } from '../../shared/constants';
import { usePickerProjects, usePickerSuppliers } from '../../shared/hooks';
import { useCreatePurchaseOrder, usePurchaseOrder, usePurchaseOrderActions, usePurchaseOrders } from '../hooks';
import type { CreatePurchaseOrderInput, PoItemInput, PurchaseOrder, PurchaseOrderStatus } from '../api';

const STATUSES: PurchaseOrderStatus[] = ['draft', 'pending_approval', 'approved', 'rejected', 'issued', 'partially_received', 'received', 'closed', 'cancelled'];

/** Nothing has been committed to the project cost ledger yet in any of these — matches PurchaseOrdersService's EDITABLE_STATUSES. */
const EDITABLE_STATUSES: PurchaseOrderStatus[] = ['draft', 'pending_approval', 'rejected'];

function newItem(): PoItemInput {
  return { description: '', unit: '', quantity: 1, unitPrice: 0, costCategory: 'material' };
}

const COLUMNS: LineItemColumn<PoItemInput>[] = [
  { key: 'description', label: 'Description', type: 'text', width: '32%' },
  { key: 'unit', label: 'Unit', type: 'text', width: '12%' },
  { key: 'quantity', label: 'Qty', type: 'number', min: 0, step: 0.01, width: '12%' },
  { key: 'unitPrice', label: 'Unit Price', type: 'number', min: 0, step: 0.01, width: '14%' },
  { key: 'costCategory', label: 'Category', type: 'select', options: COST_CATEGORIES, width: '16%' },
];

function CreatePoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const suppliers = usePickerSuppliers();
  const projects = usePickerProjects();
  const create = useCreatePurchaseOrder();
  const [supplierId, setSupplierId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [items, setItems] = useState<PoItemInput[]>([newItem()]);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const input: CreatePurchaseOrderInput = { supplierId, projectId, expectedDeliveryDate: expectedDeliveryDate || undefined, items };
      await create.mutateAsync(input);
      onClose();
      setItems([newItem()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New Purchase Order" size="lg">
      <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          <Field label="Supplier" htmlFor="po-supplier">
            <Select id="po-supplier" required value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="" disabled>Select…</option>
              {suppliers.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="Project" htmlFor="po-project">
            <Select id="po-project" required value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="" disabled>Select…</option>
              {projects.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label="Expected Delivery" htmlFor="po-date">
            <Input id="po-date" type="date" value={expectedDeliveryDate} onChange={(e) => setExpectedDeliveryDate(e.target.value)} />
          </Field>
        </div>
        <LineItemsEditor items={items} onChange={setItems} columns={COLUMNS} newRow={newItem} />
        {error && <p className="text-[12.5px] text-critical">{error}</p>}
        <Button type="submit" variant="primary" disabled={create.isPending || !supplierId || !projectId} className="self-end">
          {create.isPending ? 'Creating…' : 'Create Purchase Order'}
        </Button>
      </form>
    </Modal>
  );
}

function EditPoModal({ po, onClose }: { po: PurchaseOrder; onClose: () => void }) {
  const { update } = usePurchaseOrderActions(po.id);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(po.expectedDeliveryDate ? po.expectedDeliveryDate.slice(0, 10) : '');
  const [paymentTerms, setPaymentTerms] = useState(po.paymentTerms ?? '');
  const [taxAmount, setTaxAmount] = useState(Number(po.taxAmount));
  const [items, setItems] = useState<PoItemInput[]>(
    po.items.map((i) => ({
      description: i.description,
      unit: i.unit,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unitPrice),
      costCategory: i.costCategory,
    })),
  );
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await update.mutateAsync({ expectedDeliveryDate: expectedDeliveryDate || undefined, paymentTerms: paymentTerms || undefined, taxAmount, items });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save these changes.');
    }
  }

  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

  return (
    <Modal open onClose={onClose} title={`Edit ${po.poNumber}`} size="lg">
      <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          <Field label="Expected Delivery" htmlFor="epo-date">
            <Input id="epo-date" type="date" value={expectedDeliveryDate} onChange={(e) => setExpectedDeliveryDate(e.target.value)} />
          </Field>
          <Field label="Payment Terms" htmlFor="epo-terms">
            <Input id="epo-terms" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} />
          </Field>
          <Field label="Tax Amount" htmlFor="epo-tax">
            <Input id="epo-tax" type="number" min={0} step={0.01} value={taxAmount} onChange={(e) => setTaxAmount(Number(e.target.value))} />
          </Field>
        </div>
        <LineItemsEditor items={items} onChange={setItems} columns={COLUMNS} newRow={newItem} />
        <div className="text-right text-sm text-muted">
          Total: <span className="num font-semibold text-ink">{formatCurrency(subtotal + taxAmount)}</span>
        </div>
        {error && <p className="text-[12.5px] text-critical">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={update.isPending}>
            {update.isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function DeliveryForm({ poId, items, onDone }: { poId: string; items: { id: string; description: string; quantity: string; quantityReceived: string }[]; onDone: () => void }) {
  const { recordDelivery } = usePurchaseOrderActions(poId);
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().slice(0, 10));
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  const outstanding = items.filter((i) => Number(i.quantityReceived) < Number(i.quantity));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const lines = Object.entries(quantities).filter(([, qty]) => qty > 0).map(([purchaseOrderItemId, quantityReceived]) => ({ purchaseOrderItemId, quantityReceived }));
    if (lines.length === 0) {
      setError('Enter a received quantity for at least one line.');
      return;
    }
    try {
      await recordDelivery.mutateAsync({ deliveryDate, items: lines });
      setQuantities({});
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not record this delivery.');
    }
  }

  if (outstanding.length === 0) return <EmptyNote>All lines fully received.</EmptyNote>;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2.5 border-t border-line p-4">
      <Field label="Delivery Date" htmlFor="delivery-date">
        <Input id="delivery-date" type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="max-w-[180px]" />
      </Field>
      {outstanding.map((item) => (
        <div key={item.id} className="flex items-center justify-between gap-2.5 text-[13px]">
          <span className="min-w-0 flex-1 truncate">{item.description} <span className="text-muted">({item.quantityReceived}/{item.quantity} received)</span></span>
          <Input
            type="number"
            min={0}
            step={0.01}
            className="w-28"
            value={quantities[item.id] ?? ''}
            onChange={(e) => setQuantities((q) => ({ ...q, [item.id]: Number(e.target.value) }))}
          />
        </div>
      ))}
      {error && <p className="text-[12.5px] text-critical">{error}</p>}
      <Button type="submit" variant="primary" disabled={recordDelivery.isPending} className="self-end">Record Delivery</Button>
    </form>
  );
}

function PoDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: po, isLoading, error } = usePurchaseOrder(id);
  const actions = usePurchaseOrderActions(id);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  async function run(fn: () => Promise<unknown>) {
    setActionError(null);
    try {
      await fn();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  }

  return (
    <Modal open onClose={onClose} title={po ? po.poNumber : 'Purchase Order'} size="lg">
      {isLoading && <div className="flex justify-center py-8"><Spinner /></div>}
      {error && <ErrorNote>{error instanceof ApiError ? error.message : 'Could not load this PO.'}</ErrorNote>}
      {po && (
        <div className="flex flex-col gap-3.5">
          <div className="flex items-center justify-between">
            <StatusPill domain="purchase_order" status={po.status} />
            <span className="text-xs text-muted">{po.supplier.name} · {po.project.name}</span>
          </div>
          <div className="flex justify-end gap-2">
            <DownloadPdfButton path={`/purchase-orders/${po.id}/pdf`} filename={`${po.poNumber}.pdf`} onError={setActionError} />
            {EDITABLE_STATUSES.includes(po.status) && <Button onClick={() => setEditing(true)}>Edit</Button>}
          </div>
          <TableWrap>
            <DataTable>
              <thead><tr><Th>Description</Th><Th numeric>Qty</Th><Th numeric>Received</Th><Th numeric>Unit Price</Th><Th numeric>Total</Th></tr></thead>
              <tbody>
                {po.items.map((item) => (
                  <Tr key={item.id}>
                    <Td>{item.description}</Td>
                    <Td numeric>{item.quantity} {item.unit}</Td>
                    <Td numeric>{item.quantityReceived}</Td>
                    <Td numeric>{formatCurrency(item.unitPrice)}</Td>
                    <Td numeric>{formatCurrency(item.lineTotal)}</Td>
                  </Tr>
                ))}
              </tbody>
            </DataTable>
          </TableWrap>
          <div className="ml-auto text-[13px] font-semibold">Total: {formatCurrency(po.total)}</div>

          {actionError && <ErrorNote>{actionError}</ErrorNote>}
          <div className="flex flex-wrap gap-2">
            {po.status === 'draft' && (
              <>
                <Button variant="primary" onClick={() => run(() => actions.submitForApproval.mutateAsync())}>Submit for Approval</Button>
                <Button onClick={() => run(() => actions.cancel.mutateAsync(undefined))}>Cancel</Button>
              </>
            )}
            {po.status === 'pending_approval' && (
              <>
                <Button variant="primary" onClick={() => run(() => actions.approve.mutateAsync())}>Approve</Button>
                <Button onClick={() => run(() => actions.reject.mutateAsync())}>Reject</Button>
                <Button onClick={() => run(() => actions.cancel.mutateAsync(undefined))}>Cancel</Button>
              </>
            )}
            {po.status === 'approved' && (
              <Button variant="primary" onClick={() => run(() => actions.issue.mutateAsync())}>Issue to Supplier</Button>
            )}
          </div>

          {(po.status === 'issued' || po.status === 'partially_received') && (
            <div>
              <h3 className="mb-2 text-[13px] font-semibold">Record Delivery</h3>
              <Card><DeliveryForm poId={id} items={po.items} onDone={() => {}} /></Card>
            </div>
          )}

          {po.deliveries.length > 0 && (
            <div>
              <h3 className="mb-2 text-[13px] font-semibold">Delivery History</h3>
              <div className="flex flex-col gap-1.5 text-[13px] text-muted">
                {po.deliveries.map((d) => (
                  <div key={d.id}>{d.deliveryNumber} — {formatDate(d.deliveryDate)} ({d.status})</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {po && editing && <EditPoModal po={po} onClose={() => setEditing(false)} />}
    </Modal>
  );
}

export function PurchaseOrdersTab() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const { data, isLoading, error } = usePurchaseOrders({ page, pageSize: 20, status: status || undefined });

  return (
    <div>
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="max-w-[200px]">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </Select>
        <Button variant="primary" onClick={() => setCreateOpen(true)}>+ New Purchase Order</Button>
      </div>

      <Card>
        {isLoading && <div className="flex justify-center py-8"><Spinner /></div>}
        {error && <ErrorNote>{error instanceof ApiError ? error.message : 'Could not load purchase orders.'}</ErrorNote>}
        {data && (
          <>
            <TableWrap>
              <DataTable>
                <thead><tr><Th>PO</Th><Th>Supplier</Th><Th>Project</Th><Th>Status</Th><Th numeric>Total</Th></tr></thead>
                <tbody>
                  {data.data.length === 0 && <tr><td colSpan={5}><EmptyNote>No purchase orders yet.</EmptyNote></td></tr>}
                  {data.data.map((po) => (
                    <Tr key={po.id} className="cursor-pointer" onClick={() => setDetailId(po.id)}>
                      <Td className="font-semibold">{po.poNumber}</Td>
                      <Td>{po.supplier.name}</Td>
                      <Td>{po.project.name}</Td>
                      <Td><StatusPill domain="purchase_order" status={po.status} /></Td>
                      <Td numeric>{formatCurrency(po.total)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </DataTable>
            </TableWrap>
            <Pagination page={page} pageSize={20} total={data.meta.total} onPageChange={setPage} />
          </>
        )}
      </Card>

      <CreatePoModal open={createOpen} onClose={() => setCreateOpen(false)} />
      {detailId && <PoDetailModal id={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}
