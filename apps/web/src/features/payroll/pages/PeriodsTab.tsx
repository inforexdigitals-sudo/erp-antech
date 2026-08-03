import { FormEvent, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { EmptyNote, ErrorNote, Spinner } from '../../../components/ui/Feedback';
import { Field, Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { StatusPill } from '../../../components/ui/StatusPill';
import { DataTable, Td, Th, TableWrap, Tr } from '../../../components/ui/Table';
import { ApiError } from '../../../lib/api-client';
import { formatDate } from '../../../lib/utils';
import { usePickerUsers } from '../../shared/hooks';
import { useCreatePayrollPeriod, useGeneratePayrollExport, usePayrollPeriod, usePayrollPeriods, usePayrollPreview } from '../hooks';
import { payrollApi } from '../api';
import type { PayrollExportLineInput } from '../api';

function CreatePeriodModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreatePayrollPeriod();
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await create.mutateAsync({ periodStart, periodEnd });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create this period.');
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New Payroll Period">
      <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
        <div className="grid grid-cols-2 gap-3.5">
          <Field label="Period Start" htmlFor="pp-start">
            <Input id="pp-start" type="date" required value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
          </Field>
          <Field label="Period End" htmlFor="pp-end">
            <Input id="pp-end" type="date" required value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
          </Field>
        </div>
        {error && <p className="text-[12.5px] text-critical">{error}</p>}
        <Button type="submit" variant="primary" disabled={create.isPending} className="self-end">Create Period</Button>
      </form>
    </Modal>
  );
}

function ExportLineRow({
  fullName,
  regularHours,
  overtimeHours,
  line,
  onChange,
}: {
  userId: string;
  fullName: string;
  regularHours: number;
  overtimeHours: number;
  line: PayrollExportLineInput;
  onChange: (line: PayrollExportLineInput) => void;
}) {
  return (
    <Tr>
      <Td>{fullName}</Td>
      <Td numeric>{regularHours}h</Td>
      <Td numeric>{overtimeHours}h</Td>
      <Td><Input type="number" min={0} step={0.01} className="w-24" value={line.allowances ?? 0} onChange={(e) => onChange({ ...line, allowances: Number(e.target.value) })} /></Td>
      <Td><Input type="number" min={0} step={0.01} className="w-24" value={line.deductions ?? 0} onChange={(e) => onChange({ ...line, deductions: Number(e.target.value) })} /></Td>
      <Td><Input type="number" min={0} step={0.01} className="w-24" value={line.statutoryEmployeeContribution ?? 0} onChange={(e) => onChange({ ...line, statutoryEmployeeContribution: Number(e.target.value) })} /></Td>
      <Td><Input type="number" min={0} step={0.01} className="w-28" value={line.netPay} onChange={(e) => onChange({ ...line, netPay: Number(e.target.value) })} /></Td>
    </Tr>
  );
}

function DetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: period, isLoading, error } = usePayrollPeriod(id);
  const preview = usePayrollPreview(id);
  const users = usePickerUsers();
  const generateExport = useGeneratePayrollExport(id);
  const [lines, setLines] = useState<Record<string, PayrollExportLineInput>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  function lineFor(userId: string): PayrollExportLineInput {
    return lines[userId] ?? { userId, allowances: 0, deductions: 0, statutoryEmployeeContribution: 0, statutoryEmployerContribution: 0, netPay: 0 };
  }

  async function onGenerate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    try {
      const payload = (preview.data ?? []).map((row) => lineFor(row.userId));
      await generateExport.mutateAsync(payload);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not generate this export.');
    }
  }

  async function downloadCsv() {
    setDownloading(true);
    try {
      const csv = await payrollApi.downloadLatestCsv(id);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payroll-${id}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not download the CSV.');
    } finally {
      setDownloading(false);
    }
  }

  const userName = (userId: string) => users.data?.find((u) => u.id === userId)?.fullName ?? userId;

  return (
    <Modal open onClose={onClose} title={period ? `Payroll ${formatDate(period.periodStart)} – ${formatDate(period.periodEnd)}` : 'Payroll Period'} size="lg">
      {isLoading && <div className="flex justify-center py-8"><Spinner /></div>}
      {error && <ErrorNote>{error instanceof ApiError ? error.message : 'Could not load this period.'}</ErrorNote>}
      {period && (
        <div className="flex flex-col gap-3.5">
          <StatusPill domain="payroll_period" status={period.status} />

          {period.exports.length > 0 && (
            <div className="flex items-center justify-between rounded border border-line bg-surface-2 p-3 text-[13px]">
              <span>{period.exports.length} export{period.exports.length === 1 ? '' : 's'} generated · latest {formatDate(period.exports[0].exportedAt)}</span>
              <Button size="sm" onClick={downloadCsv} disabled={downloading}>{downloading ? 'Downloading…' : 'Download Latest CSV'}</Button>
            </div>
          )}

          {(period.status === 'open' || period.status === 'processing') && (
            <form onSubmit={onGenerate} className="flex flex-col gap-3">
              <h3 className="text-[13px] font-semibold">Generate Export</h3>
              <p className="text-xs text-muted">Hours are read from approved timesheets automatically; enter allowances, deductions, statutory contributions, and net pay per person.</p>
              {preview.isLoading && <div className="flex justify-center py-6"><Spinner /></div>}
              {preview.data && preview.data.length === 0 && <EmptyNote>No approved timesheets in this period yet.</EmptyNote>}
              {preview.data && preview.data.length > 0 && (
                <TableWrap>
                  <DataTable>
                    <thead><tr><Th>User</Th><Th numeric>Regular</Th><Th numeric>OT</Th><Th>Allowances</Th><Th>Deductions</Th><Th>Statutory (EE)</Th><Th>Net Pay</Th></tr></thead>
                    <tbody>
                      {preview.data.map((row) => (
                        <ExportLineRow
                          key={row.userId}
                          userId={row.userId}
                          fullName={userName(row.userId)}
                          regularHours={row.regularHours}
                          overtimeHours={row.overtimeHours}
                          line={lineFor(row.userId)}
                          onChange={(line) => setLines((prev) => ({ ...prev, [row.userId]: line }))}
                        />
                      ))}
                    </tbody>
                  </DataTable>
                </TableWrap>
              )}
              {formError && <ErrorNote>{formError}</ErrorNote>}
              {preview.data && preview.data.length > 0 && (
                <Button type="submit" variant="primary" disabled={generateExport.isPending} className="self-end">
                  {generateExport.isPending ? 'Generating…' : 'Generate Export'}
                </Button>
              )}
            </form>
          )}
        </div>
      )}
    </Modal>
  );
}

export function PeriodsTab() {
  const { data: periods, isLoading, error } = usePayrollPeriods();
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  return (
    <div>
      <div className="mb-3.5 flex justify-end">
        <Button variant="primary" onClick={() => setCreateOpen(true)}>+ New Period</Button>
      </div>
      <Card>
        {isLoading && <div className="flex justify-center py-8"><Spinner /></div>}
        {error && <ErrorNote>{error instanceof ApiError ? error.message : 'Could not load payroll periods.'}</ErrorNote>}
        {periods && (
          <TableWrap>
            <DataTable>
              <thead><tr><Th>Period</Th><Th>Status</Th></tr></thead>
              <tbody>
                {periods.length === 0 && <tr><td colSpan={2}><EmptyNote>No payroll periods yet.</EmptyNote></td></tr>}
                {periods.map((p) => (
                  <Tr key={p.id} className="cursor-pointer" onClick={() => setDetailId(p.id)}>
                    <Td>{formatDate(p.periodStart)} – {formatDate(p.periodEnd)}</Td>
                    <Td><StatusPill domain="payroll_period" status={p.status} /></Td>
                  </Tr>
                ))}
              </tbody>
            </DataTable>
          </TableWrap>
        )}
      </Card>
      <CreatePeriodModal open={createOpen} onClose={() => setCreateOpen(false)} />
      {detailId && <DetailModal id={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}
