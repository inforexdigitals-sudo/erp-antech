import { FormEvent, useState } from 'react';
import { LineItemsEditor, type LineItemColumn } from '../../components/LineItemsEditor';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { EmptyNote, ErrorNote, Spinner } from '../../components/ui/Feedback';
import { Field, Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import { DataTable, Td, Th, TableWrap, Tr } from '../../components/ui/Table';
import { ApiError } from '../../lib/api-client';
import { formatCurrency, formatDate, toDateInputValue } from '../../lib/utils';
import { COST_CATEGORIES, CostCategory } from '../shared/constants';
import { useCostingActions, useCostingDashboard, useProjectBudget, useProjectExpenses } from './hooks';
import type { CreateExpenseInput, ManualBudgetLineInput, ProjectCostingDashboard, ProjectExpense } from './api';

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

function FinancialSummary({ dashboard }: { dashboard: ProjectCostingDashboard }) {
  const items: { label: string; value: number; tone?: 'critical' | 'success' }[] = [
    { label: 'Project Value', value: dashboard.contractValue },
    { label: 'Spent So Far', value: dashboard.totals.actual },
    { label: 'Committed (not yet spent)', value: dashboard.totals.committed },
    { label: 'Balance', value: dashboard.balance, tone: dashboard.balance < 0 ? 'critical' : 'success' },
    { label: 'Profit', value: dashboard.profit, tone: dashboard.profit < 0 ? 'critical' : 'success' },
  ];

  return (
    <Card>
      <CardHeader><CardTitle>Project Value & Profit</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-2 gap-3.5 sm:grid-cols-5">
        {items.map((item) => (
          <div key={item.label} className="flex flex-col gap-1">
            <span className="text-xs text-muted">{item.label}</span>
            <span className={`num text-base font-semibold ${item.tone === 'critical' ? 'text-critical' : item.tone === 'success' ? 'text-success' : ''}`}>
              {formatCurrency(item.value)}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function newExpense(): CreateExpenseInput {
  return { description: '', costCategory: 'material', amount: 0, expenseDate: toDateInputValue(new Date()) };
}

function EditExpenseModal({
  projectId,
  expense,
  onClose,
}: {
  projectId: string;
  expense: ProjectExpense;
  onClose: () => void;
}) {
  const actions = useCostingActions(projectId);
  const [draft, setDraft] = useState<CreateExpenseInput>({
    description: expense.description,
    costCategory: expense.costCategory,
    amount: Number(expense.amount),
    expenseDate: toDateInputValue(expense.expenseDate),
  });
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await actions.updateExpense.mutateAsync({ expenseId: expense.id, input: draft });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update the expense.');
    }
  }

  return (
    <Modal open onClose={onClose} title="Edit Expense">
      <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
        <Field label="Description" htmlFor="edit-exp-description">
          <Input
            id="edit-exp-description"
            required
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
        </Field>
        <Field label="Category" htmlFor="edit-exp-category">
          <Select
            id="edit-exp-category"
            value={draft.costCategory}
            onChange={(e) => setDraft({ ...draft, costCategory: e.target.value as CostCategory })}
          >
            {COST_CATEGORIES.map((c) => (
              <option key={c} value={c} className="capitalize">{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Date" htmlFor="edit-exp-date">
          <Input
            id="edit-exp-date"
            type="date"
            required
            value={draft.expenseDate}
            onChange={(e) => setDraft({ ...draft, expenseDate: e.target.value })}
          />
        </Field>
        <Field label="Amount ($)" htmlFor="edit-exp-amount">
          <Input
            id="edit-exp-amount"
            type="number"
            min={0.01}
            step={0.01}
            required
            value={draft.amount}
            onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })}
          />
        </Field>
        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={actions.updateExpense.isPending}>
            {actions.updateExpense.isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteExpenseModal({
  projectId,
  expense,
  onClose,
}: {
  projectId: string;
  expense: ProjectExpense;
  onClose: () => void;
}) {
  const actions = useCostingActions(projectId);
  const [error, setError] = useState<string | null>(null);

  async function onConfirm() {
    setError(null);
    try {
      await actions.deleteExpense.mutateAsync(expense.id);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete this expense.');
    }
  }

  return (
    <Modal open onClose={onClose} title="Delete Expense?">
      <div className="flex flex-col gap-3.5">
        <p className="text-[13px]">
          This permanently deletes the expense <strong>{expense.description}</strong> ({formatCurrency(Number(expense.amount))})
          and removes it from Spent So Far and Profit. This can&apos;t be undone.
        </p>
        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button
            type="button"
            variant="primary"
            className="border-critical bg-critical hover:border-critical hover:bg-critical/90"
            onClick={onConfirm}
            disabled={actions.deleteExpense.isPending}
          >
            {actions.deleteExpense.isPending ? 'Deleting…' : 'Delete Expense'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ExpensesSection({ projectId }: { projectId: string }) {
  const expenses = useProjectExpenses(projectId);
  const actions = useCostingActions(projectId);
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<CreateExpenseInput>(newExpense());
  const [error, setError] = useState<string | null>(null);
  const [editingExpense, setEditingExpense] = useState<ProjectExpense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<ProjectExpense | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await actions.createExpense.mutateAsync(draft);
      setDraft(newExpense());
      setFormOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add the expense.');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Expenses</CardTitle>
        <Button size="sm" onClick={() => setFormOpen((v) => !v)}>{formOpen ? 'Cancel' : '+ Add Expense'}</Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-xs text-muted">
          Log a one-off purchase (material, labour, equipment hire, subcontractor cost) that isn't tied to a Purchase Order — it counts toward Spent So Far and Profit above immediately.
        </p>
        {formOpen && (
          <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 rounded border border-line p-3 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <Field label="Description" htmlFor="exp-description">
                <Input
                  id="exp-description"
                  required
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  placeholder="e.g. Nuts, bolts, rod stock from hardware store"
                />
              </Field>
            </div>
            <Field label="Category" htmlFor="exp-category">
              <Select
                id="exp-category"
                value={draft.costCategory}
                onChange={(e) => setDraft({ ...draft, costCategory: e.target.value as CostCategory })}
              >
                {COST_CATEGORIES.map((c) => (
                  <option key={c} value={c} className="capitalize">{c}</option>
                ))}
              </Select>
            </Field>
            <Field label="Date" htmlFor="exp-date">
              <Input
                id="exp-date"
                type="date"
                required
                value={draft.expenseDate}
                onChange={(e) => setDraft({ ...draft, expenseDate: e.target.value })}
              />
            </Field>
            <Field label="Amount ($)" htmlFor="exp-amount">
              <Input
                id="exp-amount"
                type="number"
                min={0.01}
                step={0.01}
                required
                value={draft.amount}
                onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })}
              />
            </Field>
            {error && <div className="sm:col-span-4"><ErrorNote>{error}</ErrorNote></div>}
            <div className="sm:col-span-4">
              <Button type="submit" variant="primary" disabled={actions.createExpense.isPending}>
                {actions.createExpense.isPending ? 'Adding…' : 'Add Expense'}
              </Button>
            </div>
          </form>
        )}

        {expenses.isLoading && <div className="flex justify-center py-4"><Spinner /></div>}
        {expenses.data && expenses.data.length === 0 && <EmptyNote>No expenses logged yet.</EmptyNote>}
        {expenses.data && expenses.data.length > 0 && (
          <TableWrap>
            <DataTable>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Description</Th>
                  <Th>Category</Th>
                  <Th>Added By</Th>
                  <Th numeric>Amount</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {expenses.data.map((expense) => (
                  <Tr key={expense.id}>
                    <Td>{formatDate(expense.expenseDate)}</Td>
                    <Td>{expense.description}</Td>
                    <Td className="capitalize">{expense.costCategory}</Td>
                    <Td>{expense.creator.fullName}</Td>
                    <Td numeric>{formatCurrency(expense.amount)}</Td>
                    <Td>
                      <div className="flex justify-end gap-3">
                        <button type="button" className="text-xs text-muted hover:text-ink" onClick={() => setEditingExpense(expense)}>
                          Edit
                        </button>
                        <button type="button" className="text-xs text-critical hover:underline" onClick={() => setDeletingExpense(expense)}>
                          Delete
                        </button>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </DataTable>
          </TableWrap>
        )}
      </CardContent>

      {editingExpense && (
        <EditExpenseModal projectId={projectId} expense={editingExpense} onClose={() => setEditingExpense(null)} />
      )}
      {deletingExpense && (
        <DeleteExpenseModal projectId={projectId} expense={deletingExpense} onClose={() => setDeletingExpense(null)} />
      )}
    </Card>
  );
}

export function ProjectCostingPanel({ projectId, hasQuotation }: { projectId: string; hasQuotation: boolean }) {
  const budget = useProjectBudget(projectId);
  const dashboard = useCostingDashboard(projectId);

  if (dashboard.isLoading || budget.isLoading) return <div className="flex justify-center py-8"><Spinner /></div>;
  if (dashboard.error) return <ErrorNote>{dashboard.error instanceof ApiError ? dashboard.error.message : 'Could not load costing data.'}</ErrorNote>;

  const noBudgetYet = budget.error instanceof ApiError && budget.error.statusCode === 404;
  if (budget.error && !noBudgetYet) {
    return <ErrorNote>{budget.error instanceof ApiError ? budget.error.message : 'Could not load the budget.'}</ErrorNote>;
  }

  return (
    <div className="flex flex-col gap-4">
      {dashboard.data && <FinancialSummary dashboard={dashboard.data} />}
      <ExpensesSection projectId={projectId} />

      {noBudgetYet && <NoBudgetSetup projectId={projectId} hasQuotation={hasQuotation} />}

      {!noBudgetYet && (
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
      )}
    </div>
  );
}
