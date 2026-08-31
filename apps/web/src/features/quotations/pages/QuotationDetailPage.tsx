import { FormEvent, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DownloadPdfButton } from '../../../components/DownloadPdfButton';
import { LineItemsEditor, type LineItemColumn } from '../../../components/LineItemsEditor';
import { PageHeader } from '../../../components/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { ErrorNote, Spinner } from '../../../components/ui/Feedback';
import { Field, Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Select, Textarea } from '../../../components/ui/Select';
import { StatusPill } from '../../../components/ui/StatusPill';
import { DataTable, Td, Th, TableWrap, Tr } from '../../../components/ui/Table';
import { ApiError } from '../../../lib/api-client';
import { formatCurrency, formatDate } from '../../../lib/utils';
import { useAuthStore } from '../../../stores/auth-store';
import { useCustomers } from '../../shared/hooks';
import { useAddQuotationRevision, useQuotation, useQuotationActions } from '../hooks';
import type { Quotation, QuotationItemInput, QuotationStatus } from '../api';

/** Header changes (title/customer/valid-until) only apply while draft or pending_approval — same as the backend's EDITABLE_HEADER_STATUSES. Item/pricing revisions also work once rejected, to re-quote without touching the header. */
const HEADER_EDITABLE_STATUSES: QuotationStatus[] = ['draft', 'pending_approval'];
const EDITABLE_STATUSES: QuotationStatus[] = ['draft', 'pending_approval', 'rejected'];
/** Matches the backend's remove() guard — anything past draft has been submitted, sent, or converted, so reject/expire it instead of deleting. */
const DELETABLE_STATUSES: QuotationStatus[] = ['draft'];

/** unit isn't shown as a column — not meaningful enough to warrant the space here — but the backend still requires a non-empty string, so existing values pass through unedited and new rows default to it. */
function newItem(): QuotationItemInput {
  return { description: '', category: 'material', unit: 'unit', quantity: 1, unitCost: 0, unitPrice: 0 };
}

const ITEM_COLUMNS: LineItemColumn<QuotationItemInput>[] = [
  { key: 'description', label: 'Description', type: 'text', width: '32%' },
  { key: 'category', label: 'Category', type: 'select', options: ['material', 'labour', 'equipment', 'subcontractor'], width: '16%' },
  { key: 'quantity', label: 'Qty', type: 'number', min: 0, step: 0.01, width: '12%' },
  { key: 'unitCost', label: 'Unit Cost', type: 'number', min: 0, step: 0.01, width: '14%' },
  { key: 'unitPrice', label: 'Unit Price', type: 'number', min: 0, step: 0.01, width: '14%' },
];

function EditQuotationModal({ quotation, onClose }: { quotation: Quotation; onClose: () => void }) {
  const customers = useCustomers();
  const actions = useQuotationActions(quotation.id);
  const addRevision = useAddQuotationRevision(quotation.id);
  const canEditHeader = HEADER_EDITABLE_STATUSES.includes(quotation.status);
  const rev = quotation.currentRevision;

  const [title, setTitle] = useState(quotation.title);
  const [customerId, setCustomerId] = useState(quotation.customer.id);
  const [validUntil, setValidUntil] = useState(quotation.validUntil ? quotation.validUntil.slice(0, 10) : '');
  const [discountAmount, setDiscountAmount] = useState(rev ? Number(rev.discountAmount) : 0);
  const [notes, setNotes] = useState(rev?.notes ?? '');
  const [items, setItems] = useState<QuotationItemInput[]>(
    rev && rev.items.length > 0
      ? rev.items.map((i) => ({
          description: i.description,
          category: i.category,
          unit: i.unit,
          quantity: Number(i.quantity),
          unitCost: Number(i.unitCost),
          unitPrice: Number(i.unitPrice),
        }))
      : [newItem()],
  );
  const [error, setError] = useState<string | null>(null);
  const submitting = actions.updateHeader.isPending || addRevision.isPending;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (canEditHeader) {
        await actions.updateHeader.mutateAsync({ title, customerId, validUntil: validUntil || undefined });
      }
      await addRevision.mutateAsync({ items, discountAmount: discountAmount || undefined, notes: notes || undefined });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save these changes.');
    }
  }

  const estimatedTotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0) - discountAmount;

  return (
    <Modal open onClose={onClose} title={`Edit ${quotation.quotationNumber}`} size="lg">
      <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
        {!canEditHeader && (
          <p className="text-xs text-muted">
            This quotation was rejected, so the title/customer/valid-until are locked — only the line items below can
            be revised (creating a new revision to re-quote).
          </p>
        )}
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          <Field label="Title" htmlFor="eq-title">
            <Input id="eq-title" required disabled={!canEditHeader} value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Customer" htmlFor="eq-customer">
            <Select id="eq-customer" required disabled={!canEditHeader} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              {customers.data?.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Valid Until" htmlFor="eq-valid">
            <Input id="eq-valid" type="date" disabled={!canEditHeader} value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </Field>
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-[13.5px] font-semibold">Line Items</h3>
          <LineItemsEditor items={items} onChange={setItems} columns={ITEM_COLUMNS} newRow={newItem} />
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <Field label="Discount Amount" htmlFor="eq-discount">
              <Input
                id="eq-discount"
                type="number"
                min={0}
                step={0.01}
                value={discountAmount}
                onChange={(e) => setDiscountAmount(Number(e.target.value))}
              />
            </Field>
            <div className="flex flex-col justify-end text-sm text-muted sm:col-span-2">
              Estimated total (before tax): <span className="num font-semibold text-ink">${estimatedTotal.toFixed(2)}</span>
            </div>
          </div>
          <Field label="Notes" htmlFor="eq-notes">
            <Textarea id="eq-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>

        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteQuotationModal({ quotation, onClose, onDeleted }: { quotation: Quotation; onClose: () => void; onDeleted: () => void }) {
  const actions = useQuotationActions(quotation.id);
  const [error, setError] = useState<string | null>(null);

  async function onConfirm() {
    setError(null);
    try {
      await actions.remove.mutateAsync();
      onDeleted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete this quotation.');
    }
  }

  return (
    <Modal open onClose={onClose} title={`Delete ${quotation.quotationNumber}?`}>
      <div className="flex flex-col gap-3.5">
        <p className="text-[13px]">
          This permanently deletes <strong>{quotation.quotationNumber}</strong> ({quotation.title}) and its revision
          history. This can&apos;t be undone.
        </p>
        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button
            type="button"
            variant="primary"
            className="border-critical bg-critical hover:border-critical hover:bg-critical/90"
            onClick={onConfirm}
            disabled={actions.remove.isPending}
          >
            {actions.remove.isPending ? 'Deleting…' : 'Delete Quotation'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: quotation, isLoading, error } = useQuotation(id);
  const actions = useQuotationActions(id!);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (error) return <ErrorNote>{error instanceof ApiError ? error.message : 'Could not load this quotation.'}</ErrorNote>;
  if (!quotation) return null;

  async function run(action: () => Promise<unknown>) {
    setActionError(null);
    try {
      await action();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  }

  const rev = quotation.currentRevision;

  return (
    <div>
      <PageHeader
        eyebrow="Delivery"
        title={
          <span className="flex items-center gap-2.5">
            {quotation.quotationNumber}
            <StatusPill domain="quotation" status={quotation.status} />
          </span>
        }
        subtitle={`${quotation.title} · ${quotation.customer.name}`}
        actions={
          <>
            <DownloadPdfButton
              path={`/quotations/${quotation.id}/pdf`}
              filename={`${quotation.quotationNumber}.pdf`}
              onError={setActionError}
            />
            {EDITABLE_STATUSES.includes(quotation.status) && (
              <Button onClick={() => setEditing(true)}>Edit</Button>
            )}
            {DELETABLE_STATUSES.includes(quotation.status) && (
              <Button onClick={() => setDeleting(true)} className="text-critical">Delete</Button>
            )}
            {quotation.status === 'draft' && (
              <Button variant="primary" onClick={() => run(() => actions.submitForApproval.mutateAsync())} disabled={actions.submitForApproval.isPending}>
                Submit for Approval
              </Button>
            )}
            {quotation.status === 'pending_approval' && hasPermission('quotation.approve') && (
              <>
                <Button variant="primary" onClick={() => run(() => actions.approve.mutateAsync(undefined))} disabled={actions.approve.isPending}>
                  Approve
                </Button>
                <Button onClick={() => run(() => actions.reject.mutateAsync(undefined))} disabled={actions.reject.isPending}>
                  Reject
                </Button>
              </>
            )}
            {quotation.status === 'approved' && (
              <Button variant="primary" onClick={() => run(() => actions.send.mutateAsync())} disabled={actions.send.isPending}>
                Send to Customer
              </Button>
            )}
            {quotation.status === 'sent' && (
              <>
                <Button variant="primary" onClick={() => run(() => actions.customerAccept.mutateAsync())} disabled={actions.customerAccept.isPending}>
                  Record Customer Acceptance
                </Button>
                <Button onClick={() => run(() => actions.customerReject.mutateAsync())} disabled={actions.customerReject.isPending}>
                  Record Customer Decline
                </Button>
              </>
            )}
            {quotation.status === 'accepted' && (
              <Button
                variant="primary"
                onClick={() =>
                  run(async () => {
                    const project = await actions.convertToProject.mutateAsync();
                    navigate(`/projects/${project.id}`);
                  })
                }
                disabled={actions.convertToProject.isPending}
              >
                Convert to Project
              </Button>
            )}
          </>
        }
      />

      {actionError && <ErrorNote>{actionError}</ErrorNote>}

      <Card>
        <CardHeader>
          <CardTitle>Revision {rev?.revisionNumber ?? '—'}</CardTitle>
          <span className="text-xs text-muted">{rev ? formatDate(rev.createdAt) : ''}</span>
        </CardHeader>
        {rev ? (
          <>
            <TableWrap>
              <DataTable>
                <thead>
                  <tr>
                    <Th>Description</Th>
                    <Th>Category</Th>
                    <Th numeric>Qty</Th>
                    <Th numeric>Unit Price</Th>
                    <Th numeric>Line Total</Th>
                  </tr>
                </thead>
                <tbody>
                  {rev.items.map((item) => (
                    <Tr key={item.id}>
                      <Td>{item.description}</Td>
                      <Td className="capitalize">{item.category}</Td>
                      <Td numeric>{item.quantity} {item.unit}</Td>
                      <Td numeric>{formatCurrency(item.unitPrice)}</Td>
                      <Td numeric>{formatCurrency(item.lineTotal)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </DataTable>
            </TableWrap>
            <CardContent className="ml-auto flex max-w-[260px] flex-col gap-1.5 text-[13px]">
              <div className="flex justify-between"><span className="text-muted">Subtotal</span><span className="num">{formatCurrency(rev.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted">Discount</span><span className="num">-{formatCurrency(rev.discountAmount)}</span></div>
              <div className="flex justify-between"><span className="text-muted">Tax</span><span className="num">{formatCurrency(rev.taxAmount)}</span></div>
              <div className="flex justify-between border-t border-line pt-1.5 font-semibold"><span>Total</span><span className="num">{formatCurrency(rev.total)}</span></div>
            </CardContent>
          </>
        ) : (
          <CardContent>No revision yet.</CardContent>
        )}
      </Card>

      {editing && <EditQuotationModal quotation={quotation} onClose={() => setEditing(false)} />}
      {deleting && (
        <DeleteQuotationModal
          quotation={quotation}
          onClose={() => setDeleting(false)}
          onDeleted={() => navigate('/quotations')}
        />
      )}
    </div>
  );
}
