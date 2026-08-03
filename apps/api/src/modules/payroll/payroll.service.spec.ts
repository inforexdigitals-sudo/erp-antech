import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { TimesheetsRepository } from '../timesheets/timesheets.repository';
import { UsersRepository } from '../users/users.repository';
import { PayrollRepository } from './payroll.repository';
import { PayrollService } from './payroll.service';

const COMPANY_ID = 'company-1';
const USER_ID = 'user-1';
const PERIOD_ID = 'period-1';

function makePeriod(overrides: Record<string, unknown> = {}) {
  return {
    id: PERIOD_ID,
    companyId: COMPANY_ID,
    periodStart: new Date('2026-07-01'),
    periodEnd: new Date('2026-07-31'),
    status: 'open',
    exports: [],
    ...overrides,
  };
}

describe('PayrollService', () => {
  let service: PayrollService;
  let repository: jest.Mocked<
    Pick<PayrollRepository, 'createPeriod' | 'findPeriodById' | 'listPeriods' | 'createExport' | 'createRule' | 'listRules'>
  >;
  let timesheets: jest.Mocked<Pick<TimesheetsRepository, 'sumApprovedHoursByUser'>>;
  let users: jest.Mocked<Pick<UsersRepository, 'findByIdForCompany'>>;

  beforeEach(() => {
    repository = {
      createPeriod: jest.fn(),
      findPeriodById: jest.fn().mockResolvedValue(makePeriod()),
      listPeriods: jest.fn(),
      createExport: jest.fn().mockResolvedValue(makePeriod({ status: 'exported' })),
      createRule: jest.fn(),
      listRules: jest.fn(),
    };
    timesheets = {
      sumApprovedHoursByUser: jest.fn().mockResolvedValue(new Map([['worker-1', { regularHours: 80, overtimeHours: 4 }]])),
    };
    users = { findByIdForCompany: jest.fn().mockResolvedValue({ id: 'worker-1' }) };

    service = new PayrollService(
      repository as unknown as PayrollRepository,
      timesheets as unknown as TimesheetsRepository,
      users as unknown as UsersRepository,
      { record: jest.fn() } as unknown as AuditService,
    );
  });

  describe('createPeriod', () => {
    it('rejects an end date before the start date', async () => {
      await expect(
        service.createPeriod(COMPANY_ID, USER_ID, { periodStart: '2026-07-31', periodEnd: '2026-07-01' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('generateExport', () => {
    it('rejects a user outside the tenant', async () => {
      users.findByIdForCompany.mockResolvedValue(null);
      await expect(
        service.generateExport(COMPANY_ID, PERIOD_ID, USER_ID, { lines: [{ userId: 'not-mine', netPay: 1000 }] }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.createExport).not.toHaveBeenCalled();
    });

    it('refuses to export an already-exported period', async () => {
      repository.findPeriodById.mockResolvedValue(makePeriod({ status: 'exported' }) as never);
      await expect(
        service.generateExport(COMPANY_ID, PERIOD_ID, USER_ID, { lines: [{ userId: 'worker-1', netPay: 1000 }] }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects an export with the same user listed twice', async () => {
      await expect(
        service.generateExport(COMPANY_ID, PERIOD_ID, USER_ID, {
          lines: [
            { userId: 'worker-1', netPay: 1000 },
            { userId: 'worker-1', netPay: 500 },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.createExport).not.toHaveBeenCalled();
    });

    it('pulls regular/overtime hours from approved timesheets, ignoring any hours the caller might supply', async () => {
      await service.generateExport(COMPANY_ID, PERIOD_ID, USER_ID, {
        lines: [{ userId: 'worker-1', netPay: 1000 }],
      });

      expect(repository.createExport).toHaveBeenCalledWith(
        COMPANY_ID,
        PERIOD_ID,
        USER_ID,
        'csv',
        expect.arrayContaining([expect.objectContaining({ userId: 'worker-1', regularHours: 80, overtimeHours: 4, netPay: 1000 })]),
      );
    });

    it('defaults hours to zero for a user with no approved timesheets in the period', async () => {
      await service.generateExport(COMPANY_ID, PERIOD_ID, USER_ID, {
        lines: [{ userId: 'worker-2', netPay: 500 }],
      });

      expect(repository.createExport).toHaveBeenCalledWith(
        COMPANY_ID,
        PERIOD_ID,
        USER_ID,
        'csv',
        expect.arrayContaining([expect.objectContaining({ userId: 'worker-2', regularHours: 0, overtimeHours: 0 })]),
      );
    });
  });

  describe('toCsv', () => {
    it('throws when the period has no export yet', () => {
      expect(() => service.toCsv(makePeriod() as never)).toThrow(BadRequestException);
    });

    it('renders the latest export as CSV', () => {
      const period = makePeriod({
        exports: [
          {
            lines: [
              {
                userId: 'worker-1',
                regularHours: 80,
                overtimeHours: 4,
                allowances: 50,
                deductions: 10,
                statutoryEmployeeContribution: 20,
                statutoryEmployerContribution: 17,
                netPay: 1000,
              },
            ],
          },
        ],
      });

      const csv = service.toCsv(period as never);
      expect(csv).toContain('user_id,regular_hours');
      expect(csv).toContain('worker-1,80,4,50,10,20,17,1000');
    });
  });
});
