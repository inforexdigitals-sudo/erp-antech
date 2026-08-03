import { Injectable } from '@nestjs/common';
import { CostTransaction, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CostCategory } from '../../common/constants/cost-category';
import { BudgetSource, CostTransactionSourceType, CostTransactionType } from './project-costing.types';

export type ProjectBudgetWithLines = Prisma.ProjectBudgetGetPayload<{ include: { lines: true } }>;

export interface CreateBudgetLineInput {
  costCategory: CostCategory;
  description: string;
  budgetedAmount: number;
  itemLibraryId?: string;
}

export interface RecordCostTransactionParams {
  companyId: string;
  projectId: string;
  costCategory: CostCategory;
  transactionType: CostTransactionType;
  sourceType: CostTransactionSourceType;
  sourceId: string;
  amount: number;
  transactionDate?: Date;
}

export interface CostSummaryRow {
  costCategory: string;
  transactionType: string;
  total: number;
}

@Injectable()
export class ProjectCostingRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * project_budgets has no company_id of its own (db/migrations/0009)
   * — tenant scoping goes through the owning project.
   */
  async findBudgetByProjectId(companyId: string, projectId: string): Promise<ProjectBudgetWithLines | null> {
    return this.prisma.projectBudget.findFirst({
      where: { projectId, project: { companyId } },
      include: { lines: true },
    });
  }

  async createBudget(
    projectId: string,
    source: BudgetSource,
    lines: CreateBudgetLineInput[],
  ): Promise<ProjectBudgetWithLines> {
    const totalBudget = lines.reduce((sum, line) => sum + line.budgetedAmount, 0);
    return this.prisma.projectBudget.create({
      data: {
        projectId,
        source,
        totalBudget,
        baselineLockedAt: new Date(),
        lines: { create: lines },
      },
      include: { lines: true },
    });
  }

  async createCostTransaction(params: RecordCostTransactionParams): Promise<CostTransaction> {
    return this.prisma.costTransaction.create({
      data: {
        companyId: params.companyId,
        projectId: params.projectId,
        costCategory: params.costCategory,
        transactionType: params.transactionType,
        sourceType: params.sourceType,
        sourceId: params.sourceId,
        amount: params.amount,
        transactionDate: params.transactionDate,
      },
    });
  }

  /**
   * One row per (costCategory, transactionType) with its net summed
   * amount — the aggregation the costing dashboard is built from. Net,
   * not gross: a delivery both releases committed (negative) and
   * records actual (positive) for the same value (see
   * PurchaseOrdersService), so summing is what keeps
   * committed+actual == the original commitment as deliveries land.
   */
  async getCostSummary(companyId: string, projectId: string): Promise<CostSummaryRow[]> {
    const grouped = await this.prisma.costTransaction.groupBy({
      by: ['costCategory', 'transactionType'],
      where: { companyId, projectId },
      _sum: { amount: true },
    });
    return grouped.map((row) => ({
      costCategory: row.costCategory,
      transactionType: row.transactionType,
      total: Number(row._sum.amount ?? 0),
    }));
  }

  /** Company-wide variant of getCostSummary — same shape, no projectId filter. Used by the Dashboard module's costing rollup. */
  async getCompanyCostSummary(companyId: string): Promise<CostSummaryRow[]> {
    const grouped = await this.prisma.costTransaction.groupBy({
      by: ['costCategory', 'transactionType'],
      where: { companyId },
      _sum: { amount: true },
    });
    return grouped.map((row) => ({
      costCategory: row.costCategory,
      transactionType: row.transactionType,
      total: Number(row._sum.amount ?? 0),
    }));
  }

  async getCompanyBudgetTotal(companyId: string): Promise<number> {
    const result = await this.prisma.budgetLine.aggregate({
      where: { budget: { project: { companyId } } },
      _sum: { budgetedAmount: true },
    });
    return Number(result._sum.budgetedAmount ?? 0);
  }
}
