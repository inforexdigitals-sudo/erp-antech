import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PayrollPeriod, StatutoryContributionRule } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { TimesheetsRepository } from '../timesheets/timesheets.repository';
import { UsersRepository } from '../users/users.repository';
import { CreatePayrollPeriodDto } from './dto/create-payroll-period.dto';
import { CreateStatutoryRuleDto } from './dto/create-statutory-rule.dto';
import { GeneratePayrollExportDto } from './dto/generate-payroll-export.dto';
import { PayrollExportLineInput, PayrollPeriodWithDetail, PayrollRepository } from './payroll.repository';

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

@Injectable()
export class PayrollService {
  constructor(
    private readonly repository: PayrollRepository,
    private readonly timesheets: TimesheetsRepository,
    private readonly users: UsersRepository,
    private readonly audit: AuditService,
  ) {}

  async createPeriod(companyId: string, actorUserId: string, dto: CreatePayrollPeriodDto): Promise<PayrollPeriod> {
    const start = new Date(dto.periodStart);
    const end = new Date(dto.periodEnd);
    if (end < start) {
      throw new BadRequestException('periodEnd cannot be before periodStart.');
    }
    const period = await this.repository.createPeriod(companyId, start, end);
    await this.audit.record({ companyId, actorUserId, action: 'create', entityType: 'payroll_period', entityId: period.id, after: period });
    return period;
  }

  async findPeriod(companyId: string, id: string): Promise<PayrollPeriodWithDetail> {
    const period = await this.repository.findPeriodById(companyId, id);
    if (!period) {
      throw new NotFoundException('Payroll period not found.');
    }
    return period;
  }

  async listPeriods(companyId: string): Promise<PayrollPeriod[]> {
    return this.repository.listPeriods(companyId);
  }

  async createStatutoryRule(companyId: string, actorUserId: string, dto: CreateStatutoryRuleDto): Promise<StatutoryContributionRule> {
    const rule = await this.repository.createRule(companyId, {
      countryCode: dto.countryCode,
      scheme: dto.scheme,
      ageBand: dto.ageBand,
      employeeRate: dto.employeeRate,
      employerRate: dto.employerRate,
      salaryCeiling: dto.salaryCeiling,
      effectiveFrom: new Date(dto.effectiveFrom),
      effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : undefined,
    });
    await this.audit.record({
      companyId,
      actorUserId,
      action: 'create',
      entityType: 'statutory_contribution_rule',
      entityId: rule.id,
      after: rule,
    });
    return rule;
  }

  async listStatutoryRules(companyId: string): Promise<StatutoryContributionRule[]> {
    return this.repository.listRules(companyId);
  }

  /** FR-12.4 — a preview of what an export would auto-derive, before committing to one. */
  async previewHours(companyId: string, periodId: string): Promise<Array<{ userId: string; regularHours: number; overtimeHours: number }>> {
    const period = await this.findPeriod(companyId, periodId);
    const totals = await this.timesheets.sumApprovedHoursByUser(companyId, period.periodStart, period.periodEnd);
    return [...totals.entries()].map(([userId, hours]) => ({ userId, ...hours }));
  }

  /**
   * FR-12.1/12.3/12.4 — hours are always read-derived from approved
   * Timesheets for the period; every other figure on a line (FR-12.2's
   * statutory contributions, allowances, deductions, net pay) is a
   * snapshot of what was prepared externally, supplied by the caller —
   * see PayrollExportLineInputDto for why nothing here is computed from
   * a wage rate the schema doesn't have.
   */
  async generateExport(companyId: string, periodId: string, actorUserId: string, dto: GeneratePayrollExportDto): Promise<PayrollPeriodWithDetail> {
    const period = await this.findPeriod(companyId, periodId);
    if (period.status !== 'open' && period.status !== 'processing') {
      throw new ForbiddenException(`This payroll period is '${period.status}' and cannot be exported again.`);
    }

    const hoursByUser = await this.timesheets.sumApprovedHoursByUser(companyId, period.periodStart, period.periodEnd);

    // payroll_export_lines has no UNIQUE(payroll_export_id, user_id)
    // (db/migrations/0010) — nothing at the DB level would catch two
    // lines for the same employee silently double-counting their pay,
    // so it's guarded here instead.
    const seenUserIds = new Set<string>();
    for (const line of dto.lines) {
      if (seenUserIds.has(line.userId)) {
        throw new BadRequestException(`User ${line.userId} appears more than once in this export.`);
      }
      seenUserIds.add(line.userId);
    }

    const lines: PayrollExportLineInput[] = [];
    for (const line of dto.lines) {
      const user = await this.users.findByIdForCompany(companyId, line.userId);
      if (!user) {
        throw new BadRequestException(`User ${line.userId} not found.`);
      }
      const hours = hoursByUser.get(line.userId) ?? { regularHours: 0, overtimeHours: 0 };
      const allowances = line.allowances ?? 0;
      const deductions = line.deductions ?? 0;
      const statutoryEmployeeContribution = line.statutoryEmployeeContribution ?? 0;
      const statutoryEmployerContribution = line.statutoryEmployerContribution ?? 0;
      lines.push({
        userId: line.userId,
        regularHours: round2(hours.regularHours),
        overtimeHours: round2(hours.overtimeHours),
        allowances: round2(allowances),
        deductions: round2(deductions),
        statutoryEmployeeContribution: round2(statutoryEmployeeContribution),
        statutoryEmployerContribution: round2(statutoryEmployerContribution),
        netPay: round2(line.netPay),
      });
    }

    const updated = await this.repository.createExport(companyId, periodId, actorUserId, dto.format ?? 'csv', lines);

    await this.audit.record({
      companyId,
      actorUserId,
      action: 'generate_export',
      entityType: 'payroll_period',
      entityId: periodId,
      after: { lineCount: lines.length },
    });
    return updated;
  }

  /** FR-12.3 — a payroll-provider-friendly flat file. No header localization/column-mapping per provider yet — one fixed column set. */
  toCsv(period: PayrollPeriodWithDetail): string {
    const latestExport = period.exports[period.exports.length - 1];
    if (!latestExport) {
      throw new BadRequestException('This payroll period has no export yet.');
    }
    const header = 'user_id,regular_hours,overtime_hours,allowances,deductions,statutory_employee,statutory_employer,net_pay';
    const rows = latestExport.lines.map((line) =>
      [
        line.userId,
        line.regularHours,
        line.overtimeHours,
        line.allowances,
        line.deductions,
        line.statutoryEmployeeContribution,
        line.statutoryEmployerContribution,
        line.netPay,
      ].join(','),
    );
    return [header, ...rows].join('\n');
  }
}
