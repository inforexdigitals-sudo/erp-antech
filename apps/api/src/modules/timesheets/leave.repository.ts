import { Injectable } from '@nestjs/common';
import { LeaveBalance, LeaveType, Prisma } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { LeaveRequestStatus } from './timesheet.types';

const leaveRequestDetailInclude = {
  leaveType: true,
  user: { select: { id: true, fullName: true } },
} satisfies Prisma.LeaveRequestInclude;

export type LeaveRequestWithDetail = Prisma.LeaveRequestGetPayload<{ include: typeof leaveRequestDetailInclude }>;

@Injectable()
export class LeaveRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createLeaveType(companyId: string, name: string, isPaid: boolean, annualEntitlementDays: number): Promise<LeaveType> {
    return this.prisma.leaveType.create({ data: { companyId, name, isPaid, annualEntitlementDays } });
  }

  async listLeaveTypes(companyId: string): Promise<LeaveType[]> {
    return this.prisma.leaveType.findMany({ where: { companyId }, orderBy: { name: 'asc' } });
  }

  async findLeaveTypeById(companyId: string, id: string): Promise<LeaveType | null> {
    return this.prisma.leaveType.findFirst({ where: { id, companyId } });
  }

  async createLeaveRequest(data: Prisma.LeaveRequestUncheckedCreateInput): Promise<LeaveRequestWithDetail> {
    const created = await this.prisma.leaveRequest.create({ data });
    return this.prisma.leaveRequest.findUniqueOrThrow({ where: { id: created.id }, include: leaveRequestDetailInclude });
  }

  async findRequestById(companyId: string, id: string): Promise<LeaveRequestWithDetail | null> {
    return this.prisma.leaveRequest.findFirst({ where: { id, companyId }, include: leaveRequestDetailInclude });
  }

  async listRequests(
    companyId: string,
    query: PaginationQueryDto & { status?: string; userId?: string },
  ): Promise<{ data: LeaveRequestWithDetail[]; total: number }> {
    const where: Prisma.LeaveRequestWhereInput = { companyId, status: query.status, userId: query.userId };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.leaveRequest.findMany({
        where,
        include: leaveRequestDetailInclude,
        skip: query.skip,
        take: query.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.leaveRequest.count({ where }),
    ]);
    return { data, total };
  }

  /** See PurchaseOrdersRepository.tryTransitionStatus for why this exists. */
  async tryTransitionStatus(
    companyId: string,
    id: string,
    fromStatus: LeaveRequestStatus,
    toStatus: LeaveRequestStatus,
    approvedBy?: string,
  ): Promise<boolean> {
    const result = await this.prisma.leaveRequest.updateMany({
      where: { id, companyId, status: fromStatus },
      data: { status: toStatus, approvedBy },
    });
    return result.count === 1;
  }

  /** Creates the balance row on first use (entitlement from the leave type) rather than requiring it to be pre-seeded. */
  async incrementUsedDays(userId: string, leaveTypeId: string, year: number, entitledDays: number, days: number): Promise<LeaveBalance> {
    return this.prisma.leaveBalance.upsert({
      where: { userId_leaveTypeId_year: { userId, leaveTypeId, year } },
      create: { userId, leaveTypeId, year, entitledDays, usedDays: days },
      update: { usedDays: { increment: days } },
    });
  }

  async getBalance(userId: string, leaveTypeId: string, year: number): Promise<LeaveBalance | null> {
    return this.prisma.leaveBalance.findUnique({ where: { userId_leaveTypeId_year: { userId, leaveTypeId, year } } });
  }
}
