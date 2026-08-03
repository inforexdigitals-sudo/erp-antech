import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { LeaveType } from '@prisma/client';
import { ApprovalService } from '../../common/approval/approval.service';
import { AuditService } from '../../common/audit/audit.service';
import { PaginatedResult, PaginationQueryDto, paginate } from '../../common/dto/pagination.dto';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import { LeaveRepository, LeaveRequestWithDetail } from './leave.repository';
import { LeaveRequestStatus } from './timesheet.types';

/**
 * `'leave_request'` is a valid `approval_workflows.module` value
 * (db/migrations/0015's CHECK constraint), so — like Quotations, POs,
 * VOs, and Timesheets — leave decisions route through the shared
 * ApprovalService rather than a bespoke status transition. An earlier
 * version of this service decided directly, reasoning that
 * `leave_requests` has no `approval_workflow_id` column of its own —
 * true, but equally true of every other approvable table (none of them
 * store a back-reference; the generic engine links the other way, via
 * `approval_requests.entity_type`/`entity_id`), so that wasn't actually
 * a real distinguishing factor. Caught and fixed on review before
 * Progress Claims — the next approvable module — could repeat it.
 *
 * `leave_requests` has no separate draft state (unlike
 * Quotations/POs/VOs, which go draft → submitted): creating a request
 * already means submitting it, so `createLeaveRequest` plays the role
 * `submitForApproval` plays elsewhere.
 */
@Injectable()
export class LeaveService {
  constructor(
    private readonly repository: LeaveRepository,
    private readonly approval: ApprovalService,
    private readonly audit: AuditService,
  ) {}

  async createLeaveType(companyId: string, actorUserId: string, dto: CreateLeaveTypeDto): Promise<LeaveType> {
    const leaveType = await this.repository.createLeaveType(companyId, dto.name, dto.isPaid, dto.annualEntitlementDays);
    await this.audit.record({ companyId, actorUserId, action: 'create', entityType: 'leave_type', entityId: leaveType.id, after: leaveType });
    return leaveType;
  }

  async listLeaveTypes(companyId: string): Promise<LeaveType[]> {
    return this.repository.listLeaveTypes(companyId);
  }

  async createLeaveRequest(companyId: string, actorUserId: string, dto: CreateLeaveRequestDto): Promise<LeaveRequestWithDetail> {
    const leaveType = await this.repository.findLeaveTypeById(companyId, dto.leaveTypeId);
    if (!leaveType) {
      throw new BadRequestException('Leave type not found.');
    }
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (end < start) {
      throw new BadRequestException('endDate cannot be before startDate.');
    }

    const request = await this.repository.createLeaveRequest({
      companyId,
      userId: actorUserId,
      leaveTypeId: dto.leaveTypeId,
      startDate: start,
      endDate: end,
      days: dto.days,
      reason: dto.reason,
      status: 'pending',
    });

    const approvalRequest = await this.approval.start({
      companyId,
      module: 'leave_request',
      entityType: 'leave_request',
      entityId: request.id,
    });

    if (approvalRequest.status === 'approved') {
      await this.finalizeApproval(companyId, request);
    }

    await this.audit.record({ companyId, actorUserId, action: 'create', entityType: 'leave_request', entityId: request.id, after: request });
    return this.findOne(companyId, request.id);
  }

  async findOne(companyId: string, id: string): Promise<LeaveRequestWithDetail> {
    const request = await this.repository.findRequestById(companyId, id);
    if (!request) {
      throw new NotFoundException('Leave request not found.');
    }
    return request;
  }

  async list(
    companyId: string,
    query: PaginationQueryDto & { status?: string; userId?: string },
  ): Promise<PaginatedResult<LeaveRequestWithDetail>> {
    const { data, total } = await this.repository.listRequests(companyId, query);
    return paginate(data, total, query);
  }

  async decide(
    companyId: string,
    id: string,
    actorUserId: string,
    decision: 'approved' | 'rejected',
    comments?: string,
  ): Promise<LeaveRequestWithDetail> {
    const request = await this.findOne(companyId, id);
    if (request.status !== 'pending') {
      throw new ForbiddenException('This leave request has already been decided.');
    }

    const openRequest = await this.approval.getOpenRequestForEntity(companyId, 'leave_request', id);
    if (!openRequest) {
      throw new BadRequestException('No open approval request found for this leave request.');
    }

    const result = await this.approval.decide({ companyId, approvalRequestId: openRequest.id, actorUserId, decision, comments });

    const nextStatus: LeaveRequestStatus =
      result.status === 'approved' ? 'approved' : result.status === 'rejected' ? 'rejected' : 'pending';
    if (nextStatus === 'approved') {
      await this.finalizeApproval(companyId, request, actorUserId);
    } else if (nextStatus === 'rejected') {
      await this.repository.tryTransitionStatus(companyId, id, 'pending', 'rejected', actorUserId);
    }

    return this.findOne(companyId, id);
  }

  /** Credits the request's days against the requester's leave_balances for the year the leave starts in. */
  private async finalizeApproval(companyId: string, request: LeaveRequestWithDetail, approvedBy?: string): Promise<void> {
    await this.repository.tryTransitionStatus(companyId, request.id, 'pending', 'approved', approvedBy);
    const year = request.startDate.getUTCFullYear();
    await this.repository.incrementUsedDays(
      request.userId,
      request.leaveTypeId,
      year,
      Number(request.leaveType.annualEntitlementDays),
      Number(request.days),
    );
  }
}
