import { FormEvent, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../../../components/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent } from '../../../components/ui/Card';
import { ErrorNote, Spinner } from '../../../components/ui/Feedback';
import { Field, Input } from '../../../components/ui/Input';
import { ApiError } from '../../../lib/api-client';
import { formatCurrency } from '../../../lib/utils';
import { useClaim } from '../../claims/hooks';
import { useCreateInvoiceFromClaim } from '../hooks';

export function CreateInvoiceFromClaimPage() {
  const { claimId } = useParams<{ claimId: string }>();
  const navigate = useNavigate();
  const { data: claim, isLoading, error } = useClaim(claimId);
  const create = useCreateInvoiceFromClaim();

  const [dueDate, setDueDate] = useState('');
  const [taxAmount, setTaxAmount] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (error) return <ErrorNote>{error instanceof ApiError ? error.message : 'Could not load this claim.'}</ErrorNote>;
  if (!claim) return null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    try {
      const invoice = await create.mutateAsync({ claimId: claimId!, input: { dueDate: dueDate || undefined, taxAmount: taxAmount || undefined } });
      navigate(`/invoices/${invoice.id}`);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  }

  const total = Number(claim.netClaimAmount) + taxAmount;

  return (
    <div>
      <PageHeader eyebrow="Commercials" title={`New Invoice — from ${claim.claimNumber}`} />
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Card>
          <CardContent className="flex flex-col gap-3.5">
            <div className="flex justify-between text-[13px]">
              <span className="text-muted">Claim Net Amount (subtotal)</span>
              <span className="num font-semibold">{formatCurrency(claim.netClaimAmount)}</span>
            </div>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <Field label="Due Date" htmlFor="inv-due">
                <Input id="inv-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </Field>
              <Field label="Tax Amount" htmlFor="inv-tax">
                <Input id="inv-tax" type="number" min={0} step={0.01} value={taxAmount} onChange={(e) => setTaxAmount(Number(e.target.value))} />
              </Field>
            </div>
            <div className="flex justify-between border-t border-line pt-3 text-[13px] font-semibold">
              <span>Total</span>
              <span className="num">${total.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>
        {formError && <ErrorNote>{formError}</ErrorNote>}
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={() => navigate(`/claims/${claimId}`)}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={create.isPending}>
            {create.isPending ? 'Creating…' : 'Create Invoice'}
          </Button>
        </div>
      </form>
    </div>
  );
}
