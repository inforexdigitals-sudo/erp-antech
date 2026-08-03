import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { PageHeader } from '../../../components/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Card, CardHeader, CardTitle } from '../../../components/ui/Card';
import { ErrorNote, Spinner } from '../../../components/ui/Feedback';
import { StatusPill } from '../../../components/ui/StatusPill';
import { DataTable, Td, Th, TableWrap, Tr } from '../../../components/ui/Table';
import { ApiError } from '../../../lib/api-client';
import { formatCurrency } from '../../../lib/utils';
import { useAuthStore } from '../../../stores/auth-store';
import { useVariationOrder, useVariationOrderActions } from '../hooks';

export function VariationOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: vo, isLoading, error } = useVariationOrder(id);
  const actions = useVariationOrderActions(id!);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const [actionError, setActionError] = useState<string | null>(null);

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (error) return <ErrorNote>{error instanceof ApiError ? error.message : 'Could not load this variation order.'}</ErrorNote>;
  if (!vo) return null;

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
        title={<span className="flex items-center gap-2.5">{vo.voNumber}<StatusPill domain="variation_order" status={vo.status} /></span>}
        subtitle={`${vo.title} · ${vo.project.name} · ${vo.cause.replace(/_/g, ' ')}`}
        actions={
          <>
            {vo.status === 'draft' && (
              <Button variant="primary" onClick={() => run(() => actions.submitForApproval.mutateAsync())} disabled={actions.submitForApproval.isPending}>
                Submit for Approval
              </Button>
            )}
            {vo.status === 'pending_approval' && hasPermission('variation_order.approve') && (
              <>
                <Button variant="primary" onClick={() => run(() => actions.approve.mutateAsync())} disabled={actions.approve.isPending}>Approve</Button>
                <Button onClick={() => run(() => actions.reject.mutateAsync())} disabled={actions.reject.isPending}>Reject</Button>
              </>
            )}
            {vo.status === 'approved' && (
              <Button variant="primary" onClick={() => run(() => actions.requestClientSignoff.mutateAsync())} disabled={actions.requestClientSignoff.isPending}>
                Request Client Sign-off
              </Button>
            )}
            {(vo.status === 'approved' || vo.status === 'client_signoff_pending') && hasPermission('variation_order.approve') && (
              <Button variant="primary" onClick={() => run(() => actions.clientSignoff.mutateAsync())} disabled={actions.clientSignoff.isPending}>
                Record Client Sign-off
              </Button>
            )}
          </>
        }
      />

      {actionError && <ErrorNote>{actionError}</ErrorNote>}

      <Card>
        <CardHeader><CardTitle>Line Items</CardTitle></CardHeader>
        <TableWrap>
          <DataTable>
            <thead>
              <tr>
                <Th>Description</Th>
                <Th>Category</Th>
                <Th numeric>Qty</Th>
                <Th numeric>Unit Cost</Th>
                <Th numeric>Unit Price</Th>
              </tr>
            </thead>
            <tbody>
              {vo.items.map((item) => (
                <Tr key={item.id}>
                  <Td>{item.description}</Td>
                  <Td className="capitalize">{item.costCategory}</Td>
                  <Td numeric>{item.quantity ?? '—'} {item.unit ?? ''}</Td>
                  <Td numeric>{item.unitCost ? formatCurrency(item.unitCost) : '—'}</Td>
                  <Td numeric>{item.unitPrice ? formatCurrency(item.unitPrice) : '—'}</Td>
                </Tr>
              ))}
            </tbody>
          </DataTable>
        </TableWrap>
      </Card>

      <div className="mt-3.5 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <Card className="p-4">
          <div className="text-xs text-muted">Cost Impact (project budget)</div>
          <div className="num text-lg font-semibold">{formatCurrency(vo.costImpact)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted">Revenue Impact (contract value on sign-off)</div>
          <div className="num text-lg font-semibold">{formatCurrency(vo.revenueImpact)}</div>
        </Card>
      </div>
    </div>
  );
}
