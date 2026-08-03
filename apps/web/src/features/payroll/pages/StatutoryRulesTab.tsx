import { FormEvent, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { EmptyNote, ErrorNote, Spinner } from '../../../components/ui/Feedback';
import { Field, Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';
import { DataTable, Td, Th, TableWrap, Tr } from '../../../components/ui/Table';
import { ApiError } from '../../../lib/api-client';
import { formatDate } from '../../../lib/utils';
import { useCreateStatutoryRule, useStatutoryRules } from '../hooks';
import type { StatutoryScheme } from '../api';

const SCHEMES: StatutoryScheme[] = ['CPF', 'EPF', 'SOCSO'];

function CreateRuleModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateStatutoryRule();
  const [countryCode, setCountryCode] = useState('SG');
  const [scheme, setScheme] = useState<StatutoryScheme>('CPF');
  const [employeeRate, setEmployeeRate] = useState(20);
  const [employerRate, setEmployerRate] = useState(17);
  const [salaryCeiling, setSalaryCeiling] = useState(6000);
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await create.mutateAsync({ countryCode, scheme, employeeRate, employerRate, salaryCeiling, effectiveFrom });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create this rule.');
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New Statutory Contribution Rule">
      <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
        <div className="grid grid-cols-2 gap-3.5">
          <Field label="Country Code" htmlFor="sr-country">
            <Input id="sr-country" required maxLength={2} value={countryCode} onChange={(e) => setCountryCode(e.target.value.toUpperCase())} />
          </Field>
          <Field label="Scheme" htmlFor="sr-scheme">
            <Select id="sr-scheme" value={scheme} onChange={(e) => setScheme(e.target.value as StatutoryScheme)}>
              {SCHEMES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Employee Rate %" htmlFor="sr-ee">
            <Input id="sr-ee" type="number" min={0} step={0.01} value={employeeRate} onChange={(e) => setEmployeeRate(Number(e.target.value))} />
          </Field>
          <Field label="Employer Rate %" htmlFor="sr-er">
            <Input id="sr-er" type="number" min={0} step={0.01} value={employerRate} onChange={(e) => setEmployerRate(Number(e.target.value))} />
          </Field>
          <Field label="Salary Ceiling" htmlFor="sr-ceiling">
            <Input id="sr-ceiling" type="number" min={0} value={salaryCeiling} onChange={(e) => setSalaryCeiling(Number(e.target.value))} />
          </Field>
          <Field label="Effective From" htmlFor="sr-from">
            <Input id="sr-from" type="date" required value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
          </Field>
        </div>
        {error && <p className="text-[12.5px] text-critical">{error}</p>}
        <Button type="submit" variant="primary" disabled={create.isPending} className="self-end">Create Rule</Button>
      </form>
    </Modal>
  );
}

export function StatutoryRulesTab() {
  const { data: rules, isLoading, error } = useStatutoryRules();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div>
      <div className="mb-3.5 flex justify-end">
        <Button variant="primary" onClick={() => setCreateOpen(true)}>+ New Rule</Button>
      </div>
      <Card>
        {isLoading && <div className="flex justify-center py-8"><Spinner /></div>}
        {error && <ErrorNote>{error instanceof ApiError ? error.message : 'Could not load statutory rules.'}</ErrorNote>}
        {rules && (
          <TableWrap>
            <DataTable>
              <thead><tr><Th>Country</Th><Th>Scheme</Th><Th numeric>Employee %</Th><Th numeric>Employer %</Th><Th numeric>Ceiling</Th><Th>Effective From</Th></tr></thead>
              <tbody>
                {rules.length === 0 && <tr><td colSpan={6}><EmptyNote>No statutory contribution rules configured yet.</EmptyNote></td></tr>}
                {rules.map((r) => (
                  <Tr key={r.id}>
                    <Td>{r.countryCode}</Td>
                    <Td>{r.scheme}</Td>
                    <Td numeric>{r.employeeRate}%</Td>
                    <Td numeric>{r.employerRate}%</Td>
                    <Td numeric>{r.salaryCeiling ?? '—'}</Td>
                    <Td>{formatDate(r.effectiveFrom)}</Td>
                  </Tr>
                ))}
              </tbody>
            </DataTable>
          </TableWrap>
        )}
      </Card>
      <CreateRuleModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
