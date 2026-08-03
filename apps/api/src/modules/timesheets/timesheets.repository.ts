import { Injectable } from '@nestjs/common';
import { Prisma, Timesheet } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { TimesheetStatus } from './timesheet.types';

const timesheetDetailInclude = {
  allocations: { include: { project: { select: { id: true, name: true, projectNumber: true } } } },
  user: { select: { id: true, fullName: true } },
} satisfies Prisma.TimesheetInclude;

export type TimesheetWithDetail = Prisma.TimesheetGetPayload<{ include: typeof timesheetDetailInclude }>;

@Injectable()
export class TimesheetsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserAndDate(companyId: string, userId: string, workDate: Date): Promise<Timesheet | null> {
    return this.prisma.timesheet.findFirst({ where: { companyId, userId, workDate } });
  }

  async create(data: Prisma.TimesheetUncheckedCreateInput): Promise<Timesheet> {
    return this.prisma.timesheet.create({ data });
  }

  async update(companyId: string, id: string, data: Prisma.TimesheetUncheckedUpdateInput): Promise<Timesheet> {
    return this.prisma.timesheet.update({ where: { id, companyId }, data });
  }

  async findDetailById(companyId: string, id: string): Promise<TimesheetWithDetail | null> {
    return this.prisma.timesheet.findFirst({ where: { id, companyId }, include: timesheetDetailInclude });
  }

  async list(
    companyId: string,
    query: PaginationQueryDto & { status?: string; userId?: string },
  ): Promise<{ data: TimesheetWithDetail[]; total: number }> {
    const where: Prisma.TimesheetWhereInput = { companyId, status: query.status, userId: query.userId };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.timesheet.findMany({
        where,
        include: timesheetDetailInclude,
        skip: query.skip,
        take: query.take,
        orderBy: { workDate: 'desc' },
      }),
      this.prisma.timesheet.count({ where }),
    ]);
    return { data, total };
  }

  async replaceAllocations(timesheetId: string, allocations: Array<{ projectId: string; hours: number }>): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.timesheetAllocation.deleteMany({ where: { timesheetId } }),
      this.prisma.timesheetAllocation.createMany({
        data: allocations.map((a) => ({ timesheetId, projectId: a.projectId, hours: a.hours })),
      }),
    ]);
  }

  /** See PurchaseOrdersRepository.tryTransitionStatus for why this exists. */
  async tryTransitionStatus(
    companyId: string,
    id: string,
    fromStatus: TimesheetStatus,
    toStatus: TimesheetStatus,
    extra: Partial<{ approvedBy: string; approvedAt: Date }> = {},
  ): Promise<boolean> {
    const result = await this.prisma.timesheet.updateMany({
      where: { id, companyId, status: fromStatus },
      data: { status: toStatus, ...extra },
    });
    return result.count === 1;
  }

  /**
   * FR-12.4 — payroll's hours figures are read-derived from approved
   * timesheets, never re-entered. `totalHours` already includes
   * `overtimeHours` (see `TimesheetsService.clockOut`), so regular =
   * total - overtime.
   */
  async sumApprovedHoursByUser(
    companyId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<Map<string, { regularHours: number; overtimeHours: number }>> {
    const rows = await this.prisma.timesheet.findMany({
      where: { companyId, status: 'approved', workDate: { gte: periodStart, lte: periodEnd } },
      select: { userId: true, totalHours: true, overtimeHours: true },
    });

    const totals = new Map<string, { regularHours: number; overtimeHours: number }>();
    for (const row of rows) {
      const overtimeHours = Number(row.overtimeHours);
      const regularHours = Number(row.totalHours) - overtimeHours;
      const existing = totals.get(row.userId) ?? { regularHours: 0, overtimeHours: 0 };
      totals.set(row.userId, {
        regularHours: existing.regularHours + regularHours,
        overtimeHours: existing.overtimeHours + overtimeHours,
      });
    }
    return totals;
  }
}
