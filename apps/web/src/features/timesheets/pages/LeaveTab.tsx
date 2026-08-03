import { FormEvent, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Card, CardHeader, CardTitle } from '../../../components/ui/Card';
import { EmptyNote, ErrorNote, Spinner } from '../../../components/ui/Feedback';
import { Field, Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';
import { StatusPill } from '../../../components/ui/StatusPill';
import { DataTable, Td, Th, TableWrap, Tr } from '../../../components/ui/Table';
import { ApiError } from '../../../lib/api-client';
import { formatDate } from '../../../lib/utils';
import { useAuthStore } from '../../../stores/auth-store';
import { useCreateLeaveType, useLeaveActions, useLeaveRequests, useLeaveTypes } from '../hooks';

function CreateLeaveTypeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateLeaveType();
  const [name, setName] = useState('');
  const [annualEntitlementDays, setAnnualEntitlementDays] = useState(14);
  const [isPaid, setIsPaid] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await create.mutateAsync({ name, annualEntitlementDays, isPaid });
      onClose();
      setName('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create this leave type.');
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New Leave Type">
      <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
        <Field label="Name" htmlFor="lt-name">
          <Input id="lt-name" required placeholder="e.g. Annual Leave" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Annual Entitlement (days)" htmlFor="lt-days">
          <Input id="lt-days" type="number" min={0} value={annualEntitlementDays} onChange={(e) => setAnnualEntitlementDays(Number(e.target.value))} />
        </Field>
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={isPaid} onChange={(e) => setIsPaid(e.target.checked)} /> Paid leave
        </label>
        {error && <p className="text-[12.5px] text-critical">{error}</p>}
        <Button type="submit" variant="primary" disabled={create.isPending} className="self-end">Create</Button>
      </form>
    </Modal>
  );
}

function CreateLeaveRequestModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const types = useLeaveTypes();
  const { create } = useLeaveActions();
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [days, setDays] = useState(1);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await create.mutateAsync({ leaveTypeId, startDate, endDate, days, reason: reason || undefined });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not submit this request.');
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Request Leave">
      <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
        <Field label="Leave Type" htmlFor="lr-type">
          <Select id="lr-type" required value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)}>
            <option value="" disabled>Select…</option>
            {types.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3.5">
          <Field label="Start Date" htmlFor="lr-start">
            <Input id="lr-start" type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="End Date" htmlFor="lr-end">
            <Input id="lr-end" type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        </div>
        <Field label="Days" htmlFor="lr-days">
          <Input id="lr-days" type="number" min={0.5} step={0.5} value={days} onChange={(e) => setDays(Number(e.target.value))} />
        </Field>
        <Field label="Reason" htmlFor="lr-reason">
          <Input id="lr-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        {error && <p className="text-[12.5px] text-critical">{error}</p>}
        <Button type="submit" variant="primary" disabled={!leaveTypeId || create.isPending} className="self-end">Submit Request</Button>
      </form>
    </Modal>
  );
}

export function LeaveTab() {
  const types = useLeaveTypes();
  const requests = useLeaveRequests({ page: 1, pageSize: 50 });
  const { approve, reject } = useLeaveActions();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const [typeModalOpen, setTypeModalOpen] = useState(false);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
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
    <div className="flex flex-col gap-3.5">
      <Card>
        <CardHeader>
          <CardTitle>Leave Types</CardTitle>
          <Button size="sm" onClick={() => setTypeModalOpen(true)}>+ New Type</Button>
        </CardHeader>
        {types.isLoading && <div className="flex justify-center py-6"><Spinner /></div>}
        {types.data && types.data.length === 0 && <EmptyNote>No leave types configured yet.</EmptyNote>}
        {types.data && types.data.length > 0 && (
          <div className="flex flex-wrap gap-2 p-4">
            {types.data.map((t) => (
              <span key={t.id} className="rounded-full border border-line bg-surface-2 px-2.5 py-1 text-xs">
                {t.name} · {t.annualEntitlementDays} days/yr {t.isPaid ? '' : '(unpaid)'}
              </span>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Leave Requests</CardTitle>
          <Button size="sm" variant="primary" onClick={() => setRequestModalOpen(true)}>+ Request Leave</Button>
        </CardHeader>
        {actionError && <ErrorNote>{actionError}</ErrorNote>}
        {requests.isLoading && <div className="flex justify-center py-6"><Spinner /></div>}
        {requests.data && requests.data.data.length === 0 && <EmptyNote>No leave requests yet.</EmptyNote>}
        {requests.data && requests.data.data.length > 0 && (
          <TableWrap>
            <DataTable>
              <thead><tr><Th>User</Th><Th>Type</Th><Th>Dates</Th><Th numeric>Days</Th><Th>Status</Th><Th></Th></tr></thead>
              <tbody>
                {requests.data.data.map((r) => (
                  <Tr key={r.id}>
                    <Td>{r.user.fullName}</Td>
                    <Td>{r.leaveType.name}</Td>
                    <Td>{formatDate(r.startDate)} – {formatDate(r.endDate)}</Td>
                    <Td numeric>{r.days}</Td>
                    <Td><StatusPill domain="leave_request" status={r.status} /></Td>
                    <Td>
                      {r.status === 'pending' && hasPermission('timesheet.approve') && (
                        <div className="flex gap-1.5">
                          <Button size="sm" variant="primary" onClick={() => run(() => approve.mutateAsync(r.id))}>Approve</Button>
                          <Button size="sm" onClick={() => run(() => reject.mutateAsync(r.id))}>Reject</Button>
                        </div>
                      )}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </DataTable>
          </TableWrap>
        )}
      </Card>

      <CreateLeaveTypeModal open={typeModalOpen} onClose={() => setTypeModalOpen(false)} />
      <CreateLeaveRequestModal open={requestModalOpen} onClose={() => setRequestModalOpen(false)} />
    </div>
  );
}
