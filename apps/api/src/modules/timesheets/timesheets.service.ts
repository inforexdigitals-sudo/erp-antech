import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Timesheet } from '@prisma/client';
import { ApprovalService } from '../../common/approval/approval.service';
import { AuditService } from '../../common/audit/audit.service';
import { PaginatedResult, PaginationQueryDto, paginate } from '../../common/dto/pagination.dto';
import { AllocateHoursDto } from './dto/allocate-hours.dto';
import { ClockDto } from './dto/clock.dto';
import { CreateManualTimesheetDto } from './dto/create-manual-timesheet.dto';
import { DEFAULT_DAILY_OVERTIME_THRESHOLD_HOURS, TimesheetStatus } from './timesheet.types';
import { TimesheetWithDetail, TimesheetsRepository } from './timesheets.repository';

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Truncates to a calendar date at UTC midnight, matching how Prisma
 * reads/writes a `@db.Date` column. Deliberately naive about site
 * timezones — a user clocking in near midnight local time on a site in
 * a non-UTC zone could land on the "wrong" calendar day. No
 * per-company/site timezone configuration exists yet to do this
 * properly; flagged, not silently assumed correct.
 */
function todayDateOnly(): Date {
  const iso = new Date().toISOString().slice(0, 10);
  return new Date(`${iso}T00:00:00.000Z`);
}

@Injectable()
export class TimesheetsService {
  constructor(
    private readonly repository: TimesheetsRepository,
    private readonly approval: ApprovalService,
    private readonly audit: AuditService,
  ) {}

  /** Mobile field flow. One shift per calendar day — timesheets.UNIQUE(user_id, work_date) doesn't support multiple clock-in/out cycles in a day. */
  async clockIn(companyId: string, userId: string, dto: ClockDto): Promise<Timesheet> {
    const today = todayDateOnly();
    const existing = await this.repository.findByUserAndDate(companyId, userId, today);
    if (existing?.clockOut) {
      throw new ForbiddenException("Today's timesheet is already complete — clocking in again isn't supported for the same day.");
    }
    if (existing?.clockIn) {
      throw new ForbiddenException('Already clocked in today.');
    }

    const timesheet = await this.repository.create({
      companyId,
      userId,
      workDate: today,
      clockIn: new Date(),
      clockInLat: dto.lat,
      clockInLng: dto.lng,
      status: 'draft',
    });

    await this.audit.record({ companyId, actorUserId: userId, action: 'clock_in', entityType: 'timesheet', entityId: timesheet.id });
    return timesheet;
  }

  async clockOut(companyId: string, userId: string, dto: ClockDto): Promise<Timesheet> {
    const today = todayDateOnly();
    const existing = await this.repository.findByUserAndDate(companyId, userId, today);
    if (!existing?.clockIn) {
      throw new BadRequestException("You haven't clocked in today.");
    }
    if (existing.clockOut) {
      throw new ForbiddenException('Already clocked out today.');
    }

    const clockOut = new Date();
    const totalHours = round2((clockOut.getTime() - existing.clockIn.getTime()) / 3_600_000);
    const overtimeHours = round2(Math.max(0, totalHours - DEFAULT_DAILY_OVERTIME_THRESHOLD_HOURS));

    const timesheet = await this.repository.update(companyId, existing.id, {
      clockOut,
      clockOutLat: dto.lat,
      clockOutLng: dto.lng,
      totalHours,
      overtimeHours,
    });

    await this.audit.record({
      companyId,
      actorUserId: userId,
      action: 'clock_out',
      entityType: 'timesheet',
      entityId: timesheet.id,
      after: { totalHours, overtimeHours },
    });
    return timesheet;
  }

  /** Office/admin entry for a day already worked, or backfilling a missed clock-in/out. */
  async createManual(companyId: string, actorUserId: string, dto: CreateManualTimesheetDto): Promise<Timesheet> {
    const targetUserId = dto.userId ?? actorUserId;
    const workDate = new Date(`${dto.workDate}T00:00:00.000Z`);

    const existing = await this.repository.findByUserAndDate(companyId, targetUserId, workDate);
    if (existing) {
      throw new BadRequestException('A timesheet already exists for this user on this date.');
    }

    const timesheet = await this.repository.create({
      companyId,
      userId: targetUserId,
      workDate,
      totalHours: dto.totalHours,
      overtimeHours: dto.overtimeHours ?? 0,
      status: 'draft',
    });

    await this.audit.record({ companyId, actorUserId, action: 'create', entityType: 'timesheet', entityId: timesheet.id, after: timesheet });
    return timesheet;
  }

  async findOne(companyId: string, id: string): Promise<TimesheetWithDetail> {
    const timesheet = await this.repository.findDetailById(companyId, id);
    if (!timesheet) {
      throw new NotFoundException('Timesheet not found.');
    }
    return timesheet;
  }

  async list(
    companyId: string,
    query: PaginationQueryDto & { status?: string; userId?: string },
  ): Promise<PaginatedResult<TimesheetWithDetail>> {
    const { data, total } = await this.repository.list(companyId, query);
    return paginate(data, total, query);
  }

  /** Only while draft — submitting locks the allocation in for approval. */
  async allocateHours(companyId: string, id: string, actorUserId: string, dto: AllocateHoursDto): Promise<TimesheetWithDetail> {
    const timesheet = await this.findOne(companyId, id);
    if (timesheet.status !== 'draft') {
      throw new ForbiddenException('Hours can only be reallocated while the timesheet is in draft.');
    }

    const totalAllocated = round2(dto.allocations.reduce((sum, a) => sum + a.hours, 0));
    if (Number(timesheet.totalHours) > 0 && totalAllocated > Number(timesheet.totalHours)) {
      throw new BadRequestException(
        `Allocated hours (${totalAllocated}) cannot exceed the timesheet's total hours (${Number(timesheet.totalHours)}).`,
      );
    }

    await this.repository.replaceAllocations(id, dto.allocations);

    await this.audit.record({
      companyId,
      actorUserId,
      action: 'update',
      entityType: 'timesheet_allocation',
      entityId: id,
      after: dto.allocations,
    });
    return this.findOne(companyId, id);
  }

  async submitForApproval(companyId: string, id: string, actorUserId: string): Promise<TimesheetWithDetail> {
    const timesheet = await this.findOne(companyId, id);
    if (timesheet.status !== 'draft') {
      throw new ForbiddenException('Only a draft timesheet can be submitted for approval.');
    }
    if (timesheet.allocations.length === 0) {
      throw new BadRequestException('Allocate hours to at least one project before submitting.');
    }

    const claimed = await this.repository.tryTransitionStatus(companyId, id, 'draft', 'submitted');
    if (!claimed) {
      throw new ForbiddenException('This timesheet was already submitted by someone else.');
    }

    const request = await this.approval.start({ companyId, module: 'timesheet', entityType: 'timesheet', entityId: id });
    if (request.status === 'approved') {
      await this.repository.tryTransitionStatus(companyId, id, 'submitted', 'approved', {
        approvedBy: actorUserId,
        approvedAt: new Date(),
      });
    }

    await this.audit.record({ companyId, actorUserId, action: 'submit_for_approval', entityType: 'timesheet', entityId: id });
    return this.findOne(companyId, id);
  }

  /**
   * No cost-ledger wiring: FR-10.2 wants an approved timesheet to write
   * an 'actual'/'labour' cost_transactions row, but that needs a
   * wage-rate source (per-user hourly rate, or a role/cost-code rate
   * table) that doesn't exist anywhere in this schema. Inventing one
   * here would mean fabricating financial data — deferred until a real
   * rate source is designed, likely alongside Payroll (module 12).
   */
  async decide(
    companyId: string,
    id: string,
    actorUserId: string,
    decision: 'approved' | 'rejected',
    comments?: string,
  ): Promise<TimesheetWithDetail> {
    const timesheet = await this.findOne(companyId, id);
    if (timesheet.status !== 'submitted') {
      throw new ForbiddenException('This timesheet is not awaiting approval.');
    }

    const openRequest = await this.approval.getOpenRequestForEntity(companyId, 'timesheet', id);
    if (!openRequest) {
      throw new BadRequestException('No open approval request found for this timesheet.');
    }

    const result = await this.approval.decide({ companyId, approvalRequestId: openRequest.id, actorUserId, decision, comments });

    const nextStatus: TimesheetStatus =
      result.status === 'approved' ? 'approved' : result.status === 'rejected' ? 'rejected' : 'submitted';
    if (nextStatus !== 'submitted') {
      const extra = nextStatus === 'approved' ? { approvedBy: actorUserId, approvedAt: new Date() } : {};
      await this.repository.tryTransitionStatus(companyId, id, 'submitted', nextStatus, extra);
    }
    return this.findOne(companyId, id);
  }
}
