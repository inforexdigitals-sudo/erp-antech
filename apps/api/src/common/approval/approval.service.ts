import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ApprovalRequest } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ApprovalModule } from './approval.types';

export interface StartApprovalParams {
  companyId: string;
  module: ApprovalModule;
  entityType: string;
  entityId: string;
  amount?: number;
}

export interface DecideApprovalParams {
  companyId: string;
  approvalRequestId: string;
  actorUserId: string;
  decision: 'approved' | 'rejected';
  comments?: string;
}

/**
 * The one approval engine every approvable module (Quotations,
 * Purchase Orders, and — as they're built — Purchase Requests,
 * Variation Orders, Claims, Timesheets, Leave Requests) calls into,
 * rather than each module re-implementing its own status machine. See
 * docs/phase-2-database-design/schema-dictionary.md "Cross-Module
 * Design Notes" #3.
 */
@Injectable()
export class ApprovalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Finds the active workflow configured for this module (matching the
   * amount band, if the workflow defines one) and opens an approval
   * request against it. If the company hasn't configured a workflow for
   * this module, the request auto-approves immediately — an unconfigured
   * approval step should never silently block a company that hasn't set
   * one up, and Settings (module 18) is where they configure one if they
   * want the gate.
   */
  async start(params: StartApprovalParams): Promise<ApprovalRequest> {
    const workflow = await this.prisma.approvalWorkflow.findFirst({
      where: {
        companyId: params.companyId,
        module: params.module,
        isActive: true,
        AND: [
          {
            OR: [{ minAmount: null }, { minAmount: { lte: params.amount ?? 0 } }],
          },
          {
            OR: [{ maxAmount: null }, { maxAmount: { gte: params.amount ?? 0 } }],
          },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });

    const request = await this.prisma.approvalRequest.create({
      data: {
        companyId: params.companyId,
        approvalWorkflowId: workflow?.id,
        entityType: params.entityType,
        entityId: params.entityId,
        status: workflow ? 'pending' : 'approved',
        currentStepOrder: 1,
      },
    });

    await this.audit.record({
      companyId: params.companyId,
      action: 'create',
      entityType: 'approval_request',
      entityId: request.id,
      after: request,
    });

    return request;
  }

  async getOpenRequestForEntity(
    companyId: string,
    entityType: string,
    entityId: string,
  ): Promise<ApprovalRequest | null> {
    return this.prisma.approvalRequest.findFirst({
      where: { companyId, entityType, entityId, status: 'pending' },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Records the actor's decision on the current step. On reject, the
   * whole request (not just the step) moves to 'rejected' — a single
   * no goes back to the requester rather than silently skipping to the
   * next approver. On approve, advances to the next step, or to
   * 'approved' if that was the last one.
   *
   * The status transition is claimed atomically (`updateMany` guarded
   * on `status: 'pending'` AND the exact `currentStepOrder` just read)
   * before anything else happens. Without that, two concurrent
   * `decide()` calls on the same request — two approvers racing, or a
   * double-click — could both pass the read-time check above, both
   * write, and last-write-wins would silently pick one outcome while
   * both callers believed their own decision had taken effect. The
   * loser of the race now gets a clean, honest rejection instead.
   */
  async decide(params: DecideApprovalParams): Promise<ApprovalRequest> {
    const request = await this.prisma.approvalRequest.findFirst({
      where: { id: params.approvalRequestId, companyId: params.companyId },
      include: { workflow: { include: { steps: { orderBy: { stepOrder: 'asc' } } } } },
    });
    if (!request) {
      throw new NotFoundException('Approval request not found.');
    }
    if (request.status !== 'pending') {
      throw new ForbiddenException(`This approval request is already ${request.status}.`);
    }

    const steps = request.workflow?.steps ?? [];
    const currentStep = steps.find((s) => s.stepOrder === request.currentStepOrder);
    if (currentStep) {
      await this.assertActorCanDecide(params.actorUserId, currentStep.approverRoleId, currentStep.approverUserId);
    }

    const isLastStep = request.currentStepOrder >= steps.length;
    const nextStatus =
      params.decision === 'rejected' ? 'rejected' : isLastStep ? 'approved' : 'pending';
    const nextStepOrder = nextStatus === 'pending' ? request.currentStepOrder + 1 : request.currentStepOrder;

    const claim = await this.prisma.approvalRequest.updateMany({
      where: { id: request.id, status: 'pending', currentStepOrder: request.currentStepOrder },
      data: { status: nextStatus, currentStepOrder: nextStepOrder },
    });
    if (claim.count === 0) {
      throw new ForbiddenException(
        'This approval request was just decided by someone else — refresh and check its current status.',
      );
    }

    await this.prisma.approvalAction.create({
      data: {
        approvalRequestId: request.id,
        stepOrder: request.currentStepOrder,
        actorUserId: params.actorUserId,
        decision: params.decision,
        comments: params.comments,
      },
    });

    const updated = await this.prisma.approvalRequest.findUniqueOrThrow({ where: { id: request.id } });

    await this.audit.record({
      companyId: params.companyId,
      actorUserId: params.actorUserId,
      action: params.decision,
      entityType: 'approval_request',
      entityId: request.id,
      before: { status: request.status },
      after: { status: updated.status },
    });

    return updated;
  }

  private async assertActorCanDecide(
    actorUserId: string,
    approverRoleId: string | null,
    approverUserId: string | null,
  ): Promise<void> {
    if (approverUserId && approverUserId === actorUserId) return;
    if (approverRoleId) {
      const hasRole = await this.prisma.userRole.findFirst({
        where: { userId: actorUserId, roleId: approverRoleId },
      });
      if (hasRole) return;
    }
    throw new ForbiddenException('You are not an approver for the current step of this request.');
  }
}
