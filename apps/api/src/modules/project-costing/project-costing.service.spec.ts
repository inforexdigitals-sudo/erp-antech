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
    Pick<ProjectCostingRepository, 'findBudgetByProjectId' | 'createBudget' | 'createCostTransaction' | 'getCostSummary'>
  >;
  let projects: jest.Mocked<Pick<ProjectsRepository, 'findById'>>;
  let quotations: jest.Mocked<Pick<QuotationsRepository, 'findById'>>;

  beforeEach(() => {
    repository = {
      findBudgetByProjectId: jest.fn(),
      createBudget: jest.fn(),
      createCostTransaction: jest.fn(),
      getCostSummary: jest.fn().mockResolvedValue([]),
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
      projects.findById.mockResolvedValue({ id: PROJECT_ID } as never);
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
      projects.findById.mockResolvedValue({ id: PROJECT_ID } as never);
      repository.findBudgetByProjectId.mockResolvedValue(null);

      const dashboard = await service.getDashboard(COMPANY_ID, PROJECT_ID);

      expect(dashboard.hasBudget).toBe(false);
      expect(dashboard.totals).toEqual({ budgeted: 0, committed: 0, actual: 0, forecast: 0, variance: 0 });
    });
  });
});
