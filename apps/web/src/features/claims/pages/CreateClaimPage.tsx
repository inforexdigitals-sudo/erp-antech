import { FormEvent, useState } from 'react';
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
import { useCreateClaim } from '../hooks';
import type { ClaimItemInput, ClaimType } from '../api';

function newItem(): ClaimItemInput {
  return { description: '', currentPercent: 0, amount: 0 };
}

const COLUMNS: LineItemColumn<ClaimItemInput>[] = [
  { key: 'description', label: 'Description', type: 'text', width: '45%' },
  { key: 'currentPercent', label: 'This Period %', type: 'number', min: 0, step: 0.1, width: '25%' },
  { key: 'amount', label: 'Amount ($)', type: 'number', min: 0, step: 0.01, width: '30%' },
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
  const [items, setItems] = useState<ClaimItemInput[]>([newItem()]);
  const [error, setError] = useState<string | null>(null);

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
        items,
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
              <Select id="c-project" required value={projectId} onChange={(e) => setProjectId(e.target.value)}>
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
              Percentage and amount are entered directly — this schema has no linked BOQ value to derive them from automatically.
            </p>
            <LineItemsEditor items={items} onChange={setItems} columns={COLUMNS} newRow={newItem} />
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
