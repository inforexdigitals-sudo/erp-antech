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
import { COST_CATEGORIES } from '../../shared/constants';
import { usePickerProjects } from '../../shared/hooks';
import { useCreateVariationOrder } from '../hooks';
import type { VariationOrderCause, VoItemInput } from '../api';

const CAUSES: VariationOrderCause[] = ['client_instruction', 'site_condition', 'design_change', 'other'];

function newItem(): VoItemInput {
  return { description: '', unit: '', quantity: 1, unitCost: 0, unitPrice: 0, costCategory: 'material' };
}

const COLUMNS: LineItemColumn<VoItemInput>[] = [
  { key: 'description', label: 'Description', type: 'text', width: '28%' },
  { key: 'unit', label: 'Unit', type: 'text', width: '10%' },
  { key: 'quantity', label: 'Qty', type: 'number', min: 0, step: 0.01, width: '12%' },
  { key: 'unitCost', label: 'Unit Cost', type: 'number', min: 0, step: 0.01, width: '14%' },
  { key: 'unitPrice', label: 'Unit Price', type: 'number', min: 0, step: 0.01, width: '14%' },
  { key: 'costCategory', label: 'Category', type: 'select', options: COST_CATEGORIES, width: '14%' },
];

export function CreateVariationOrderPage() {
  const navigate = useNavigate();
  const projects = usePickerProjects();
  const create = useCreateVariationOrder();

  const [projectId, setProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [cause, setCause] = useState<VariationOrderCause>('client_instruction');
  const [scheduleImpactDays, setScheduleImpactDays] = useState(0);
  const [items, setItems] = useState<VoItemInput[]>([newItem()]);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const vo = await create.mutateAsync({ projectId, title, cause, scheduleImpactDays: scheduleImpactDays || undefined, items });
      navigate(`/variation-orders/${vo.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  }

  const costImpact = items.reduce((sum, i) => sum + (i.quantity ?? 0) * (i.unitCost ?? 0), 0);
  const revenueImpact = items.reduce((sum, i) => sum + (i.quantity ?? 0) * (i.unitPrice ?? 0), 0);

  return (
    <div>
      <PageHeader eyebrow="Commercials" title="New Variation Order" />
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Card>
          <CardContent className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <Field label="Project" htmlFor="vo-project">
              <Select id="vo-project" required value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="" disabled>Select…</option>
                {projects.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>
            <Field label="Title" htmlFor="vo-title">
              <Input id="vo-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <Field label="Cause" htmlFor="vo-cause">
              <Select id="vo-cause" value={cause} onChange={(e) => setCause(e.target.value as VariationOrderCause)}>
                {CAUSES.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
              </Select>
            </Field>
            <Field label="Schedule Impact (days)" htmlFor="vo-schedule">
              <Input id="vo-schedule" type="number" value={scheduleImpactDays} onChange={(e) => setScheduleImpactDays(Number(e.target.value))} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3">
            <h3 className="text-[13.5px] font-semibold">Line Items</h3>
            <p className="text-xs text-muted">A line can be lump-sum only — quantity/cost/price may be left blank, contributing $0.</p>
            <LineItemsEditor items={items} onChange={setItems} columns={COLUMNS} newRow={newItem} />
            <div className="ml-auto flex max-w-[260px] flex-col gap-1 text-[13px]">
              <div className="flex justify-between"><span className="text-muted">Cost Impact</span><span className="num">${costImpact.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted">Revenue Impact</span><span className="num">${revenueImpact.toFixed(2)}</span></div>
            </div>
          </CardContent>
        </Card>

        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={() => navigate('/variation-orders')}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={create.isPending || !projectId}>
            {create.isPending ? 'Creating…' : 'Create Variation Order'}
          </Button>
        </div>
      </form>
    </div>
  );
}
