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
import { useClaim, useClaimActions } from '../hooks';

export function ClaimDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: claim, isLoading, error } = useClaim(id);
  const actions = useClaimActions(id!);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const [actionError, setActionError] = useState<string | null>(null);

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (error) return <ErrorNote>{error instanceof ApiError ? error.message : 'Could not load this claim.'}</ErrorNote>;
  if (!claim) return null;

  async function run(action: () => Promise<unknown>) {
    setActionError(null);
    try {
      await action();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Commercials"
        title={<span className="flex items-center gap-2.5">{claim.claimNumber}<StatusPill domain="claim" status={claim.status} /></span>}
        subtitle={`${claim.project.name} · ${claim.customer?.name ?? claim.subcontractor?.name ?? ''} · ${formatDate(claim.claimPeriodStart)} – ${formatDate(claim.claimPeriodEnd)}`}
        actions={
          <>
            {claim.status === 'draft' && (
              <Button variant="primary" onClick={() => run(() => actions.submitForApproval.mutateAsync())} disabled={actions.submitForApproval.isPending}>
                Submit for Approval
              </Button>
            )}
            {claim.status === 'under_review' && hasPermission('claim.approve') && (
              <>
                <Button variant="primary" onClick={() => run(() => actions.certify.mutateAsync())} disabled={actions.certify.isPending}>Certify</Button>
                <Button onClick={() => run(() => actions.reject.mutateAsync())} disabled={actions.reject.isPending}>Reject</Button>
              </>
            )}
            {claim.status === 'certified' && claim.claimType === 'client' && hasPermission('accounting.edit') && (
              <Button variant="primary" onClick={() => navigate(`/invoices/new-from-claim/${claim.id}`)}>Create Invoice</Button>
            )}
          </>
        }
      />

      {actionError && <ErrorNote>{actionError}</ErrorNote>}

      <Card>
        <CardHeader><CardTitle>BOQ Lines</CardTitle></CardHeader>
        <TableWrap>
          <DataTable>
            <thead>
              <tr>
                <Th>Description</Th>
                <Th numeric>Previous %</Th>
                <Th numeric>This Period %</Th>
                <Th numeric>Cumulative %</Th>
                <Th numeric>Amount</Th>
              </tr>
            </thead>
            <tbody>
              {claim.items.map((item) => (
                <Tr key={item.id}>
                  <Td>{item.description}</Td>
                  <Td numeric>{item.previousPercent}%</Td>
                  <Td numeric>{item.currentPercent}%</Td>
                  <Td numeric>{item.cumulativePercent}%</Td>
                  <Td numeric>{formatCurrency(item.amount)}</Td>
                </Tr>
              ))}
            </tbody>
          </DataTable>
        </TableWrap>
        <CardContent className="ml-auto flex max-w-[260px] flex-col gap-1.5 text-[13px]">
          <div className="flex justify-between"><span className="text-muted">Claim Amount</span><span className="num">{formatCurrency(claim.claimAmount)}</span></div>
          <div className="flex justify-between"><span className="text-muted">Retention ({claim.retentionPercent}%)</span><span className="num">-{formatCurrency(claim.retentionAmount)}</span></div>
          <div className="flex justify-between border-t border-line pt-1.5 font-semibold"><span>Net Claim</span><span className="num">{formatCurrency(claim.netClaimAmount)}</span></div>
        </CardContent>
      </Card>

      {claim.paymentCertificate && (
        <Card className="mt-3.5">
          <CardContent className="flex items-center justify-between text-[13px]">
            <span>Payment Certificate: <span className="font-semibold">{claim.paymentCertificate.certificateNumber}</span></span>
            <div className="flex items-center gap-3">
              <span className="num">{formatCurrency(claim.paymentCertificate.amount)}</span>
              <DownloadPdfButton
                path={`/claims/${claim.id}/certificate/pdf`}
                filename={`${claim.paymentCertificate.certificateNumber}.pdf`}
                onError={setActionError}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
