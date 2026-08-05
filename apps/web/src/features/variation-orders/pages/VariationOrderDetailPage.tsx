import { FormEvent, useState } from 'react';
import { useParams } from 'react-router-dom';
import { LineItemsEditor, type LineItemColumn } from '../../../components/LineItemsEditor';
import { PageHeader } from '../../../components/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Card, CardHeader, CardTitle } from '../../../components/ui/Card';
import { ErrorNote, Spinner } from '../../../components/ui/Feedback';
import { Field, Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Select, Textarea } from '../../../components/ui/Select';
import { StatusPill } from '../../../components/ui/StatusPill';
import { DataTable, Td, Th, TableWrap, Tr } from '../../../components/ui/Table';
import { ApiError } from '../../../lib/api-client';
import { formatCurrency } from '../../../lib/utils';
import { useAuthStore } from '../../../stores/auth-store';
import { COST_CATEGORIES } from '../../shared/constants';
import { useAddVoRevision, useVariationOrder, useVariationOrderActions } from '../hooks';
import type { VariationOrder, VariationOrderCause, VariationOrderStatus, VoItemInput } from '../api';

/** Matches VariationOrdersService's EDITABLE_STATUSES — pending_approval is safe here because addRevision resets the VO to draft itself. */
const EDITABLE_STATUSES: VariationOrderStatus[] = ['draft', 'pending_approval', 'rejected'];
const CAUSES: VariationOrderCause[] = ['client_instruction', 'site_condition', 'design_change', 'other'];

function newItem(): VoItemInput {
  return { description: '', unit: '', quantity: 1, unitCost: 0, unitPrice: 0, costCategory: 'material' };
}

const ITEM_COLUMNS: LineItemColumn<VoItemInput>[] = [
  { key: 'description', label: 'Description', type: 'text', width: '28%' },
  { key: 'unit', label: 'Unit', type: 'text', width: '10%' },
  { key: 'quantity', label: 'Qty', type: 'number', min: 0, step: 0.01, width: '12%' },
  { key: 'unitCost', label: 'Unit Cost', type: 'number', min: 0, step: 0.01, width: '14%' },
  { key: 'unitPrice', label: 'Unit Price', type: 'number', min: 0, step: 0.01, width: '14%' },
  { key: 'costCategory', label: 'Category', type: 'select', options: COST_CATEGORIES, width: '14%' },
];

function EditVoModal({ vo, onClose }: { vo: VariationOrder; onClose: () => void }) {
  const actions = useVariationOrderActions(vo.id);
  const addRevision = useAddVoRevision(vo.id);
  const [title, setTitle] = useState(vo.title);
  const [cause, setCause] = useState<VariationOrderCause>(vo.cause);
  const [scheduleImpactDays, setScheduleImpactDays] = useState(vo.scheduleImpactDays ?? 0);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<VoItemInput[]>(
    vo.items.length > 0
      ? vo.items.map((i) => ({
          description: i.description,
          unit: i.unit ?? '',
          quantity: i.quantity !== null ? Number(i.quantity) : undefined,
          unitCost: i.unitCost !== null ? Number(i.unitCost) : undefined,
          unitPrice: i.unitPrice !== null ? Number(i.unitPrice) : undefined,
          costCategory: i.costCategory,
        }))
      : [newItem()],
  );
  const [error, setError] = useState<string | null>(null);
  const submitting = actions.updateHeader.isPending || addRevision.isPending;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await actions.updateHeader.mutateAsync({ title, cause, scheduleImpactDays: scheduleImpactDays || undefined });
      await addRevision.mutateAsync({ items, notes: notes || undefined });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save these changes.');
    }
  }

  const costImpact = items.reduce((sum, i) => sum + (i.quantity ?? 0) * (i.unitCost ?? 0), 0);
  const revenueImpact = items.reduce((sum, i) => sum + (i.quantity ?? 0) * (i.unitPrice ?? 0), 0);

  return (
    <Modal open onClose={onClose} title={`Edit ${vo.voNumber}`} size="lg">
      <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
        {vo.status === 'pending_approval' && (
          <p className="text-xs text-muted">
            This variation order is awaiting approval — saving changes here withdraws it back to draft, so it&apos;ll
            need to be resubmitted for approval afterward.
          </p>
        )}
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          <Field label="Title" htmlFor="evo-title">
            <Input id="evo-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Cause" htmlFor="evo-cause">
            <Select id="evo-cause" value={cause} onChange={(e) => setCause(e.target.value as VariationOrderCause)}>
              {CAUSES.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
            </Select>
          </Field>
          <Field label="Schedule Impact (days)" htmlFor="evo-schedule">
            <Input id="evo-schedule" type="number" value={scheduleImpactDays} onChange={(e) => setScheduleImpactDays(Number(e.target.value))} />
          </Field>
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-[13.5px] font-semibold">Line Items</h3>
          <p className="text-xs text-muted">A line can be lump-sum only — quantity/cost/price may be left blank, contributing $0.</p>
          <LineItemsEditor items={items} onChange={setItems} columns={ITEM_COLUMNS} newRow={newItem} />
          <div className="ml-auto flex max-w-[260px] flex-col gap-1 text-[13px]">
            <div className="flex justify-between"><span className="text-muted">Cost Impact</span><span className="num">${costImpact.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-muted">Revenue Impact</span><span className="num">${revenueImpact.toFixed(2)}</span></div>
          </div>
          <Field label="Notes" htmlFor="evo-notes">
            <Textarea id="evo-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
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

export function VariationOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: vo, isLoading, error } = useVariationOrder(id);
  const actions = useVariationOrderActions(id!);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (error) return <ErrorNote>{error instanceof ApiError ? error.message : 'Could not load this variation order.'}</ErrorNote>;
  if (!vo) return null;

  async function run(action: () => Promise<unknown>) {
    setActionError(null);
    try {
      await action();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Commercials"
        title={<span className="flex items-center gap-2.5">{vo.voNumber}<StatusPill domain="variation_order" status={vo.status} /></span>}
        subtitle={`${vo.title} · ${vo.project.name} · ${vo.cause.replace(/_/g, ' ')}`}
        actions={
          <>
            {EDITABLE_STATUSES.includes(vo.status) && (
              <Button onClick={() => setEditing(true)}>Edit</Button>
            )}
            {vo.status === 'draft' && (
              <Button variant="primary" onClick={() => run(() => actions.submitForApproval.mutateAsync())} disabled={actions.submitForApproval.isPending}>
                Submit for Approval
              </Button>
            )}
            {vo.status === 'pending_approval' && hasPermission('variation_order.approve') && (
              <>
                <Button variant="primary" onClick={() => run(() => actions.approve.mutateAsync())} disabled={actions.approve.isPending}>Approve</Button>
                <Button onClick={() => run(() => actions.reject.mutateAsync())} disabled={actions.reject.isPending}>Reject</Button>
              </>
            )}
            {vo.status === 'approved' && (
              <Button variant="primary" onClick={() => run(() => actions.requestClientSignoff.mutateAsync())} disabled={actions.requestClientSignoff.isPending}>
                Request Client Sign-off
              </Button>
            )}
            {(vo.status === 'approved' || vo.status === 'client_signoff_pending') && hasPermission('variation_order.approve') && (
              <Button variant="primary" onClick={() => run(() => actions.clientSignoff.mutateAsync())} disabled={actions.clientSignoff.isPending}>
                Record Client Sign-off
              </Button>
            )}
          </>
        }
      />

      {actionError && <ErrorNote>{actionError}</ErrorNote>}

      <Card>
        <CardHeader><CardTitle>Line Items</CardTitle></CardHeader>
        <TableWrap>
          <DataTable>
            <thead>
              <tr>
                <Th>Description</Th>
                <Th>Category</Th>
                <Th numeric>Qty</Th>
                <Th numeric>Unit Cost</Th>
                <Th numeric>Unit Price</Th>
              </tr>
            </thead>
            <tbody>
              {vo.items.map((item) => (
                <Tr key={item.id}>
                  <Td>{item.description}</Td>
                  <Td className="capitalize">{item.costCategory}</Td>
                  <Td numeric>{item.quantity ?? '—'} {item.unit ?? ''}</Td>
                  <Td numeric>{item.unitCost ? formatCurrency(item.unitCost) : '—'}</Td>
                  <Td numeric>{item.unitPrice ? formatCurrency(item.unitPrice) : '—'}</Td>
                </Tr>
              ))}
            </tbody>
          </DataTable>
        </TableWrap>
      </Card>

      <div className="mt-3.5 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <Card className="p-4">
          <div className="text-xs text-muted">Cost Impact (project budget)</div>
          <div className="num text-lg font-semibold">{formatCurrency(vo.costImpact)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted">Revenue Impact (contract value on sign-off)</div>
          <div className="num text-lg font-semibold">{formatCurrency(vo.revenueImpact)}</div>
        </Card>
      </div>

      {editing && <EditVoModal vo={vo} onClose={() => setEditing(false)} />}
    </div>
  );
}
