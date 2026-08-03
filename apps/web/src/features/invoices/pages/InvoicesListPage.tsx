import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../../components/PageHeader';
import { Card } from '../../../components/ui/Card';
import { EmptyNote, ErrorNote, Spinner } from '../../../components/ui/Feedback';
import { Select } from '../../../components/ui/Select';
import { StatusPill } from '../../../components/ui/StatusPill';
import { DataTable, Td, Th, TableWrap, Tr } from '../../../components/ui/Table';
import { Pagination } from '../../../components/ui/Pagination';
import { ApiError } from '../../../lib/api-client';
import { formatCurrency, formatDate, titleCase } from '../../../lib/utils';
import { useInvoices } from '../hooks';
import type { InvoiceStatus } from '../api';

const STATUSES: InvoiceStatus[] = ['draft', 'sent', 'partially_paid', 'paid', 'overdue', 'void'];

export function InvoicesListPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const navigate = useNavigate();
  const { data, isLoading, error } = useInvoices({ page, pageSize: 20, status: status || undefined });

  return (
    <div>
      <PageHeader
        eyebrow="Commercials"
        title="Invoices & Payments"
        subtitle="Invoices are created from certified client progress claims — see Progress Claims."
      />

      <div className="mb-3.5">
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="max-w-[200px]">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
        </Select>
      </div>

      <Card>
        {isLoading && <div className="flex justify-center py-8"><Spinner /></div>}
        {error && <ErrorNote>{error instanceof ApiError ? error.message : 'Could not load invoices.'}</ErrorNote>}
        {data && (
          <>
            <TableWrap>
              <DataTable>
                <thead>
                  <tr>
                    <Th>Invoice</Th>
                    <Th>Customer</Th>
                    <Th>Status</Th>
                    <Th numeric>Total</Th>
                    <Th numeric>Paid</Th>
                    <Th>Due Date</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.length === 0 && <tr><td colSpan={6}><EmptyNote>No invoices yet — certify a client claim to create one.</EmptyNote></td></tr>}
                  {data.data.map((inv) => (
                    <Tr key={inv.id} className="cursor-pointer" onClick={() => navigate(`/invoices/${inv.id}`)}>
                      <Td className="font-semibold">{inv.invoiceNumber}</Td>
                      <Td>{inv.customer.name}</Td>
                      <Td><StatusPill domain="invoice" status={inv.status} /></Td>
                      <Td numeric>{formatCurrency(inv.total)}</Td>
                      <Td numeric>{formatCurrency(inv.amountPaid)}</Td>
                      <Td>{formatDate(inv.dueDate)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </DataTable>
            </TableWrap>
            <Pagination page={page} pageSize={20} total={data.meta.total} onPageChange={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}
