import { AuditService } from '../../common/audit/audit.service';
import { CostingService } from '../project-costing/project-costing.service';
import { DashboardRepository } from './dashboard.repository';
import { DashboardService } from './dashboard.service';

const COMPANY_ID = 'company-1';
const USER_ID = 'user-1';

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

describe('DashboardService', () => {
  let service: DashboardService;
  let repository: jest.Mocked<
    Pick<
      DashboardRepository,
      | 'getOpenProjects'
      | 'getOutstandingQuotations'
      | 'getPendingApprovalsForUser'
      | 'getOpenPurchaseOrdersByStatus'
      | 'getOutstandingClaims'
      | 'getUnpaidInvoicesTotal'
      | 'getOpenPurchaseOrdersTotal'
      | 'getLatestPayrollNetPayTotal'
      | 'getTodayAttendanceCount'
    >
  >;
  let costing: jest.Mocked<Pick<CostingService, 'getCompanyDashboard'>>;
  let audit: jest.Mocked<Pick<AuditService, 'listRecent'>>;

  beforeEach(() => {
    repository = {
      getOpenProjects: jest.fn().mockResolvedValue([]),
      getOutstandingQuotations: jest.fn().mockResolvedValue([]),
      getPendingApprovalsForUser: jest.fn().mockResolvedValue([]),
      getOpenPurchaseOrdersByStatus: jest.fn().mockResolvedValue([]),
      getOutstandingClaims: jest.fn().mockResolvedValue([]),
      getUnpaidInvoicesTotal: jest.fn().mockResolvedValue(0),
      getOpenPurchaseOrdersTotal: jest.fn().mockResolvedValue(0),
      getLatestPayrollNetPayTotal: jest.fn().mockResolvedValue(0),
      getTodayAttendanceCount: jest.fn().mockResolvedValue(0),
    };
    costing = { getCompanyDashboard: jest.fn() };
    audit = { listRecent: jest.fn() };

    service = new DashboardService(
      repository as unknown as DashboardRepository,
      costing as unknown as CostingService,
      audit as unknown as AuditService,
    );
  });

  describe('getPortfolio', () => {
    it('buckets a project with no planned end date as on_track', async () => {
      repository.getOpenProjects.mockResolvedValue([
        { id: 'p1', name: 'A', projectNumber: 'PRJ-0001', status: 'active', plannedEndDate: null, actualEndDate: null },
      ] as never);
      const result = await service.getPortfolio(COMPANY_ID);
      expect(result.buckets.on_track).toBe(1);
    });

    it('buckets a completed project as closed even if its planned date is in the past', async () => {
      repository.getOpenProjects.mockResolvedValue([
        { id: 'p1', name: 'A', projectNumber: 'PRJ-0001', status: 'completed', plannedEndDate: daysFromNow(-30), actualEndDate: null },
      ] as never);
      const result = await service.getPortfolio(COMPANY_ID);
      expect(result.buckets.closed).toBe(1);
    });

    it('buckets an overdue open project as delayed', async () => {
      repository.getOpenProjects.mockResolvedValue([
        { id: 'p1', name: 'A', projectNumber: 'PRJ-0001', status: 'active', plannedEndDate: daysFromNow(-1), actualEndDate: null },
      ] as never);
      const result = await service.getPortfolio(COMPANY_ID);
      expect(result.buckets.delayed).toBe(1);
    });

    it('buckets a project due within the at-risk window as at_risk', async () => {
      repository.getOpenProjects.mockResolvedValue([
        { id: 'p1', name: 'A', projectNumber: 'PRJ-0001', status: 'active', plannedEndDate: daysFromNow(5), actualEndDate: null },
      ] as never);
      const result = await service.getPortfolio(COMPANY_ID);
      expect(result.buckets.at_risk).toBe(1);
    });

    it('buckets a completed-on-time project (actualEndDate set) as on_track, not delayed', async () => {
      repository.getOpenProjects.mockResolvedValue([
        { id: 'p1', name: 'A', projectNumber: 'PRJ-0001', status: 'active', plannedEndDate: daysFromNow(-30), actualEndDate: daysFromNow(-31) },
      ] as never);
      const result = await service.getPortfolio(COMPANY_ID);
      expect(result.buckets.on_track).toBe(1);
      expect(result.buckets.delayed).toBe(0);
    });
  });

  describe('getMyPendingApprovals', () => {
    it('passes the current user through to the repository and maps the shape', async () => {
      repository.getPendingApprovalsForUser.mockResolvedValue([
        { id: 'req-1', entityType: 'claim', entityId: 'claim-1', currentStepOrder: 1, createdAt: new Date() },
      ] as never);
      const result = await service.getMyPendingApprovals(COMPANY_ID, USER_ID);
      expect(repository.getPendingApprovalsForUser).toHaveBeenCalledWith(COMPANY_ID, USER_ID);
      expect(result).toEqual([expect.objectContaining({ entityType: 'claim', entityId: 'claim-1' })]);
    });
  });

  describe('getCashFlowApproximation', () => {
    it('nets inflow against combined PO + payroll outflow', async () => {
      repository.getUnpaidInvoicesTotal.mockResolvedValue(10000);
      repository.getOpenPurchaseOrdersTotal.mockResolvedValue(4000);
      repository.getLatestPayrollNetPayTotal.mockResolvedValue(3000);

      const result = await service.getCashFlowApproximation(COMPANY_ID);

      expect(result).toEqual({
        inflow: 10000,
        outflow: 7000,
        outflowBreakdown: { purchaseOrders: 4000, payroll: 3000 },
        net: 3000,
      });
    });
  });
});
