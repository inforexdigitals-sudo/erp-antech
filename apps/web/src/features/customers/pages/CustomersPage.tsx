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
import { useCreateCustomer, useCustomersList, useDeleteCustomer, useUpdateCustomer } from '../hooks';
import type { Customer, CustomerInput } from '../api';

const STATUS_OPTIONS = ['active', 'inactive'] as const;

function CustomerForm({
  initial,
  onSubmit,
  submitting,
  error,
}: {
  initial?: Customer;
  onSubmit: (input: CustomerInput) => void;
  submitting: boolean;
  error: string | null;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [registrationNumber, setRegistrationNumber] = useState(initial?.registrationNumber ?? '');
  const [industry, setIndustry] = useState(initial?.industry ?? '');
  const [status, setStatus] = useState<Customer['status']>(initial?.status ?? 'active');
  const [billingAddress, setBillingAddress] = useState(initial?.billingAddress ?? '');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      name,
      registrationNumber: registrationNumber || undefined,
      industry: industry || undefined,
      status,
      billingAddress: billingAddress || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
      <Field label="Name" htmlFor="c-name">
        <Input id="c-name" required value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3.5">
        <Field label="Registration Number" htmlFor="c-reg">
          <Input id="c-reg" value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} />
        </Field>
        <Field label="Industry" htmlFor="c-industry">
          <Input id="c-industry" value={industry} onChange={(e) => setIndustry(e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3.5">
        <Field label="Status" htmlFor="c-status">
          <Select id="c-status" value={status} onChange={(e) => setStatus(e.target.value as Customer['status'])}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Billing Address" htmlFor="c-address">
          <Input id="c-address" value={billingAddress} onChange={(e) => setBillingAddress(e.target.value)} />
        </Field>
      </div>
      {error && <p className="text-[12.5px] text-critical">{error}</p>}
      <Button type="submit" variant="primary" disabled={submitting} className="mt-1 self-end">
        {submitting ? 'Saving…' : initial ? 'Save Changes' : 'Create Customer'}
      </Button>
    </form>
  );
}

export function CustomersPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading, error } = useCustomersList({ page, pageSize: 20, status: status || undefined, search: search || undefined });
  const create = useCreateCustomer();
  const update = useUpdateCustomer();
  const remove = useDeleteCustomer();

  function openCreate() {
    setEditing(null);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(customer: Customer) {
    setEditing(customer);
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSubmit(input: CustomerInput) {
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

  async function handleDelete(customer: Customer) {
    if (!window.confirm(`Delete ${customer.name}? This can't be undone.`)) return;
    await remove.mutateAsync(customer.id);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Overview"
        title="Customers"
        subtitle="Not full CRM — just the customer record every Quotation, Project, and Claim picks from."
        actions={<Button variant="primary" onClick={openCreate}>+ New Customer</Button>}
      />

      <div className="mb-3.5 flex flex-wrap gap-2.5">
        <Input placeholder="Search customers…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="max-w-[260px]" />
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="max-w-[160px]">
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
      </div>

      <Card>
        {isLoading && <div className="flex justify-center py-8"><Spinner /></div>}
        {error && <ErrorNote>{error instanceof ApiError ? error.message : 'Could not load customers.'}</ErrorNote>}
        {data && (
          <>
            <TableWrap>
              <DataTable>
                <thead>
                  <tr>
                    <Th>Name</Th>
                    <Th>Industry</Th>
                    <Th>Status</Th>
                    <Th>Billing Address</Th>
                    <Th></Th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.length === 0 && (
                    <tr><td colSpan={5}><EmptyNote>No customers yet — create one to get started.</EmptyNote></td></tr>
                  )}
                  {data.data.map((c) => (
                    <Tr key={c.id} className="cursor-pointer" onClick={() => openEdit(c)}>
                      <Td>
                        <div className="font-semibold">{c.name}</div>
                        {c.registrationNumber && <div className="text-xs text-muted">{c.registrationNumber}</div>}
                      </Td>
                      <Td>{c.industry ?? '—'}</Td>
                      <Td><StatusPill domain="directory_entity" status={c.status} /></Td>
                      <Td>{c.billingAddress ?? '—'}</Td>
                      <Td>
                        <Button size="sm" onClick={(e) => { e.stopPropagation(); handleDelete(c); }}>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Customer' : 'New Customer'}>
        <CustomerForm
          initial={editing ?? undefined}
          onSubmit={handleSubmit}
          submitting={create.isPending || update.isPending}
          error={formError}
        />
      </Modal>
    </div>
  );
}
