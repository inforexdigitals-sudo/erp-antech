import { FormEvent, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineItemsEditor, type LineItemColumn } from '../../../components/LineItemsEditor';
import { PageHeader } from '../../../components/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent } from '../../../components/ui/Card';
import { ErrorNote } from '../../../components/ui/Feedback';
import { Field, Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { ApiError } from '../../../lib/api-client';
import { useCustomers, usePickerProjects, usePickerSubcontractors } from '../../shared/hooks';
import { useBoqLines, useCreateClaim } from '../hooks';
import type { ClaimItemInput, ClaimType } from '../api';

/** `unitPrice` is reference-only — it drives the auto-computed Amount below but isn't part of ClaimItemInput, so it's stripped before submit (see onSubmit). */
interface ClaimLineRow extends ClaimItemInput {
  unitPrice?: number;
}

function newItem(): ClaimLineRow {
  return { description: '', currentPercent: 0, amount: 0 };
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

const COLUMNS: LineItemColumn<ClaimLineRow>[] = [
  { key: 'description', label: 'Description', type: 'text', width: '32%' },
  { key: 'contractQuantity', label: 'Qty', type: 'number', min: 0, step: 0.01, width: '13%' },
  { key: 'unitPrice', label: 'Unit Price ($)', type: 'number', min: 0, step: 0.01, width: '15%' },
  { key: 'currentPercent', label: 'This Period %', type: 'number', min: 0, step: 0.1, width: '15%' },
  { key: 'amount', label: 'Amount ($)', type: 'number', min: 0, step: 0.01, width: '15%' },
];

export function CreateClaimPage() {
  const navigate = useNavigate();
  const projects = usePickerProjects();
  const customers = useCustomers();
  const subcontractors = usePickerSubcontractors();
  const create = useCreateClaim();

  const [projectId, setProjectId] = useState('');
  const [claimType, setClaimType] = useState<ClaimType>('client');
  const [customerId, setCustomerId] = useState('');
  const [subcontractorId, setSubcontractorId] = useState('');
  const [claimPeriodStart, setClaimPeriodStart] = useState('');
  const [claimPeriodEnd, setClaimPeriodEnd] = useState('');
  const [retentionPercent, setRetentionPercent] = useState(5);
  const [items, setItems] = useState<ClaimLineRow[]>([newItem()]);
  const [error, setError] = useState<string | null>(null);

  const boqLines = useBoqLines(projectId || undefined);
  // Guards against re-applying the same project's BOQ on every render, while
  // still re-applying when the project actually changes (including back to
  // one already fetched, since react-query would resolve that instantly).
  const loadedForProjectId = useRef<string | null>(null);

  useEffect(() => {
    if (!projectId || !boqLines.data || loadedForProjectId.current === projectId) return;
    loadedForProjectId.current = projectId;
    if (boqLines.data.length > 0) {
      setItems(
        boqLines.data.map((line) => ({
          quotationItemId: line.quotationItemId,
          description: line.description,
          contractQuantity: line.quantity,
          unitPrice: line.unitPrice,
          currentPercent: 0,
          amount: 0,
        })),
      );
    }
  }, [projectId, boqLines.data]);

  function onProjectChange(nextProjectId: string) {
    setProjectId(nextProjectId);
    loadedForProjectId.current = null;
    setItems([newItem()]);
  }

  function onItemsChange(next: ClaimLineRow[]) {
    // Auto-computes Amount from Qty × Unit Price × This Period % whenever
    // one of those three changes; leaves it alone when Amount itself was
    // the field just edited, so a manual override still sticks.
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
      const claim = await create.mutateAsync({
        projectId,
        claimType,
        customerId: claimType === 'client' ? customerId : undefined,
        subcontractorId: claimType === 'subcontractor' ? subcontractorId : undefined,
        claimPeriodStart,
        claimPeriodEnd,
        retentionPercent: retentionPercent || undefined,
        items: items.map(({ unitPrice: _unitPrice, ...item }) => item),
      });
      navigate(`/claims/${claim.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  }

  const claimAmount = items.reduce((sum, i) => sum + i.amount, 0);
  const retentionAmount = claimAmount * (retentionPercent / 100);

  return (
    <div>
      <PageHeader eyebrow="Commercials" title="New Progress Claim" />
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Card>
          <CardContent className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <Field label="Project" htmlFor="c-project">
              <Select id="c-project" required value={projectId} onChange={(e) => onProjectChange(e.target.value)}>
                <option value="" disabled>Select…</option>
                {projects.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>
            <Field label="Claim Type" htmlFor="c-type">
              <Select id="c-type" value={claimType} onChange={(e) => setClaimType(e.target.value as ClaimType)}>
                <option value="client">Client</option>
                <option value="subcontractor">Subcontractor</option>
              </Select>
            </Field>
            {claimType === 'client' ? (
              <Field label="Customer" htmlFor="c-customer">
                <Select id="c-customer" required value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="" disabled>Select…</option>
                  {customers.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
            ) : (
              <Field label="Subcontractor" htmlFor="c-subcontractor">
                <Select id="c-subcontractor" required value={subcontractorId} onChange={(e) => setSubcontractorId(e.target.value)}>
                  <option value="" disabled>Select…</option>
                  {subcontractors.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </Field>
            )}
            <Field label="Claim Period Start" htmlFor="c-start">
              <Input id="c-start" type="date" required value={claimPeriodStart} onChange={(e) => setClaimPeriodStart(e.target.value)} />
            </Field>
            <Field label="Claim Period End" htmlFor="c-end">
              <Input id="c-end" type="date" required value={claimPeriodEnd} onChange={(e) => setClaimPeriodEnd(e.target.value)} />
            </Field>
            <Field label="Retention %" htmlFor="c-retention">
              <Input id="c-retention" type="number" min={0} max={100} step={0.1} value={retentionPercent} onChange={(e) => setRetentionPercent(Number(e.target.value))} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3">
            <h3 className="text-[13.5px] font-semibold">BOQ Lines</h3>
            <p className="text-xs text-muted">
              {!projectId
                ? 'Select a project above to pull in its quoted BOQ lines automatically.'
                : boqLines.isLoading
                  ? 'Loading BOQ lines from the project…'
                  : boqLines.data && boqLines.data.length > 0
                    ? 'Lines are pre-filled from the project\'s quotation — adjust Qty, Unit Price or This Period % as needed, or add extra lines manually. Amount is calculated automatically.'
                    : 'This project has no linked quotation to pull BOQ lines from — add lines manually below.'}
            </p>
            <LineItemsEditor items={items} onChange={onItemsChange} columns={COLUMNS} newRow={newItem} />
            <div className="ml-auto flex max-w-[260px] flex-col gap-1 text-[13px]">
              <div className="flex justify-between"><span className="text-muted">Claim Amount</span><span className="num">${claimAmount.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted">Retention</span><span className="num">-${retentionAmount.toFixed(2)}</span></div>
              <div className="flex justify-between border-t border-line pt-1 font-semibold"><span>Net Claim</span><span className="num">${(claimAmount - retentionAmount).toFixed(2)}</span></div>
            </div>
          </CardContent>
        </Card>

        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={() => navigate('/claims')}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={create.isPending || !projectId}>
            {create.isPending ? 'Creating…' : 'Create Claim'}
          </Button>
        </div>
      </form>
    </div>
  );
}
