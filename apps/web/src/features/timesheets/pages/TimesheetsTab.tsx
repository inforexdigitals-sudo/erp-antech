import { FormEvent, useState } from 'react';
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
import { formatDateTime, titleCase } from '../../../lib/utils';
import { useAuthStore } from '../../../stores/auth-store';
import { usePickerProjects } from '../../shared/hooks';
import { useTimesheet, useTimesheetActions, useTimesheetItemActions, useTimesheets } from '../hooks';
import type { TimesheetStatus } from '../api';

const STATUSES: TimesheetStatus[] = ['draft', 'submitted', 'approved', 'rejected'];

function ClockWidget() {
  const { clockIn, clockOut } = useTimesheetActions();
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  }

  return (
    <Card className="mb-3.5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <div className="text-[13.5px] font-semibold">Today</div>
          <div className="text-xs text-muted">No GPS capture in this browser demo — clocking in/out without coordinates.</div>
        </div>
        <div className="flex gap-2">
          <Button variant="primary" onClick={() => run(() => clockIn.mutateAsync({}))} disabled={clockIn.isPending}>Clock In</Button>
          <Button onClick={() => run(() => clockOut.mutateAsync({}))} disabled={clockOut.isPending}>Clock Out</Button>
        </div>
      </div>
      {error && <p className="mt-2 text-[12.5px] text-critical">{error}</p>}
    </Card>
  );
}

function AllocateForm({ timesheetId, totalHours }: { timesheetId: string; totalHours: number }) {
  const projects = usePickerProjects();
  const { allocateHours } = useTimesheetItemActions(timesheetId);
  const [projectId, setProjectId] = useState('');
  const [hours, setHours] = useState(totalHours);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await allocateHours.mutateAsync([{ projectId, hours }]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not allocate hours.');
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2.5 border-t border-line pt-3">
      <Field label="Project" htmlFor="alloc-project">
        <Select id="alloc-project" required value={projectId} onChange={(e) => setProjectId(e.target.value)} className="min-w-[180px]">
          <option value="" disabled>Select…</option>
          {projects.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      </Field>
      <Field label="Hours" htmlFor="alloc-hours">
        <Input id="alloc-hours" type="number" min={0.01} step={0.01} value={hours} onChange={(e) => setHours(Number(e.target.value))} className="w-24" />
      </Field>
      <Button type="submit" variant="primary" disabled={!projectId || allocateHours.isPending}>Allocate</Button>
      {error && <p className="w-full text-[12.5px] text-critical">{error}</p>}
    </form>
  );
}

function DetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: ts, isLoading, error } = useTimesheet(id);
  const actions = useTimesheetItemActions(id);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const [actionError, setActionError] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>) {
    setActionError(null);
    try {
      await fn();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  }

  return (
    <Modal open onClose={onClose} title={ts ? `Timesheet — ${ts.workDate.slice(0, 10)}` : 'Timesheet'}>
      {isLoading && <div className="flex justify-center py-8"><Spinner /></div>}
      {error && <ErrorNote>{error instanceof ApiError ? error.message : 'Could not load this timesheet.'}</ErrorNote>}
      {ts && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-[13px]">
            <StatusPill domain="timesheet" status={ts.status} />
            <span>{ts.totalHours}h total ({ts.overtimeHours}h OT)</span>
          </div>
          <div>
            <div className="mb-1.5 text-[11.5px] font-semibold text-muted">Allocations</div>
            {ts.allocations.length === 0 ? (
              <EmptyNote>No hours allocated yet.</EmptyNote>
            ) : (
              <div className="flex flex-col gap-1 text-[13px]">
                {ts.allocations.map((a) => (
                  <div key={a.id} className="flex justify-between">
                    <span>{a.project.name}</span>
                    <span className="num">{a.hours}h</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {ts.status === 'draft' && <AllocateForm timesheetId={id} totalHours={Number(ts.totalHours)} />}
          {actionError && <ErrorNote>{actionError}</ErrorNote>}
          <div className="flex gap-2">
            {ts.status === 'draft' && (
              <Button variant="primary" onClick={() => run(() => actions.submitForApproval.mutateAsync())} disabled={ts.allocations.length === 0 || actions.submitForApproval.isPending}>
                Submit for Approval
              </Button>
            )}
            {ts.status === 'submitted' && hasPermission('timesheet.approve') && (
              <>
                <Button variant="primary" onClick={() => run(() => actions.approve.mutateAsync())} disabled={actions.approve.isPending}>Approve</Button>
                <Button onClick={() => run(() => actions.reject.mutateAsync())} disabled={actions.reject.isPending}>Reject</Button>
              </>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function ManualEntryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { createManual } = useTimesheetActions();
  const [workDate, setWorkDate] = useState(new Date().toISOString().slice(0, 10));
  const [totalHours, setTotalHours] = useState(8);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createManual.mutateAsync({ workDate, totalHours });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create this timesheet.');
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Manual Timesheet Entry">
      <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
        <Field label="Work Date" htmlFor="manual-date">
          <Input id="manual-date" type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)} />
        </Field>
        <Field label="Total Hours" htmlFor="manual-hours">
          <Input id="manual-hours" type="number" min={0} step={0.25} value={totalHours} onChange={(e) => setTotalHours(Number(e.target.value))} />
        </Field>
        {error && <p className="text-[12.5px] text-critical">{error}</p>}
        <Button type="submit" variant="primary" disabled={createManual.isPending} className="self-end">Create</Button>
      </form>
    </Modal>
  );
}

export function TimesheetsTab() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const { data, isLoading, error } = useTimesheets({ page, pageSize: 20, status: status || undefined });

  return (
    <div>
      <ClockWidget />
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="max-w-[180px]">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
        </Select>
        <Button onClick={() => setManualOpen(true)}>+ Manual Entry</Button>
      </div>

      <Card>
        {isLoading && <div className="flex justify-center py-8"><Spinner /></div>}
        {error && <ErrorNote>{error instanceof ApiError ? error.message : 'Could not load timesheets.'}</ErrorNote>}
        {data && (
          <>
            <TableWrap>
              <DataTable>
                <thead><tr><Th>Date</Th><Th>Clock In / Out</Th><Th numeric>Hours</Th><Th>Status</Th></tr></thead>
                <tbody>
                  {data.data.length === 0 && <tr><td colSpan={4}><EmptyNote>No timesheets yet.</EmptyNote></td></tr>}
                  {data.data.map((ts) => (
                    <Tr key={ts.id} className="cursor-pointer" onClick={() => setDetailId(ts.id)}>
                      <Td>{ts.workDate.slice(0, 10)}</Td>
                      <Td>{ts.clockIn ? formatDateTime(ts.clockIn) : '—'} {ts.clockOut ? `– ${formatDateTime(ts.clockOut)}` : ''}</Td>
                      <Td numeric>{ts.totalHours}h</Td>
                      <Td><StatusPill domain="timesheet" status={ts.status} /></Td>
                    </Tr>
                  ))}
                </tbody>
              </DataTable>
            </TableWrap>
            <Pagination page={page} pageSize={20} total={data.meta.total} onPageChange={setPage} />
          </>
        )}
      </Card>

      {detailId && <DetailModal id={detailId} onClose={() => setDetailId(null)} />}
      <ManualEntryModal open={manualOpen} onClose={() => setManualOpen(false)} />
    </div>
  );
}
