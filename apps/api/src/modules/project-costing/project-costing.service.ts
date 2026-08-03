import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CostCategory } from '../../common/constants/cost-category';
import { ProjectsRepository } from '../projects/projects.repository';
import { QuotationsRepository } from '../quotations/quotations.repository';
import { CreateManualBudgetDto } from './dto/create-manual-budget.dto';
import {
  CreateBudgetLineInput,
  ProjectBudgetWithLines,
  ProjectCostingRepository,
  RecordCostTransactionParams,
} from './project-costing.repository';

export interface CostCategoryDashboardRow {
  costCategory: CostCategory;
  budgeted: number;
  committed: number;
  actual: number;
  forecast: number;
  variance: number;
}

export interface CostingDashboard {
  hasBudget: boolean;
  byCategory: CostCategoryDashboardRow[];
  totals: Omit<CostCategoryDashboardRow, 'costCategory'>;
}

const ALL_CATEGORIES: CostCategory[] = ['material', 'labour', 'equipment', 'subcontractor'];

@Injectable()
export class CostingService {
  constructor(
    private readonly repository: ProjectCostingRepository,
    private readonly projects: ProjectsRepository,
    private readonly quotations: QuotationsRepository,
  ) {}

  /** FR-10.1 — budget captured at project start from the linked quotation's current revision, grouped by cost category. */
  async initializeBudgetFromQuotation(companyId: string, projectId: string): Promise<ProjectBudgetWithLines> {
    await this.assertNoBudgetYet(companyId, projectId);

    const project = await this.projects.findById(companyId, projectId);
    if (!project) {
      throw new NotFoundException('Project not found.');
    }
    if (!project.quotationId) {
      throw new BadRequestException(
        'This project has no linked quotation — use the manual budget endpoint instead.',
      );
    }

    const quotation = await this.quotations.findById(companyId, project.quotationId);
    if (!quotation?.currentRevision) {
      throw new BadRequestException('The linked quotation has no priced revision to build a budget from.');
    }

    // One budget line per cost category, matching the granularity the
    // dashboard (Budget vs Actual by Cost Category) actually reads at
    // — not one line per quotation item.
    const totalsByCategory = new Map<CostCategory, number>();
    for (const item of quotation.currentRevision.items) {
      const category = item.category as CostCategory;
      totalsByCategory.set(category, (totalsByCategory.get(category) ?? 0) + Number(item.lineTotal));
    }

    const lines: CreateBudgetLineInput[] = [...totalsByCategory.entries()].map(([costCategory, budgetedAmount]) => ({
      costCategory,
      description: `From ${quotation.quotationNumber} (Rev ${quotation.currentRevision!.revisionNumber})`,
      budgetedAmount,
    }));

    return this.repository.createBudget(projectId, 'quotation', lines);
  }

  /** For projects without a linked quotation. */
  async createManualBudget(
    companyId: string,
    projectId: string,
    dto: CreateManualBudgetDto,
  ): Promise<ProjectBudgetWithLines> {
    await this.assertNoBudgetYet(companyId, projectId);

    const project = await this.projects.findById(companyId, projectId);
    if (!project) {
      throw new NotFoundException('Project not found.');
    }

    return this.repository.createBudget(projectId, 'manual', dto.lines);
  }

  async getBudget(companyId: string, projectId: string): Promise<ProjectBudgetWithLines> {
    const budget = await this.repository.findBudgetByProjectId(companyId, projectId);
    if (!budget) {
      throw new NotFoundException('This project has no budget yet.');
    }
    return budget;
  }

  /**
   * The one entry point every cost-producing module writes through
   * (Purchase Orders today; Timesheets and Variation Orders once those
   * exist — see the CostTransaction model's doc comment in
   * schema.prisma). A zero-amount call is a no-op rather than an
   * empty ledger row, keeping the append-only log meaningful to read.
   */
  async record(params: RecordCostTransactionParams): Promise<void> {
    if (params.amount === 0) return;
    await this.repository.createCostTransaction(params);
  }

  /**
   * FR-10.1–10.8 — budget vs. committed vs. actual vs. forecast, by
   * cost category and in total.
   *
   * Forecast here is `committed + actual` only. FR-10.4 defines
   * forecast as "actual + committed + estimate-to-complete," but there
   * is no ETC input mechanism in this batch — a project manager's
   * manual "what's left to finish this" estimate isn't captured
   * anywhere yet. Documented here rather than silently treating ETC as
   * zero and calling it done.
   */
  async getDashboard(companyId: string, projectId: string): Promise<CostingDashboard> {
    const project = await this.projects.findById(companyId, projectId);
    if (!project) {
      throw new NotFoundException('Project not found.');
    }

    const [budget, summary] = await Promise.all([
      this.repository.findBudgetByProjectId(companyId, projectId),
      this.repository.getCostSummary(companyId, projectId),
    ]);

    const byCategory: CostCategoryDashboardRow[] = ALL_CATEGORIES.map((category) => {
      const budgeted =
        budget?.lines
          .filter((line) => line.costCategory === category)
          .reduce((sum, line) => sum + Number(line.budgetedAmount), 0) ?? 0;
      const committed = summary.find((s) => s.costCategory === category && s.transactionType === 'committed')?.total ?? 0;
      const actual = summary.find((s) => s.costCategory === category && s.transactionType === 'actual')?.total ?? 0;
      const forecast = committed + actual;
      return { costCategory: category, budgeted, committed, actual, forecast, variance: budgeted - forecast };
    });

    const totals = byCategory.reduce(
      (acc, row) => ({
        budgeted: acc.budgeted + row.budgeted,
        committed: acc.committed + row.committed,
        actual: acc.actual + row.actual,
        forecast: acc.forecast + row.forecast,
        variance: acc.variance + row.variance,
      }),
      { budgeted: 0, committed: 0, actual: 0, forecast: 0, variance: 0 },
    );

    return { hasBudget: !!budget, byCategory, totals };
  }

  /** Company-wide variant of getDashboard, for the Dashboard module's FR-1.6 widget — same shape, rolled up across every project instead of one. */
  async getCompanyDashboard(companyId: string): Promise<CostingDashboard> {
    const [budgetTotal, summary] = await Promise.all([
      this.repository.getCompanyBudgetTotal(companyId),
      this.repository.getCompanyCostSummary(companyId),
    ]);

    const byCategory: CostCategoryDashboardRow[] = ALL_CATEGORIES.map((category) => {
      const committed = summary.find((s) => s.costCategory === category && s.transactionType === 'committed')?.total ?? 0;
      const actual = summary.find((s) => s.costCategory === category && s.transactionType === 'actual')?.total ?? 0;
      const forecast = committed + actual;
      // Budget isn't broken down by category at the company level here
      // (that would need summing budget_lines per category too) — the
      // per-category row only carries committed/actual/forecast;
      // `totals.budgeted` below is the one real company-wide figure.
      return { costCategory: category, budgeted: 0, committed, actual, forecast, variance: 0 };
    });

    const totals = byCategory.reduce(
      (acc, row) => ({
        budgeted: acc.budgeted,
        committed: acc.committed + row.committed,
        actual: acc.actual + row.actual,
        forecast: acc.forecast + row.forecast,
        variance: acc.variance,
      }),
      { budgeted: budgetTotal, committed: 0, actual: 0, forecast: 0, variance: 0 },
    );
    totals.variance = totals.budgeted - totals.forecast;

    return { hasBudget: budgetTotal > 0, byCategory, totals };
  }

  private async assertNoBudgetYet(companyId: string, projectId: string): Promise<void> {
    const existing = await this.repository.findBudgetByProjectId(companyId, projectId);
    if (existing) {
      throw new BadRequestException(
        'This project already has a budget — project_budgets.project_id is unique by design (one baseline per project).',
      );
    }
  }
}
