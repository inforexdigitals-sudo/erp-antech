import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../../components/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent } from '../../../components/ui/Card';
import { ErrorNote } from '../../../components/ui/Feedback';
import { Field, Input } from '../../../components/ui/Input';
import { Select, Textarea } from '../../../components/ui/Select';
import { ApiError } from '../../../lib/api-client';
import { useCustomers, usePickerUsers } from '../../shared/hooks';
import { useCreateProject } from '../hooks';

export function CreateProjectPage() {
  const navigate = useNavigate();
  const customers = useCustomers();
  const users = usePickerUsers();
  const create = useCreateProject();

  const [name, setName] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [projectManagerId, setProjectManagerId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [plannedEndDate, setPlannedEndDate] = useState('');
  const [contractValue, setContractValue] = useState(0);
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const project = await create.mutateAsync({
        name,
        customerId,
        projectManagerId: projectManagerId || undefined,
        startDate: startDate || undefined,
        plannedEndDate: plannedEndDate || undefined,
        contractValue: contractValue || undefined,
        address: address || undefined,
        description: description || undefined,
      });
      navigate(`/projects/${project.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Delivery"
        title="New Project"
        subtitle="Most projects come from converting an accepted quotation — use this only for projects started without one."
      />
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Card>
          <CardContent className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <Field label="Project Name" htmlFor="p-name">
              <Input id="p-name" required value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Customer" htmlFor="p-customer">
              <Select id="p-customer" required value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="" disabled>Select a customer…</option>
                {customers.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Project Manager" htmlFor="p-pm">
              <Select id="p-pm" value={projectManagerId} onChange={(e) => setProjectManagerId(e.target.value)}>
                <option value="">Unassigned</option>
                {users.data?.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
              </Select>
            </Field>
            <Field label="Contract Value" htmlFor="p-value">
              <Input id="p-value" type="number" min={0} step={0.01} value={contractValue} onChange={(e) => setContractValue(Number(e.target.value))} />
            </Field>
            <Field label="Start Date" htmlFor="p-start">
              <Input id="p-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            <Field label="Planned End Date" htmlFor="p-end">
              <Input id="p-end" type="date" value={plannedEndDate} onChange={(e) => setPlannedEndDate(e.target.value)} />
            </Field>
            <Field label="Address" htmlFor="p-address">
              <Input id="p-address" value={address} onChange={(e) => setAddress(e.target.value)} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Description" htmlFor="p-description">
                <Textarea id="p-description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
              </Field>
            </div>
          </CardContent>
        </Card>
        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={() => navigate('/projects')}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={create.isPending || !customerId}>
            {create.isPending ? 'Creating…' : 'Create Project'}
          </Button>
        </div>
      </form>
    </div>
  );
}
