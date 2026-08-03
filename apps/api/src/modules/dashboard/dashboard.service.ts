import { Injectable } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { CostingDashboard, CostingService } from '../project-costing/project-costing.service';
import { DashboardRepository } from './dashboard.repository';

const AT_RISK_WINDOW_DAYS = 14;
const CLOSED_PROJECT_STATUSES = ['completed', 'closed'];

export type PortfolioBucket = 'on_track' | 'at_risk' | 'delayed' | 'closed';

export interface PortfolioSummary {
  buckets: Record<PortfolioBucket, number>;
  projects: Array<{ id: string; name: string; projectNumber: string; status: string; bucket: PortfolioBucket }>;
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / 86_400_000);
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly repository: DashboardRepository,
    private readonly costing: CostingService,
    private readonly audit: AuditService,
  ) {}

  /** FR-1.1 — on-track/at-risk/delayed/closed, derived (no such column exists — see bucketProject). */
  async getPortfolio(companyId: string): Promise<PortfolioSummary> {
    const projects = await this.repository.getOpenProjects(companyId);
    const today = new Date();
    const buckets: Record<PortfolioBucket, number> = { on_track: 0, at_risk: 0, delayed: 0, closed: 0 };
    const rows = projects.map((project) => {
      const bucket = this.bucketProject(project, today);
      buckets[bucket]++;
      return { id: project.id, name: project.name, projectNumber: project.projectNumber, status: project.status, bucket };
    });
    return { buckets, projects: rows };
  }

  private bucketProject(
    project: { status: string; plannedEndDate: Date | null; actualEndDate: Date | null },
    today: Date,
  ): PortfolioBucket {
    if (CLOSED_PROJECT_STATUSES.includes(project.status)) return 'closed';
    if (project.actualEndDate || !project.plannedEndDate) return 'on_track';
    const daysUntilDue = daysBetween(project.plannedEndDate, today);
    if (daysUntilDue < 0) return 'delayed';
    if (daysUntilDue <= AT_RISK_WINDOW_DAYS) return 'at_risk';
    return 'on_track';
  }

  /** FR-1.2 — count, value, aging of quotations still in flight. */
  async getOutstandingQuotations(companyId: string) {
    const quotations = await this.repository.getOutstandingQuotations(companyId);
    const today = new Date();
    const rows = quotations.map((q) => ({
      id: q.id,
      quotationNumber: q.quotationNumber,
      status: q.status,
      value: Number(q.currentRevision?.total ?? 0),
      agingDays: daysBetween(today, q.createdAt),
    }));
    return {
      count: rows.length,
      totalValue: rows.reduce((sum, r) => sum + r.value, 0),
      quotations: rows,
    };
  }

  /** FR-1.3 — pending approvals routed to the calling user. */
  async getMyPendingApprovals(companyId: string, userId: string) {
    const requests = await this.repository.getPendingApprovalsForUser(companyId, userId);
    return requests.map((r) => ({ approvalRequestId: r.id, entityType: r.entityType, entityId: r.entityId, createdAt: r.createdAt }));
  }

  /** FR-1.4 — open POs and procurement status. */
  async getOpenProcurement(companyId: string) {
    return this.repository.getOpenPurchaseOrdersByStatus(companyId);
  }

  /** FR-1.5 — outstanding claims (client + subcontractor), with aging. */
  async getOutstandingClaims(companyId: string) {
    const claims = await this.repository.getOutstandingClaims(companyId);
    const today = new Date();
    const rows = claims.map((c) => ({
      id: c.id,
      claimNumber: c.claimNumber,
      claimType: c.claimType,
      status: c.status,
      netClaimAmount: Number(c.netClaimAmount),
      agingDays: daysBetween(today, c.createdAt),
    }));
    return {
      count: rows.length,
      totalValue: rows.reduce((sum, r) => sum + r.netClaimAmount, 0),
      claims: rows,
    };
  }

  /** FR-1.6 — company-wide budget vs. actual vs. forecast (delegates to CostingService.getCompanyDashboard). */
  async getCostingRollup(companyId: string): Promise<CostingDashboard> {
    return this.costing.getCompanyDashboard(companyId);
  }

  /**
   * FR-1.7 — cash flow approximation. Inflows: unpaid invoice balance
   * (claims/invoices, the actual receivable — not gross claim value,
   * since retention/uninvoiced amounts aren't cash owed yet). Outflows:
   * open (non-closed, non-cancelled, non-draft) PO totals + the most
   * recent payroll export's net pay. This is a snapshot of outstanding
   * commitments, not a real cash-flow forecast with timing — POs have
   * no payment-tracking of their own in this schema (no
   * supplier-payments table), so "outflow" here means committed
   * spend, not cash that has actually left the business. Flagged as an
   * approximation, not fixed, since building real AP tracking is a
   * separate module's worth of work.
   */
  async getCashFlowApproximation(companyId: string) {
    const [inflow, poOutflow, payrollOutflow] = await Promise.all([
      this.repository.getUnpaidInvoicesTotal(companyId),
      this.repository.getOpenPurchaseOrdersTotal(companyId),
      this.repository.getLatestPayrollNetPayTotal(companyId),
    ]);
    return {
      inflow,
      outflow: poOutflow + payrollOutflow,
      outflowBreakdown: { purchaseOrders: poOutflow, payroll: payrollOutflow },
      net: inflow - (poOutflow + payrollOutflow),
    };
  }

  /** FR-1.8 — today's clocked-in headcount. */
  async getTodayAttendance(companyId: string) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const count = await this.repository.getTodayAttendanceCount(companyId, today);
    return { date: today.toISOString().slice(0, 10), clockedInCount: count };
  }

  /**
   * FR-1.9 — audit-log-backed activity feed. The notification-feed
   * half of this requirement has no backing data: Notifications
   * (module 17) doesn't exist yet, so there's nothing to show there —
   * this endpoint only ever returns the activity feed.
   */
  async getRecentActivity(companyId: string, limit = 20) {
    return this.audit.listRecent(companyId, limit);
  }
}
