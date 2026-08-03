import { FormEvent, useState } from 'react';
import { PageHeader } from '../../../components/PageHeader';
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
import { useCreateSubcontractor, useDeleteSubcontractor, useSubcontractors, useUpdateSubcontractor } from '../hooks';
import type { Subcontractor, SubcontractorInput } from '../api';

const STATUS_OPTIONS = ['active', 'inactive', 'blacklisted'] as const;

function SubcontractorForm({
  initial,
  onSubmit,
  submitting,
  error,
}: {
  initial?: Subcontractor;
  onSubmit: (input: SubcontractorInput) => void;
  submitting: boolean;
  error: string | null;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [registrationNumber, setRegistrationNumber] = useState(initial?.registrationNumber ?? '');
  const [trade, setTrade] = useState(initial?.trade ?? '');
  const [status, setStatus] = useState<Subcontractor['status']>(initial?.status ?? 'active');
  const [paymentTerms, setPaymentTerms] = useState(initial?.paymentTerms ?? '');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      name,
      registrationNumber: registrationNumber || undefined,
      trade: trade || undefined,
      status,
      paymentTerms: paymentTerms || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
      <Field label="Name" htmlFor="sc-name">
        <Input id="sc-name" required value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3.5">
        <Field label="Registration Number" htmlFor="sc-reg">
          <Input id="sc-reg" value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} />
        </Field>
        <Field label="Trade" htmlFor="sc-trade">
          <Input id="sc-trade" placeholder="e.g. Electrical" value={trade} onChange={(e) => setTrade(e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3.5">
        <Field label="Status" htmlFor="sc-status">
          <Select id="sc-status" value={status} onChange={(e) => setStatus(e.target.value as Subcontractor['status'])}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </Field>
        <Field label="Payment Terms" htmlFor="sc-terms">
          <Input id="sc-terms" placeholder="e.g. Net 30" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} />
        </Field>
      </div>
      {error && <p className="text-[12.5px] text-critical">{error}</p>}
      <Button type="submit" variant="primary" disabled={submitting} className="mt-1 self-end">
        {submitting ? 'Saving…' : initial ? 'Save Changes' : 'Create Subcontractor'}
      </Button>
    </form>
  );
}

export function SubcontractorsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Subcontractor | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading, error } = useSubcontractors({ page, pageSize: 20, status: status || undefined, search: search || undefined });
  const create = useCreateSubcontractor();
  const update = useUpdateSubcontractor();
  const remove = useDeleteSubcontractor();

  function openCreate() {
    setEditing(null);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(sc: Subcontractor) {
    setEditing(sc);
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSubmit(input: SubcontractorInput) {
    setFormError(null);
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, input });
      } else {
        await create.mutateAsync(input);
      }
      setModalOpen(false);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  }

  async function handleDelete(sc: Subcontractor) {
    if (!window.confirm(`Delete ${sc.name}? This can't be undone.`)) return;
    await remove.mutateAsync(sc.id);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Procurement"
        title="Subcontractors"
        actions={<Button variant="primary" onClick={openCreate}>+ New Subcontractor</Button>}
      />

      <div className="mb-3.5 flex flex-wrap gap-2.5">
        <Input placeholder="Search subcontractors…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="max-w-[260px]" />
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="max-w-[160px]">
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
      </div>

      <Card>
        {isLoading && <div className="flex justify-center py-8"><Spinner /></div>}
        {error && <ErrorNote>{error instanceof ApiError ? error.message : 'Could not load subcontractors.'}</ErrorNote>}
        {data && (
          <>
            <TableWrap>
              <DataTable>
                <thead>
                  <tr>
                    <Th>Name</Th>
                    <Th>Trade</Th>
                    <Th>Status</Th>
                    <Th>Payment Terms</Th>
                    <Th></Th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.length === 0 && (
                    <tr><td colSpan={5}><EmptyNote>No subcontractors yet — create one to get started.</EmptyNote></td></tr>
                  )}
                  {data.data.map((s) => (
                    <Tr key={s.id} className="cursor-pointer" onClick={() => openEdit(s)}>
                      <Td>
                        <div className="font-semibold">{s.name}</div>
                        {s.registrationNumber && <div className="text-xs text-muted">{s.registrationNumber}</div>}
                      </Td>
                      <Td>{s.trade ?? '—'}</Td>
                      <Td><StatusPill domain="directory_entity" status={s.status} /></Td>
                      <Td>{s.paymentTerms ?? '—'}</Td>
                      <Td>
                        <Button size="sm" onClick={(e) => { e.stopPropagation(); handleDelete(s); }}>
                          Delete
                        </Button>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </DataTable>
            </TableWrap>
            <Pagination page={page} pageSize={20} total={data.meta.total} onPageChange={setPage} />
          </>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Subcontractor' : 'New Subcontractor'}>
        <SubcontractorForm
          initial={editing ?? undefined}
          onSubmit={handleSubmit}
          submitting={create.isPending || update.isPending}
          error={formError}
        />
      </Modal>
    </div>
  );
}
