import { FormEvent, useState } from 'react';
import { useParams } from 'react-router-dom';
import { DownloadPdfButton } from '../../../components/DownloadPdfButton';
import { PageHeader } from '../../../components/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { EmptyNote, ErrorNote, Spinner } from '../../../components/ui/Feedback';
import { Field, Input } from '../../../components/ui/Input';
import { StatusPill } from '../../../components/ui/StatusPill';
import { DataTable, Td, Th, TableWrap, Tr } from '../../../components/ui/Table';
import { ApiError } from '../../../lib/api-client';
import { formatCurrency, formatDate } from '../../../lib/utils';
import { useInvoice, useInvoiceActions } from '../hooks';

function RecordPaymentForm({ invoiceId, outstanding }: { invoiceId: string; outstanding: number }) {
  const { recordPayment } = useInvoiceActions(invoiceId);
  const [amount, setAmount] = useState(outstanding);
  const [method, setMethod] = useState('');
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await recordPayment.mutateAsync({ amount, method: method || undefined, reference: reference || undefined });
      setMethod('');
      setReference('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not record this payment.');
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2.5">
      <Field label="Amount" htmlFor="pay-amount">
        <Input id="pay-amount" type="number" min={0.01} step={0.01} max={outstanding} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="w-32" />
      </Field>
      <Field label="Method" htmlFor="pay-method">
        <Input id="pay-method" placeholder="e.g. Bank Transfer" value={method} onChange={(e) => setMethod(e.target.value)} />
      </Field>
      <Field label="Reference" htmlFor="pay-ref">
        <Input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} />
      </Field>
      <Button type="submit" variant="primary" disabled={recordPayment.isPending}>Record Payment</Button>
      {error && <p className="w-full text-[12.5px] text-critical">{error}</p>}
    </form>
  );
}

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: invoice, isLoading, error } = useInvoice(id);
  const actions = useInvoiceActions(id!);
  const [actionError, setActionError] = useState<string | null>(null);

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (error) return <ErrorNote>{error instanceof ApiError ? error.message : 'Could not load this invoice.'}</ErrorNote>;
  if (!invoice) return null;

  async function run(action: () => Promise<unknown>) {
    setActionError(null);
    try {
      await action();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  }

  const outstanding = Number(invoice.total) - Number(invoice.amountPaid);

  return (
    <div>
      <PageHeader
        eyebrow="Commercials"
        title={<span className="flex items-center gap-2.5">{invoice.invoiceNumber}<StatusPill domain="invoice" status={invoice.status} /></span>}
        subtitle={`${invoice.customer.name} · ${invoice.project.name}${invoice.claim ? ` · from ${invoice.claim.claimNumber}` : ''}`}
        actions={
          <>
            <DownloadPdfButton
              path={`/invoices/${invoice.id}/pdf`}
              filename={`${invoice.invoiceNumber}.pdf`}
              onError={setActionError}
            />
            {invoice.status === 'draft' && (
              <>
                <Button variant="primary" onClick={() => run(() => actions.send.mutateAsync())} disabled={actions.send.isPending}>Send</Button>
                <Button onClick={() => run(() => actions.void.mutateAsync())} disabled={actions.void.isPending}>Void</Button>
              </>
            )}
            {invoice.status === 'sent' && (
              <Button onClick={() => run(() => actions.void.mutateAsync())} disabled={actions.void.isPending}>Void</Button>
            )}
          </>
        }
      />

      {actionError && <ErrorNote>{actionError}</ErrorNote>}

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <Card className="p-4"><div className="text-xs text-muted">Total</div><div className="num text-lg font-semibold">{formatCurrency(invoice.total)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted">Paid</div><div className="num text-lg font-semibold">{formatCurrency(invoice.amountPaid)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted">Outstanding</div><div className="num text-lg font-semibold">{formatCurrency(outstanding)}</div></Card>
      </div>

      <Card className="mt-3.5">
        <CardHeader><CardTitle>Payments</CardTitle></CardHeader>
        {invoice.payments.length === 0 ? (
          <EmptyNote>No payments recorded yet.</EmptyNote>
        ) : (
          <TableWrap>
            <DataTable>
              <thead><tr><Th>Date</Th><Th>Method</Th><Th>Reference</Th><Th numeric>Amount</Th></tr></thead>
              <tbody>
                {invoice.payments.map((p) => (
                  <Tr key={p.id}>
                    <Td>{formatDate(p.paymentDate)}</Td>
                    <Td>{p.method ?? '—'}</Td>
                    <Td>{p.reference ?? '—'}</Td>
                    <Td numeric>{formatCurrency(p.amount)}</Td>
                  </Tr>
                ))}
              </tbody>
            </DataTable>
          </TableWrap>
        )}
        {(invoice.status === 'sent' || invoice.status === 'partially_paid') && (
          <CardContent className="border-t border-line">
            <RecordPaymentForm invoiceId={id!} outstanding={outstanding} />
          </CardContent>
        )}
      </Card>
    </div>
  );
}
