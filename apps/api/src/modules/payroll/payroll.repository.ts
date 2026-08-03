import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { PayrollPeriodStatus } from './payroll.types';

const payrollPeriodDetailInclude = {
  exports: { include: { lines: true, exporter: { select: { id: true, fullName: true } } } },
} satisfies Prisma.PayrollPeriodInclude;

export type PayrollPeriodWithDetail = Prisma.PayrollPeriodGetPayload<{ include: typeof payrollPeriodDetailInclude }>;

export interface PayrollExportLineInput {
  userId: string;
  regularHours: number;
  overtimeHours: number;
  allowances: number;
  deductions: number;
  statutoryEmployeeContribution: number;
  statutoryEmployerContribution: number;
  netPay: number;
}

@Injectable()
export class PayrollRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createPeriod(companyId: string, periodStart: Date, periodEnd: Date) {
    return this.prisma.payrollPeriod.create({ data: { companyId, periodStart, periodEnd, status: 'open' } });
  }

  async findPeriodById(companyId: string, id: string): Promise<PayrollPeriodWithDetail | null> {
    return this.prisma.payrollPeriod.findFirst({ where: { id, companyId }, include: payrollPeriodDetailInclude });
  }

  async listPeriods(companyId: string) {
    return this.prisma.payrollPeriod.findMany({ where: { companyId }, orderBy: { periodStart: 'desc' } });
  }

  /** See VariationOrdersRepository.tryTransitionStatus for why this exists. */
  async tryTransitionPeriodStatus(
    companyId: string,
    id: string,
    fromStatus: PayrollPeriodStatus,
    toStatus: PayrollPeriodStatus,
  ): Promise<boolean> {
    const result = await this.prisma.payrollPeriod.updateMany({
      where: { id, companyId, status: fromStatus },
      data: { status: toStatus },
    });
    return result.count === 1;
  }

  async createRule(
    companyId: string,
    data: Omit<Prisma.StatutoryContributionRuleUncheckedCreateInput, 'companyId'>,
  ) {
    return this.prisma.statutoryContributionRule.create({ data: { ...data, companyId } });
  }

  async listRules(companyId: string) {
    return this.prisma.statutoryContributionRule.findMany({
      where: { companyId },
      orderBy: [{ countryCode: 'asc' }, { scheme: 'asc' }, { effectiveFrom: 'desc' }],
    });
  }

  /**
   * The status guard is folded into this same update (not a separate
   * tryTransitionStatus + write) because the export and its lines have
   * to be created in the same transaction as the guard succeeding —
   * same shape as InvoicesRepository.recordPayment's atomic guard.
   */
  async createExport(
    companyId: string,
    payrollPeriodId: string,
    exportedBy: string,
    format: string,
    lines: PayrollExportLineInput[],
  ): Promise<PayrollPeriodWithDetail> {
    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.payrollPeriod.updateMany({
        where: { id: payrollPeriodId, companyId, status: { in: ['open', 'processing'] } },
        data: { status: 'exported' },
      });
      if (claimed.count === 0) {
        throw new BadRequestException(
          'This payroll period is not open for export (already exported/closed, or lost a concurrent race).',
        );
      }

      await tx.payrollExport.create({
        data: {
          payrollPeriodId,
          exportedBy,
          format,
          lines: { create: lines },
        },
      });

      return tx.payrollPeriod.findUniqueOrThrow({ where: { id: payrollPeriodId }, include: payrollPeriodDetailInclude });
    });
  }
}
