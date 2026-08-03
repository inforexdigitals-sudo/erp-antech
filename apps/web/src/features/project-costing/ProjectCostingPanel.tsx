import { FormEvent, useState } from 'react';
import { LineItemsEditor, type LineItemColumn } from '../../components/LineItemsEditor';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { EmptyNote, ErrorNote, Spinner } from '../../components/ui/Feedback';
import { DataTable, Td, Th, TableWrap, Tr } from '../../components/ui/Table';
import { ApiError } from '../../lib/api-client';
import { formatCurrency } from '../../lib/utils';
import { COST_CATEGORIES } from '../shared/constants';
import { useCostingActions, useCostingDashboard, useProjectBudget } from './hooks';
import type { ManualBudgetLineInput } from './api';

function newLine(): ManualBudgetLineInput {
  return { costCategory: 'material', description: '', budgetedAmount: 0 };
}

const COLUMNS: LineItemColumn<ManualBudgetLineInput>[] = [
  { key: 'costCategory', label: 'Category', type: 'select', options: COST_CATEGORIES, width: '25%' },
  { key: 'description', label: 'Description', type: 'text', width: '45%' },
  { key: 'budgetedAmount', label: 'Budgeted Amount', type: 'number', min: 0, step: 0.01, width: '30%' },
];

function NoBudgetSetup({ projectId, hasQuotation }: { projectId: string; hasQuotation: boolean }) {
  const actions = useCostingActions(projectId);
  const [manualOpen, setManualOpen] = useState(false);
  const [lines, setLines] = useState<ManualBudgetLineInput[]>([newLine()]);
  const [error, setError] = useState<string | null>(null);

  async function fromQuotation() {
    setError(null);
    try {
      await actions.initFromQuotation.mutateAsync();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not initialize the budget.');
    }
  }

  async function manual(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await actions.createManualBudget.mutateAsync(lines);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the budget.');
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>No Budget Yet</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-[13px] text-muted">A project needs a baseline budget before committed/actual costs can be tracked against it.</p>
        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="flex gap-2">
          {hasQuotation && (
            <Button variant="primary" onClick={fromQuotation} disabled={actions.initFromQuotation.isPending}>
              Initialize from Linked Quotation
            </Button>
          )}
          <Button onClick={() => setManualOpen((v) => !v)}>{manualOpen ? 'Cancel' : 'Create Manual Budget'}</Button>
        </div>
        {manualOpen && (
          <form onSubmit={manual} className="flex flex-col gap-3">
            <LineItemsEditor items={lines} onChange={setLines} columns={COLUMNS} newRow={newLine} />
            <Button type="submit" variant="primary" disabled={actions.createManualBudget.isPending} className="self-end">
              Create Budget
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

export function ProjectCostingPanel({ projectId, hasQuotation }: { projectId: string; hasQuotation: boolean }) {
  const budget = useProjectBudget(projectId);
  const dashboard = useCostingDashboard(projectId);

  if (budget.isLoading || dashboard.isLoading) return <div className="flex justify-center py-8"><Spinner /></div>;

  const noBudgetYet = budget.error instanceof ApiError && budget.error.statusCode === 404;
  if (noBudgetYet) return <NoBudgetSetup projectId={projectId} hasQuotation={hasQuotation} />;
  if (budget.error) return <ErrorNote>{budget.error instanceof ApiError ? budget.error.message : 'Could not load the budget.'}</ErrorNote>;
  if (dashboard.error) return <ErrorNote>{dashboard.error instanceof ApiError ? dashboard.error.message : 'Could not load costing data.'}</ErrorNote>;

  return (
    <Card>
      <CardHeader><CardTitle>Budget vs. Actual by Category</CardTitle></CardHeader>
      {dashboard.data && !dashboard.data.hasBudget && <EmptyNote>No budget lines recorded.</EmptyNote>}
      {dashboard.data && dashboard.data.hasBudget && (
        <TableWrap>
          <DataTable>
            <thead>
              <tr>
                <Th>Category</Th>
                <Th numeric>Budgeted</Th>
                <Th numeric>Committed</Th>
                <Th numeric>Actual</Th>
                <Th numeric>Forecast</Th>
                <Th numeric>Variance</Th>
              </tr>
            </thead>
            <tbody>
              {dashboard.data.byCategory.map((row) => (
                <Tr key={row.costCategory}>
                  <Td className="capitalize">{row.costCategory}</Td>
                  <Td numeric>{formatCurrency(row.budgeted)}</Td>
                  <Td numeric>{formatCurrency(row.committed)}</Td>
                  <Td numeric>{formatCurrency(row.actual)}</Td>
                  <Td numeric>{formatCurrency(row.forecast)}</Td>
                  <Td numeric className={row.variance < 0 ? 'text-critical' : 'text-success'}>{formatCurrency(row.variance)}</Td>
                </Tr>
              ))}
              <Tr className="font-semibold">
                <Td>Total</Td>
                <Td numeric>{formatCurrency(dashboard.data.totals.budgeted)}</Td>
                <Td numeric>{formatCurrency(dashboard.data.totals.committed)}</Td>
                <Td numeric>{formatCurrency(dashboard.data.totals.actual)}</Td>
                <Td numeric>{formatCurrency(dashboard.data.totals.forecast)}</Td>
                <Td numeric className={dashboard.data.totals.variance < 0 ? 'text-critical' : 'text-success'}>{formatCurrency(dashboard.data.totals.variance)}</Td>
              </Tr>
            </tbody>
          </DataTable>
        </TableWrap>
      )}
    </Card>
  );
}
