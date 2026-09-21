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
import { StatusPill } from '../../../components/ui/StatusPill';
import { DataTable, Td, Th, TableWrap, Tr } from '../../../components/ui/Table';
import { ApiError } from '../../../lib/api-client';
import { formatCurrency, formatDate, toDateInputValue } from '../../../lib/utils';
import { useAuthStore } from '../../../stores/auth-store';
import { useClaim, useClaimActions } from '../hooks';
import type { Claim, ClaimItemInput } from '../api';

/** `unitPrice` and `previousPercent` are reference-only — unitPrice drives the auto-computed Amount below, previousPercent shows how much of this BOQ line is already claimed elsewhere; neither is part of ClaimItemInput, so both are stripped before submit. */
interface ClaimLineRow extends ClaimItemInput {
  unitPrice?: number;
  previousPercent?: number;
}

function newClaimLine(): ClaimLineRow {
  return { description: '', currentPercent: 0, amount: 0 };
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

const CLAIM_LINE_COLUMNS: LineItemColumn<ClaimLineRow>[] = [
  { key: 'description', label: 'Description', type: 'text', width: '28%' },
  { key: 'contractQuantity', label: 'Qty', type: 'number', min: 0, step: 0.01, width: '11%' },
  { key: 'unitPrice', label: 'Unit Price ($)', type: 'number', min: 0, step: 0.01, width: '13%' },
  { key: 'previousPercent', label: 'Already Claimed %', type: 'readonly', width: '12%', suffix: '%' },
  { key: 'currentPercent', label: 'This Period %', type: 'number', min: 0, step: 0.1, width: '13%' },
  { key: 'amount', label: 'Amount ($)', type: 'number', min: 0, step: 0.01, width: '13%' },
];

function EditClaimModal({ claim, onClose }: { claim: Claim; onClose: () => void }) {
  const { update } = useClaimActions(claim.id);
  const [claimPeriodStart, setClaimPeriodStart] = useState(toDateInputValue(claim.claimPeriodStart));
  const [claimPeriodEnd, setClaimPeriodEnd] = useState(toDateInputValue(claim.claimPeriodEnd));
  const [retentionPercent, setRetentionPercent] = useState(Number(claim.retentionPercent));
  const [items, setItems] = useState<ClaimLineRow[]>(
    claim.items.map((item) => ({
      quotationItemId: item.quotationItemId ?? undefined,
      description: item.description,
      contractQuantity: item.contractQuantity != null ? Number(item.contractQuantity) : undefined,
      unitPrice: item.quotationItem ? Number(item.quotationItem.unitPrice) : undefined,
      previousPercent: Number(item.previousPercent),
      currentPercent: Number(item.currentPercent),
      amount: Number(item.amount),
    })),
  );
  const [error, setError] = useState<string | null>(null);

  function onItemsChange(next: ClaimLineRow[]) {
    setItems(
      next.map((row, i) => {
        const prev = items[i];
        const amountEditedDirectly = prev && row.amount !== prev.amount;
        if (!amountEditedDirectly && row.contractQuantity != null && row.unitPrice != null) {
          return { ...row, amount: round2(row.contractQuantity * row.unitPrice * (row.currentPercent / 100)) };
        }
        return row;
      }),
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await update.mutateAsync({
        claimPeriodStart,
        claimPeriodEnd,
        retentionPercent,
        items: items.map(({ unitPrice: _unitPrice, previousPercent: _previousPercent, ...item }) => item),
      });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save these changes.');
    }
  }

  return (
    <Modal open onClose={onClose} title={`Edit ${claim.claimNumber}`} size="xl">
      <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
        <div className="grid grid-cols-3 gap-3.5">
          <Field label="Claim Period Start" htmlFor="ec-start">
            <Input id="ec-start" type="date" required value={claimPeriodStart} onChange={(e) => setClaimPeriodStart(e.target.value)} />
          </Field>
          <Field label="Claim Period End" htmlFor="ec-end">
            <Input id="ec-end" type="date" required value={claimPeriodEnd} onChange={(e) => setClaimPeriodEnd(e.target.value)} />
          </Field>
          <Field label="Retention %" htmlFor="ec-retention">
            <Input id="ec-retention" type="number" min={0} max={100} step={0.1} value={retentionPercent} onChange={(e) => setRetentionPercent(Number(e.target.value))} />
          </Field>
        </div>
        <LineItemsEditor items={items} onChange={onItemsChange} columns={CLAIM_LINE_COLUMNS} newRow={newClaimLine} />
        {error && <ErrorNote>{error}</ErrorNote>}
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

export function ClaimDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: claim, isLoading, error } = useClaim(id);
  const actions = useClaimActions(id!);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (error) return <ErrorNote>{error instanceof ApiError ? error.message : 'Could not load this claim.'}</ErrorNote>;
  if (!claim) return null;

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
        title={<span className="flex items-center gap-2.5">{claim.claimNumber}<StatusPill domain="claim" status={claim.status} /></span>}
        subtitle={`${claim.project.name} · ${claim.customer?.name ?? claim.subcontractor?.name ?? ''} · ${formatDate(claim.claimPeriodStart)} – ${formatDate(claim.claimPeriodEnd)}`}
        actions={
          <>
            {claim.status === 'draft' && (
              <>
                <Button onClick={() => setEditing(true)}>Edit</Button>
                <Button variant="primary" onClick={() => run(() => actions.submitForApproval.mutateAsync())} disabled={actions.submitForApproval.isPending}>
                  Submit for Approval
                </Button>
              </>
            )}
            {claim.status === 'under_review' && hasPermission('claim.approve') && (
              <>
                <Button variant="primary" onClick={() => run(() => actions.certify.mutateAsync())} disabled={actions.certify.isPending}>Certify</Button>
                <Button onClick={() => run(() => actions.reject.mutateAsync())} disabled={actions.reject.isPending}>Reject</Button>
              </>
            )}
            {claim.status === 'certified' && claim.claimType === 'client' && hasPermission('accounting.edit') && (
              <Button variant="primary" onClick={() => navigate(`/invoices/new-from-claim/${claim.id}`)}>Create Invoice</Button>
            )}
          </>
        }
      />

      {actionError && <ErrorNote>{actionError}</ErrorNote>}

      <Card>
        <CardHeader><CardTitle>BOQ Lines</CardTitle></CardHeader>
        <TableWrap>
          <DataTable>
            <thead>
              <tr>
                <Th>Description</Th>
                <Th numeric>Previous %</Th>
                <Th numeric>This Period %</Th>
                <Th numeric>Cumulative %</Th>
                <Th numeric>Amount</Th>
              </tr>
            </thead>
            <tbody>
              {claim.items.map((item) => (
                <Tr key={item.id}>
                  <Td>{item.description}</Td>
                  <Td numeric>{item.previousPercent}%</Td>
                  <Td numeric>{item.currentPercent}%</Td>
                  <Td numeric>{item.cumulativePercent}%</Td>
                  <Td numeric>{formatCurrency(item.amount)}</Td>
                </Tr>
              ))}
            </tbody>
          </DataTable>
        </TableWrap>
        <CardContent className="ml-auto flex max-w-[260px] flex-col gap-1.5 text-[13px]">
          <div className="flex justify-between"><span className="text-muted">Claim Amount</span><span className="num">{formatCurrency(claim.claimAmount)}</span></div>
          <div className="flex justify-between"><span className="text-muted">Retention ({claim.retentionPercent}%)</span><span className="num">-{formatCurrency(claim.retentionAmount)}</span></div>
          <div className="flex justify-between border-t border-line pt-1.5 font-semibold"><span>Net Claim</span><span className="num">{formatCurrency(claim.netClaimAmount)}</span></div>
        </CardContent>
      </Card>

      {claim.paymentCertificate && (
        <Card className="mt-3.5">
          <CardContent className="flex items-center justify-between text-[13px]">
            <span>Payment Certificate: <span className="font-semibold">{claim.paymentCertificate.certificateNumber}</span></span>
            <div className="flex items-center gap-3">
              <span className="num">{formatCurrency(claim.paymentCertificate.amount)}</span>
              <DownloadPdfButton
                path={`/claims/${claim.id}/certificate/pdf`}
                filename={`${claim.paymentCertificate.certificateNumber}.pdf`}
                onError={setActionError}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {editing && <EditClaimModal claim={claim} onClose={() => setEditing(false)} />}
    </div>
  );
}
