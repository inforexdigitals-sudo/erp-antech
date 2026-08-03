import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DownloadPdfButton } from '../../../components/DownloadPdfButton';
import { PageHeader } from '../../../components/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { ErrorNote, Spinner } from '../../../components/ui/Feedback';
import { StatusPill } from '../../../components/ui/StatusPill';
import { DataTable, Td, Th, TableWrap, Tr } from '../../../components/ui/Table';
import { ApiError } from '../../../lib/api-client';
import { formatCurrency, formatDate } from '../../../lib/utils';
import { useAuthStore } from '../../../stores/auth-store';
import { useQuotation, useQuotationActions } from '../hooks';

export function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: quotation, isLoading, error } = useQuotation(id);
  const actions = useQuotationActions(id!);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const [actionError, setActionError] = useState<string | null>(null);

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (error) return <ErrorNote>{error instanceof ApiError ? error.message : 'Could not load this quotation.'}</ErrorNote>;
  if (!quotation) return null;

  async function run(action: () => Promise<unknown>) {
    setActionError(null);
    try {
      await action();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  }

  const rev = quotation.currentRevision;

  return (
    <div>
      <PageHeader
        eyebrow="Delivery"
        title={
          <span className="flex items-center gap-2.5">
            {quotation.quotationNumber}
            <StatusPill domain="quotation" status={quotation.status} />
          </span>
        }
        subtitle={`${quotation.title} · ${quotation.customer.name}`}
        actions={
          <>
            <DownloadPdfButton
              path={`/quotations/${quotation.id}/pdf`}
              filename={`${quotation.quotationNumber}.pdf`}
              onError={setActionError}
            />
            {quotation.status === 'draft' && (
              <Button variant="primary" onClick={() => run(() => actions.submitForApproval.mutateAsync())} disabled={actions.submitForApproval.isPending}>
                Submit for Approval
              </Button>
            )}
            {quotation.status === 'pending_approval' && hasPermission('quotation.approve') && (
              <>
                <Button variant="primary" onClick={() => run(() => actions.approve.mutateAsync(undefined))} disabled={actions.approve.isPending}>
                  Approve
                </Button>
                <Button onClick={() => run(() => actions.reject.mutateAsync(undefined))} disabled={actions.reject.isPending}>
                  Reject
                </Button>
              </>
            )}
            {quotation.status === 'approved' && (
              <Button variant="primary" onClick={() => run(() => actions.send.mutateAsync())} disabled={actions.send.isPending}>
                Send to Customer
              </Button>
            )}
            {quotation.status === 'sent' && (
              <>
                <Button variant="primary" onClick={() => run(() => actions.customerAccept.mutateAsync())} disabled={actions.customerAccept.isPending}>
                  Record Customer Acceptance
                </Button>
                <Button onClick={() => run(() => actions.customerReject.mutateAsync())} disabled={actions.customerReject.isPending}>
                  Record Customer Decline
                </Button>
              </>
            )}
            {quotation.status === 'accepted' && (
              <Button
                variant="primary"
                onClick={() =>
                  run(async () => {
                    const project = await actions.convertToProject.mutateAsync();
                    navigate(`/projects/${project.id}`);
                  })
                }
                disabled={actions.convertToProject.isPending}
              >
                Convert to Project
              </Button>
            )}
          </>
        }
      />

      {actionError && <ErrorNote>{actionError}</ErrorNote>}

      <Card>
        <CardHeader>
          <CardTitle>Revision {rev?.revisionNumber ?? '—'}</CardTitle>
          <span className="text-xs text-muted">{rev ? formatDate(rev.createdAt) : ''}</span>
        </CardHeader>
        {rev ? (
          <>
            <TableWrap>
              <DataTable>
                <thead>
                  <tr>
                    <Th>Description</Th>
                    <Th>Category</Th>
                    <Th numeric>Qty</Th>
                    <Th numeric>Unit Price</Th>
                    <Th numeric>Line Total</Th>
                  </tr>
                </thead>
                <tbody>
                  {rev.items.map((item) => (
                    <Tr key={item.id}>
                      <Td>{item.description}</Td>
                      <Td className="capitalize">{item.category}</Td>
                      <Td numeric>{item.quantity} {item.unit}</Td>
                      <Td numeric>{formatCurrency(item.unitPrice)}</Td>
                      <Td numeric>{formatCurrency(item.lineTotal)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </DataTable>
            </TableWrap>
            <CardContent className="ml-auto flex max-w-[260px] flex-col gap-1.5 text-[13px]">
              <div className="flex justify-between"><span className="text-muted">Subtotal</span><span className="num">{formatCurrency(rev.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted">Discount</span><span className="num">-{formatCurrency(rev.discountAmount)}</span></div>
              <div className="flex justify-between"><span className="text-muted">Tax</span><span className="num">{formatCurrency(rev.taxAmount)}</span></div>
              <div className="flex justify-between border-t border-line pt-1.5 font-semibold"><span>Total</span><span className="num">{formatCurrency(rev.total)}</span></div>
            </CardContent>
          </>
        ) : (
          <CardContent>No revision yet.</CardContent>
        )}
      </Card>
    </div>
  );
}
