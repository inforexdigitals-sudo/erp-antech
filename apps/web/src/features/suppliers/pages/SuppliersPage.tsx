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
import { useCreateSupplier, useDeleteSupplier, useSuppliers, useUpdateSupplier } from '../hooks';
import type { Supplier, SupplierInput } from '../api';

const STATUS_OPTIONS = ['active', 'inactive', 'blacklisted'] as const;

function SupplierForm({
  initial,
  onSubmit,
  submitting,
  error,
}: {
  initial?: Supplier;
  onSubmit: (input: SupplierInput) => void;
  submitting: boolean;
  error: string | null;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [registrationNumber, setRegistrationNumber] = useState(initial?.registrationNumber ?? '');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [status, setStatus] = useState<Supplier['status']>(initial?.status ?? 'active');
  const [paymentTerms, setPaymentTerms] = useState(initial?.paymentTerms ?? '');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      name,
      registrationNumber: registrationNumber || undefined,
      category: category || undefined,
      status,
      paymentTerms: paymentTerms || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
      <Field label="Name" htmlFor="s-name">
        <Input id="s-name" required value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3.5">
        <Field label="Registration Number" htmlFor="s-reg">
          <Input id="s-reg" value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} />
        </Field>
        <Field label="Category" htmlFor="s-cat">
          <Input id="s-cat" value={category} onChange={(e) => setCategory(e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3.5">
        <Field label="Status" htmlFor="s-status">
          <Select id="s-status" value={status} onChange={(e) => setStatus(e.target.value as Supplier['status'])}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Payment Terms" htmlFor="s-terms">
          <Input id="s-terms" placeholder="e.g. Net 30" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} />
        </Field>
      </div>
      {error && <p className="text-[12.5px] text-critical">{error}</p>}
      <Button type="submit" variant="primary" disabled={submitting} className="mt-1 self-end">
        {submitting ? 'Saving…' : initial ? 'Save Changes' : 'Create Supplier'}
      </Button>
    </form>
  );
}

export function SuppliersPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading, error } = useSuppliers({ page, pageSize: 20, status: status || undefined, search: search || undefined });
  const create = useCreateSupplier();
  const update = useUpdateSupplier();
  const remove = useDeleteSupplier();

  function openCreate() {
    setEditing(null);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(supplier: Supplier) {
    setEditing(supplier);
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSubmit(input: SupplierInput) {
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

  async function handleDelete(supplier: Supplier) {
    if (!window.confirm(`Delete ${supplier.name}? This can't be undone.`)) return;
    await remove.mutateAsync(supplier.id);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Procurement"
        title="Suppliers"
        actions={<Button variant="primary" onClick={openCreate}>+ New Supplier</Button>}
      />

      <div className="mb-3.5 flex flex-wrap gap-2.5">
        <Input placeholder="Search suppliers…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="max-w-[260px]" />
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="max-w-[160px]">
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
      </div>

      <Card>
        {isLoading && <div className="flex justify-center py-8"><Spinner /></div>}
        {error && <ErrorNote>{error instanceof ApiError ? error.message : 'Could not load suppliers.'}</ErrorNote>}
        {data && (
          <>
            <TableWrap>
              <DataTable>
                <thead>
                  <tr>
                    <Th>Name</Th>
                    <Th>Category</Th>
                    <Th>Status</Th>
                    <Th>Payment Terms</Th>
                    <Th></Th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.length === 0 && (
                    <tr><td colSpan={5}><EmptyNote>No suppliers yet — create one to get started.</EmptyNote></td></tr>
                  )}
                  {data.data.map((s) => (
                    <Tr key={s.id} className="cursor-pointer" onClick={() => openEdit(s)}>
                      <Td>
                        <div className="font-semibold">{s.name}</div>
                        {s.registrationNumber && <div className="text-xs text-muted">{s.registrationNumber}</div>}
                      </Td>
                      <Td>{s.category ?? '—'}</Td>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Supplier' : 'New Supplier'}>
        <SupplierForm
          initial={editing ?? undefined}
          onSubmit={handleSubmit}
          submitting={create.isPending || update.isPending}
          error={formError}
        />
      </Modal>
    </div>
  );
}
