import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';

/**
 * Deliberate, scoped exception to "a service never imports PrismaClient,
 * only that module's repository does": Dashboard has no table of its
 * own — its entire job is read-only aggregation across tables every
 * other module already owns and protects with real business logic.
 * There is no mutation here, no invariant to guard, so there is nothing
 * the repository-per-module rule is actually protecting in this case —
 * unlike every other module in this codebase, which all perform real
 * writes. Reporting (module 15, not built this batch) would earn the
 * same exception for the same reason.
 */
@Injectable()
export class DashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getOpenProjects(companyId: string) {
    return this.prisma.project.findMany({
      where: { companyId, status: { notIn: ['cancelled'] } },
      select: { id: true, name: true, projectNumber: true, status: true, plannedEndDate: true, actualEndDate: true },
    });
  }

  async getOutstandingQuotations(companyId: string) {
    return this.prisma.quotation.findMany({
      where: { companyId, status: { in: ['pending_approval', 'approved', 'sent'] } },
      select: {
        id: true,
        quotationNumber: true,
        status: true,
        createdAt: true,
        currentRevision: { select: { total: true } },
      },
    });
  }

  /**
   * "Routed to the logged-in user" (FR-1.3): an approval_request is
   * mine if its current step names me directly, or names a role I
   * hold. Only entityType/entityId are returned, not a human label —
   * resolving a friendly name per entityType would need a per-module
   * lookup switch across 7+ entity types; left to the frontend, which
   * already has entityType-specific detail routes for each one.
   */
  async getPendingApprovalsForUser(companyId: string, userId: string) {
    const [requests, myRoleIds] = await Promise.all([
      this.prisma.approvalRequest.findMany({
        where: { companyId, status: 'pending' },
        select: {
          id: true,
          entityType: true,
          entityId: true,
          currentStepOrder: true,
          createdAt: true,
          workflow: { select: { steps: { select: { stepOrder: true, approverUserId: true, approverRoleId: true } } } },
        },
      }),
      this.prisma.userRole.findMany({ where: { userId }, select: { roleId: true } }),
    ]);

    const myRoleIdSet = new Set(myRoleIds.map((r) => r.roleId));
    return requests.filter((request) => {
      const step = request.workflow?.steps.find((s) => s.stepOrder === request.currentStepOrder);
      if (!step) return false;
      return step.approverUserId === userId || (step.approverRoleId !== null && myRoleIdSet.has(step.approverRoleId));
    });
  }

  async getOpenPurchaseOrdersByStatus(companyId: string) {
    const grouped = await this.prisma.purchaseOrder.groupBy({
      by: ['status'],
      where: { companyId, status: { notIn: ['closed', 'cancelled'] } },
      _count: { _all: true },
      _sum: { total: true },
    });
    return grouped.map((row) => ({ status: row.status, count: row._count._all, totalValue: Number(row._sum.total ?? 0) }));
  }

  async getOutstandingClaims(companyId: string) {
    return this.prisma.claim.findMany({
      where: { companyId, status: { notIn: ['paid', 'rejected'] } },
      select: { id: true, claimNumber: true, claimType: true, status: true, netClaimAmount: true, createdAt: true },
    });
  }

  async getUnpaidInvoicesTotal(companyId: string): Promise<number> {
    const result = await this.prisma.invoice.aggregate({
      where: { companyId, status: { in: ['sent', 'partially_paid', 'overdue'] } },
      _sum: { total: true, amountPaid: true },
    });
    return Number(result._sum.total ?? 0) - Number(result._sum.amountPaid ?? 0);
  }

  async getOpenPurchaseOrdersTotal(companyId: string): Promise<number> {
    const result = await this.prisma.purchaseOrder.aggregate({
      where: { companyId, status: { notIn: ['closed', 'cancelled', 'draft'] } },
      _sum: { total: true },
    });
    return Number(result._sum.total ?? 0);
  }

  async getLatestPayrollNetPayTotal(companyId: string): Promise<number> {
    const latestExport = await this.prisma.payrollExport.findFirst({
      where: { payrollPeriod: { companyId } },
      orderBy: { exportedAt: 'desc' },
      include: { lines: { select: { netPay: true } } },
    });
    if (!latestExport) return 0;
    return latestExport.lines.reduce((sum, line) => sum + Number(line.netPay), 0);
  }

  async getTodayAttendanceCount(companyId: string, today: Date): Promise<number> {
    return this.prisma.timesheet.count({
      where: { companyId, workDate: today, clockIn: { not: null } },
    });
  }
}
