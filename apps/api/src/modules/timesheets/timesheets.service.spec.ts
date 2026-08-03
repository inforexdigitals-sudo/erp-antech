import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ApprovalService } from '../../common/approval/approval.service';
import { AuditService } from '../../common/audit/audit.service';
import { TimesheetsRepository } from './timesheets.repository';
import { TimesheetsService } from './timesheets.service';

const COMPANY_ID = 'company-1';
const USER_ID = 'user-1';
const TIMESHEET_ID = 'ts-1';

describe('TimesheetsService', () => {
  let service: TimesheetsService;
  let repository: jest.Mocked<
    Pick<TimesheetsRepository, 'findByUserAndDate' | 'create' | 'update' | 'findDetailById' | 'replaceAllocations' | 'tryTransitionStatus' | 'list'>
  >;
  let approval: jest.Mocked<Pick<ApprovalService, 'start' | 'decide' | 'getOpenRequestForEntity'>>;

  beforeEach(() => {
    repository = {
      findByUserAndDate: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findDetailById: jest.fn(),
      replaceAllocations: jest.fn(),
      tryTransitionStatus: jest.fn().mockResolvedValue(true),
      list: jest.fn(),
    };
    approval = { start: jest.fn(), decide: jest.fn(), getOpenRequestForEntity: jest.fn() };

    service = new TimesheetsService(
      repository as unknown as TimesheetsRepository,
      approval as unknown as ApprovalService,
      { record: jest.fn() } as unknown as AuditService,
    );
  });

  describe('clockIn', () => {
    it('rejects clocking in twice on the same day', async () => {
      repository.findByUserAndDate.mockResolvedValue({ clockIn: new Date(), clockOut: null } as never);

      await expect(service.clockIn(COMPANY_ID, USER_ID, {})).rejects.toThrow(ForbiddenException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('rejects clocking in after already completing the day', async () => {
      repository.findByUserAndDate.mockResolvedValue({ clockIn: new Date(), clockOut: new Date() } as never);

      await expect(service.clockIn(COMPANY_ID, USER_ID, {})).rejects.toThrow(ForbiddenException);
    });

    it('creates a new draft timesheet when none exists for today', async () => {
      repository.findByUserAndDate.mockResolvedValue(null);
      repository.create.mockResolvedValue({ id: TIMESHEET_ID } as never);

      await service.clockIn(COMPANY_ID, USER_ID, { lat: 1.35, lng: 103.8 });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: USER_ID, status: 'draft', clockInLat: 1.35, clockInLng: 103.8 }),
      );
    });
  });

  describe('clockOut', () => {
    it('rejects clocking out without having clocked in', async () => {
      repository.findByUserAndDate.mockResolvedValue(null);
      await expect(service.clockOut(COMPANY_ID, USER_ID, {})).rejects.toThrow(BadRequestException);
    });

    it('rejects clocking out twice', async () => {
      repository.findByUserAndDate.mockResolvedValue({ clockIn: new Date(), clockOut: new Date() } as never);
      await expect(service.clockOut(COMPANY_ID, USER_ID, {})).rejects.toThrow(ForbiddenException);
    });

    it('computes total and overtime hours from the clock-in/out gap', async () => {
      const clockIn = new Date(Date.now() - 9.5 * 3_600_000); // 9.5 hours ago
      repository.findByUserAndDate.mockResolvedValue({ id: TIMESHEET_ID, clockIn, clockOut: null } as never);
      repository.update.mockResolvedValue({ id: TIMESHEET_ID } as never);

      await service.clockOut(COMPANY_ID, USER_ID, {});

      expect(repository.update).toHaveBeenCalledWith(
        COMPANY_ID,
        TIMESHEET_ID,
        expect.objectContaining({ totalHours: 9.5, overtimeHours: 1.5 }), // 9.5 - 8 threshold
      );
    });
  });

  describe('allocateHours', () => {
    it('refuses to reallocate a non-draft timesheet', async () => {
      repository.findDetailById.mockResolvedValue({ id: TIMESHEET_ID, status: 'submitted', totalHours: 8 } as never);

      await expect(
        service.allocateHours(COMPANY_ID, TIMESHEET_ID, USER_ID, { allocations: [{ projectId: 'p1', hours: 4 }] }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects allocating more hours than were worked', async () => {
      repository.findDetailById.mockResolvedValue({ id: TIMESHEET_ID, status: 'draft', totalHours: 8 } as never);

      await expect(
        service.allocateHours(COMPANY_ID, TIMESHEET_ID, USER_ID, {
          allocations: [{ projectId: 'p1', hours: 5 }, { projectId: 'p2', hours: 5 }],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.replaceAllocations).not.toHaveBeenCalled();
    });

    it('accepts allocations that sum to at most totalHours', async () => {
      repository.findDetailById.mockResolvedValue({ id: TIMESHEET_ID, status: 'draft', totalHours: 8, allocations: [] } as never);

      await service.allocateHours(COMPANY_ID, TIMESHEET_ID, USER_ID, {
        allocations: [{ projectId: 'p1', hours: 5 }, { projectId: 'p2', hours: 3 }],
      });

      expect(repository.replaceAllocations).toHaveBeenCalled();
    });
  });

  describe('submitForApproval', () => {
    it('refuses to submit a timesheet with no allocations', async () => {
      repository.findDetailById.mockResolvedValue({ id: TIMESHEET_ID, status: 'draft', allocations: [] } as never);

      await expect(service.submitForApproval(COMPANY_ID, TIMESHEET_ID, USER_ID)).rejects.toThrow(BadRequestException);
      expect(repository.tryTransitionStatus).not.toHaveBeenCalled();
    });

    it('rejects cleanly when it loses the atomic-claim race', async () => {
      repository.findDetailById.mockResolvedValue({ id: TIMESHEET_ID, status: 'draft', allocations: [{ projectId: 'p1' }] } as never);
      repository.tryTransitionStatus.mockResolvedValue(false);

      await expect(service.submitForApproval(COMPANY_ID, TIMESHEET_ID, USER_ID)).rejects.toThrow(ForbiddenException);
      expect(approval.start).not.toHaveBeenCalled();
    });
  });
});
