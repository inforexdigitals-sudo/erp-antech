import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ApprovalService } from '../../common/approval/approval.service';
import { AuditService } from '../../common/audit/audit.service';
import { LeaveRepository } from './leave.repository';
import { LeaveService } from './leave.service';

const COMPANY_ID = 'company-1';
const USER_ID = 'user-1';
const REQUEST_ID = 'leave-1';

function makeRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: REQUEST_ID,
    companyId: COMPANY_ID,
    userId: USER_ID,
    leaveTypeId: 'lt-1',
    status: 'pending',
    days: 3,
    startDate: new Date('2026-08-01'),
    leaveType: { annualEntitlementDays: 14 },
    ...overrides,
  };
}

describe('LeaveService', () => {
  let service: LeaveService;
  let repository: jest.Mocked<
    Pick<LeaveRepository, 'findLeaveTypeById' | 'createLeaveRequest' | 'findRequestById' | 'tryTransitionStatus' | 'incrementUsedDays' | 'listLeaveTypes' | 'createLeaveType'>
  >;
  let approval: jest.Mocked<Pick<ApprovalService, 'start' | 'decide' | 'getOpenRequestForEntity'>>;

  beforeEach(() => {
    repository = {
      findLeaveTypeById: jest.fn(),
      createLeaveRequest: jest.fn().mockResolvedValue(makeRequest()),
      findRequestById: jest.fn().mockResolvedValue(makeRequest()),
      tryTransitionStatus: jest.fn().mockResolvedValue(true),
      incrementUsedDays: jest.fn(),
      listLeaveTypes: jest.fn(),
      createLeaveType: jest.fn(),
    };
    approval = { start: jest.fn(), decide: jest.fn(), getOpenRequestForEntity: jest.fn() };

    service = new LeaveService(
      repository as unknown as LeaveRepository,
      approval as unknown as ApprovalService,
      { record: jest.fn() } as unknown as AuditService,
    );
  });

  describe('createLeaveRequest', () => {
    it('rejects a leave type outside the tenant', async () => {
      repository.findLeaveTypeById.mockResolvedValue(null);

      await expect(
        service.createLeaveRequest(COMPANY_ID, USER_ID, { leaveTypeId: 'not-mine', startDate: '2026-08-01', endDate: '2026-08-03', days: 3 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an end date before the start date', async () => {
      repository.findLeaveTypeById.mockResolvedValue({ id: 'lt-1' } as never);

      await expect(
        service.createLeaveRequest(COMPANY_ID, USER_ID, { leaveTypeId: 'lt-1', startDate: '2026-08-05', endDate: '2026-08-01', days: 3 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('opens an approval request through the shared engine on creation (no separate submit step)', async () => {
      repository.findLeaveTypeById.mockResolvedValue({ id: 'lt-1' } as never);
      approval.start.mockResolvedValue({ status: 'pending' } as never);

      await service.createLeaveRequest(COMPANY_ID, USER_ID, { leaveTypeId: 'lt-1', startDate: '2026-08-01', endDate: '2026-08-03', days: 3 });

      expect(approval.start).toHaveBeenCalledWith(
        expect.objectContaining({ companyId: COMPANY_ID, module: 'leave_request', entityType: 'leave_request' }),
      );
      expect(repository.incrementUsedDays).not.toHaveBeenCalled();
    });

    it('auto-approves and credits the leave balance immediately when no workflow is configured', async () => {
      repository.findLeaveTypeById.mockResolvedValue({ id: 'lt-1' } as never);
      approval.start.mockResolvedValue({ status: 'approved' } as never);

      await service.createLeaveRequest(COMPANY_ID, USER_ID, { leaveTypeId: 'lt-1', startDate: '2026-08-01', endDate: '2026-08-03', days: 3 });

      expect(repository.incrementUsedDays).toHaveBeenCalledWith(USER_ID, 'lt-1', 2026, 14, 3);
    });
  });

  describe('decide', () => {
    it('refuses to decide a request that is not pending', async () => {
      repository.findRequestById.mockResolvedValue(makeRequest({ status: 'approved' }) as never);

      await expect(service.decide(COMPANY_ID, REQUEST_ID, USER_ID, 'approved')).rejects.toThrow(ForbiddenException);
      expect(approval.decide).not.toHaveBeenCalled();
    });

    it('throws if no open approval request exists for a pending leave request (data integrity guard)', async () => {
      approval.getOpenRequestForEntity.mockResolvedValue(null);

      await expect(service.decide(COMPANY_ID, REQUEST_ID, USER_ID, 'approved')).rejects.toThrow(BadRequestException);
    });

    it('credits leave_balances only on approval, not rejection', async () => {
      approval.getOpenRequestForEntity.mockResolvedValue({ id: 'req-1' } as never);
      approval.decide.mockResolvedValue({ status: 'rejected' } as never);

      await service.decide(COMPANY_ID, REQUEST_ID, USER_ID, 'rejected');

      expect(repository.incrementUsedDays).not.toHaveBeenCalled();
      expect(repository.tryTransitionStatus).toHaveBeenCalledWith(COMPANY_ID, REQUEST_ID, 'pending', 'rejected', USER_ID);
    });

    it('credits leave_balances for the year the leave starts in, on approval', async () => {
      approval.getOpenRequestForEntity.mockResolvedValue({ id: 'req-1' } as never);
      approval.decide.mockResolvedValue({ status: 'approved' } as never);

      await service.decide(COMPANY_ID, REQUEST_ID, USER_ID, 'approved');

      expect(repository.incrementUsedDays).toHaveBeenCalledWith(USER_ID, 'lt-1', 2026, 14, 3);
    });
  });
});
