import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProjectsRepository } from '../projects/projects.repository';
import { QuotationsRepository } from '../quotations/quotations.repository';
import { ProjectCostingRepository } from './project-costing.repository';
import { CostingService } from './project-costing.service';

const COMPANY_ID = 'company-1';
const PROJECT_ID = 'project-1';

describe('CostingService', () => {
  let service: CostingService;
  let repository: jest.Mocked<
    Pick<
      ProjectCostingRepository,
      | 'findBudgetByProjectId'
      | 'createBudget'
      | 'createCostTransaction'
      | 'getCostSummary'
      | 'createExpense'
      | 'listExpenses'
      | 'findExpenseById'
      | 'updateExpense'
      | 'deleteExpense'
      | 'deleteBySource'
    >
  >;
  let projects: jest.Mocked<Pick<ProjectsRepository, 'findById'>>;
  let quotations: jest.Mocked<Pick<QuotationsRepository, 'findById'>>;

  beforeEach(() => {
    repository = {
      findBudgetByProjectId: jest.fn(),
      createBudget: jest.fn(),
      createCostTransaction: jest.fn(),
      getCostSummary: jest.fn().mockResolvedValue([]),
      createExpense: jest.fn(),
      listExpenses: jest.fn().mockResolvedValue([]),
      findExpenseById: jest.fn(),
      updateExpense: jest.fn(),
      deleteExpense: jest.fn(),
      deleteBySource: jest.fn(),
    };
    projects = { findById: jest.fn() };
    quotations = { findById: jest.fn() };

    service = new CostingService(
      repository as unknown as ProjectCostingRepository,
      projects as unknown as ProjectsRepository,
      quotations as unknown as QuotationsRepository,
    );
  });

  describe('initializeBudgetFromQuotation', () => {
    it('refuses to create a second budget for a project that already has one', async () => {
      repository.findBudgetByProjectId.mockResolvedValue({ id: 'budget-1' } as never);

      await expect(service.initializeBudgetFromQuotation(COMPANY_ID, PROJECT_ID)).rejects.toThrow(
        BadRequestException,
      );
      expect(repository.createBudget).not.toHaveBeenCalled();
    });

    it('refuses a project with no linked quotation', async () => {
      repository.findBudgetByProjectId.mockResolvedValue(null);
      projects.findById.mockResolvedValue({ id: PROJECT_ID, quotationId: null } as never);

      await expect(service.initializeBudgetFromQuotation(COMPANY_ID, PROJECT_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('groups quotation line items by cost category into one budget line per category', async () => {
      repository.findBudgetByProjectId.mockResolvedValue(null);
      projects.findById.mockResolvedValue({ id: PROJECT_ID, quotationId: 'quotation-1' } as never);
      quotations.findById.mockResolvedValue({
        quotationNumber: 'QT-0001',
        currentRevision: {
          revisionNumber: 1,
          items: [
            { category: 'material', lineTotal: 1000 },
            { category: 'material', lineTotal: 500 },
            { category: 'labour', lineTotal: 300 },
          ],
        },
      } as never);
      repository.createBudget.mockResolvedValue({ id: 'budget-1' } as never);

      await service.initializeBudgetFromQuotation(COMPANY_ID, PROJECT_ID);

      expect(repository.createBudget).toHaveBeenCalledWith(
        PROJECT_ID,
        'quotation',
        expect.arrayContaining([
          expect.objectContaining({ costCategory: 'material', budgetedAmount: 1500 }),
          expect.objectContaining({ costCategory: 'labour', budgetedAmount: 300 }),
        ]),
      );
    });
  });

  describe('record', () => {
    it('is a no-op for a zero amount rather than writing an empty ledger row', async () => {
      await service.record({
        companyId: COMPANY_ID,
        projectId: PROJECT_ID,
        costCategory: 'material',
        transactionType: 'committed',
        sourceType: 'purchase_order',
        sourceId: 'po-1',
        amount: 0,
      });

      expect(repository.createCostTransaction).not.toHaveBeenCalled();
    });

    it('writes a nonzero transaction through to the repository', async () => {
      await service.record({
        companyId: COMPANY_ID,
        projectId: PROJECT_ID,
        costCategory: 'material',
        transactionType: 'committed',
        sourceType: 'purchase_order',
        sourceId: 'po-1',
        amount: 500,
      });

      expect(repository.createCostTransaction).toHaveBeenCalled();
    });
  });

  describe('getDashboard', () => {
    it('throws NotFoundException for a project outside the tenant', async () => {
      projects.findById.mockResolvedValue(null);
      await expect(service.getDashboard(COMPANY_ID, PROJECT_ID)).rejects.toThrow(NotFoundException);
    });

    it('computes forecast as committed + actual and variance as budgeted - forecast, per category and in total', async () => {
      projects.findById.mockResolvedValue({ id: PROJECT_ID, contractValue: 10000 } as never);
      repository.findBudgetByProjectId.mockResolvedValue({
        lines: [{ costCategory: 'material', budgetedAmount: 1000 }],
      } as never);
      repository.getCostSummary.mockResolvedValue([
        { costCategory: 'material', transactionType: 'committed', total: 200 },
        { costCategory: 'material', transactionType: 'actual', total: 300 },
      ]);

      const dashboard = await service.getDashboard(COMPANY_ID, PROJECT_ID);

      const material = dashboard.byCategory.find((row) => row.costCategory === 'material')!;
      expect(material).toMatchObject({ budgeted: 1000, committed: 200, actual: 300, forecast: 500, variance: 500 });
      expect(dashboard.totals.forecast).toBe(500);
      expect(dashboard.hasBudget).toBe(true);
    });

    it('returns hasBudget: false with all-zero rows for a project with no budget yet', async () => {
      projects.findById.mockResolvedValue({ id: PROJECT_ID, contractValue: 0 } as never);
      repository.findBudgetByProjectId.mockResolvedValue(null);

      const dashboard = await service.getDashboard(COMPANY_ID, PROJECT_ID);

      expect(dashboard.hasBudget).toBe(false);
      expect(dashboard.totals).toEqual({ budgeted: 0, committed: 0, actual: 0, forecast: 0, variance: 0 });
    });

    it('computes contract value, balance (minus committed and actual) and profit (minus actual only)', async () => {
      projects.findById.mockResolvedValue({ id: PROJECT_ID, contractValue: 10000 } as never);
      repository.findBudgetByProjectId.mockResolvedValue(null);
      repository.getCostSummary.mockResolvedValue([
        { costCategory: 'material', transactionType: 'committed', total: 1500 },
        { costCategory: 'material', transactionType: 'actual', total: 2000 },
      ]);

      const dashboard = await service.getDashboard(COMPANY_ID, PROJECT_ID);

      expect(dashboard.contractValue).toBe(10000);
      expect(dashboard.balance).toBe(10000 - 1500 - 2000);
      expect(dashboard.profit).toBe(10000 - 2000);
    });
  });

  describe('recordExpense', () => {
    const dto = { description: 'Nuts and bolts', costCategory: 'material' as const, amount: 45.5, expenseDate: '2026-09-20' };

    it('rejects a project that does not belong to the tenant', async () => {
      projects.findById.mockResolvedValue(null);
      await expect(service.recordExpense(COMPANY_ID, PROJECT_ID, 'user-1', dto)).rejects.toThrow(NotFoundException);
      expect(repository.createExpense).not.toHaveBeenCalled();
    });

    it('creates the expense row and a matching actual cost_transactions row', async () => {
      projects.findById.mockResolvedValue({ id: PROJECT_ID } as never);
      repository.createExpense.mockResolvedValue({ id: 'expense-1' } as never);

      await service.recordExpense(COMPANY_ID, PROJECT_ID, 'user-1', dto);

      expect(repository.createExpense).toHaveBeenCalledWith(
        expect.objectContaining({ companyId: COMPANY_ID, projectId: PROJECT_ID, description: 'Nuts and bolts', amount: 45.5, createdBy: 'user-1' }),
      );
      expect(repository.createCostTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: COMPANY_ID,
          projectId: PROJECT_ID,
          costCategory: 'material',
          transactionType: 'actual',
          sourceType: 'manual_expense',
          sourceId: 'expense-1',
          amount: 45.5,
        }),
      );
    });
  });

  describe('listExpenses', () => {
    it('rejects a project that does not belong to the tenant', async () => {
      projects.findById.mockResolvedValue(null);
      await expect(service.listExpenses(COMPANY_ID, PROJECT_ID)).rejects.toThrow(NotFoundException);
    });

    it('returns the repository\'s expense list for a valid project', async () => {
      projects.findById.mockResolvedValue({ id: PROJECT_ID } as never);
      const expenses = [{ id: 'expense-1', description: 'Nuts and bolts' }];
      repository.listExpenses.mockResolvedValue(expenses as never);

      await expect(service.listExpenses(COMPANY_ID, PROJECT_ID)).resolves.toEqual(expenses);
    });
  });

  describe('updateExpense', () => {
    const existing = { id: 'expense-1', costCategory: 'material', amount: 45.5, expenseDate: new Date('2026-09-20') };

    it('throws NotFoundException for an expense outside the tenant/project', async () => {
      repository.findExpenseById.mockResolvedValue(null);
      await expect(
        service.updateExpense(COMPANY_ID, PROJECT_ID, 'expense-1', { amount: 60 }),
      ).rejects.toThrow(NotFoundException);
      expect(repository.updateExpense).not.toHaveBeenCalled();
    });

    it('replaces the cost_transactions row so totals reflect the edited amount/category', async () => {
      repository.findExpenseById.mockResolvedValue(existing as never);
      repository.updateExpense.mockResolvedValue({ ...existing, amount: 60, costCategory: 'labour' } as never);

      await service.updateExpense(COMPANY_ID, PROJECT_ID, 'expense-1', { amount: 60, costCategory: 'labour' });

      expect(repository.deleteBySource).toHaveBeenCalledWith(COMPANY_ID, 'manual_expense', 'expense-1');
      expect(repository.createCostTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: COMPANY_ID,
          projectId: PROJECT_ID,
          costCategory: 'labour',
          transactionType: 'actual',
          sourceType: 'manual_expense',
          sourceId: 'expense-1',
          amount: 60,
        }),
      );
    });

    it('falls back to the existing amount/category when the dto omits them', async () => {
      repository.findExpenseById.mockResolvedValue(existing as never);
      repository.updateExpense.mockResolvedValue(existing as never);

      await service.updateExpense(COMPANY_ID, PROJECT_ID, 'expense-1', { description: 'Updated description' });

      expect(repository.createCostTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ costCategory: 'material', amount: 45.5 }),
      );
    });
  });

  describe('removeExpense', () => {
    it('throws NotFoundException for an expense outside the tenant/project', async () => {
      repository.findExpenseById.mockResolvedValue(null);
      await expect(service.removeExpense(COMPANY_ID, PROJECT_ID, 'expense-1')).rejects.toThrow(NotFoundException);
      expect(repository.deleteExpense).not.toHaveBeenCalled();
    });

    it('deletes the expense row and its cost_transactions entry', async () => {
      repository.findExpenseById.mockResolvedValue({ id: 'expense-1' } as never);

      await service.removeExpense(COMPANY_ID, PROJECT_ID, 'expense-1');

      expect(repository.deleteExpense).toHaveBeenCalledWith('expense-1');
      expect(repository.deleteBySource).toHaveBeenCalledWith(COMPANY_ID, 'manual_expense', 'expense-1');
    });
  });
});
