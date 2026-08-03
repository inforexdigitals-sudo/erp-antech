import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { ApprovalService } from './approval.service';

const COMPANY_ID = 'company-1';

describe('ApprovalService', () => {
  let service: ApprovalService;
  let prisma: {
    approvalWorkflow: { findFirst: jest.Mock };
    approvalRequest: { create: jest.Mock; findFirst: jest.Mock; updateMany: jest.Mock; findUniqueOrThrow: jest.Mock };
    approvalAction: { create: jest.Mock };
    userRole: { findFirst: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      approvalWorkflow: { findFirst: jest.fn() },
      approvalRequest: {
        create: jest.fn(),
        findFirst: jest.fn(),
        updateMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      approvalAction: { create: jest.fn() },
      userRole: { findFirst: jest.fn() },
    };
    service = new ApprovalService(
      prisma as unknown as PrismaService,
      { record: jest.fn() } as unknown as AuditService,
    );
  });

  describe('start', () => {
    it('auto-approves when no active workflow is configured for the module', async () => {
      prisma.approvalWorkflow.findFirst.mockResolvedValue(null);
      prisma.approvalRequest.create.mockResolvedValue({ id: 'req-1', status: 'approved' });

      const result = await service.start({ companyId: COMPANY_ID, module: 'quotation', entityType: 'quotation', entityId: 'q-1' });

      expect(result.status).toBe('approved');
      expect(prisma.approvalRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'approved', approvalWorkflowId: undefined }) }),
      );
    });

    it('opens a pending request when a workflow is configured', async () => {
      prisma.approvalWorkflow.findFirst.mockResolvedValue({ id: 'wf-1' });
      prisma.approvalRequest.create.mockResolvedValue({ id: 'req-1', status: 'pending' });

      const result = await service.start({ companyId: COMPANY_ID, module: 'purchase_order', entityType: 'purchase_order', entityId: 'po-1', amount: 5000 });

      expect(result.status).toBe('pending');
    });
  });

  describe('decide', () => {
    const baseRequest = {
      id: 'req-1',
      companyId: COMPANY_ID,
      status: 'pending',
      currentStepOrder: 1,
      workflow: { steps: [{ stepOrder: 1, approverRoleId: null, approverUserId: 'approver-1' }] },
    };

    it('throws NotFoundException for a request outside the tenant', async () => {
      prisma.approvalRequest.findFirst.mockResolvedValue(null);

      await expect(
        service.decide({ companyId: COMPANY_ID, approvalRequestId: 'req-1', actorUserId: 'approver-1', decision: 'approved' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws if the request is not pending', async () => {
      prisma.approvalRequest.findFirst.mockResolvedValue({ ...baseRequest, status: 'approved' });

      await expect(
        service.decide({ companyId: COMPANY_ID, approvalRequestId: 'req-1', actorUserId: 'approver-1', decision: 'approved' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects an actor who is neither the named approver nor holds the approver role', async () => {
      prisma.approvalRequest.findFirst.mockResolvedValue(baseRequest);

      await expect(
        service.decide({ companyId: COMPANY_ID, approvalRequestId: 'req-1', actorUserId: 'random-user', decision: 'approved' }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.approvalRequest.updateMany).not.toHaveBeenCalled();
    });

    it('claims the transition atomically and records the action on success', async () => {
      prisma.approvalRequest.findFirst.mockResolvedValue(baseRequest);
      prisma.approvalRequest.updateMany.mockResolvedValue({ count: 1 });
      prisma.approvalRequest.findUniqueOrThrow.mockResolvedValue({ ...baseRequest, status: 'approved' });

      const result = await service.decide({ companyId: COMPANY_ID, approvalRequestId: 'req-1', actorUserId: 'approver-1', decision: 'approved' });

      expect(prisma.approvalRequest.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'req-1', status: 'pending', currentStepOrder: 1 },
          data: { status: 'approved', currentStepOrder: 1 },
        }),
      );
      expect(prisma.approvalAction.create).toHaveBeenCalled();
      expect(result.status).toBe('approved');
    });

    it('rejects cleanly when it loses the atomic-claim race to a concurrent decision on the same request', async () => {
      prisma.approvalRequest.findFirst.mockResolvedValue(baseRequest);
      prisma.approvalRequest.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.decide({ companyId: COMPANY_ID, approvalRequestId: 'req-1', actorUserId: 'approver-1', decision: 'approved' }),
      ).rejects.toThrow(ForbiddenException);
      // The loser must not record a decision that never actually took effect.
      expect(prisma.approvalAction.create).not.toHaveBeenCalled();
    });

    it('rejecting the whole request does not advance to the next step, even mid-chain', async () => {
      const twoStepRequest = {
        ...baseRequest,
        workflow: {
          steps: [
            { stepOrder: 1, approverRoleId: null, approverUserId: 'approver-1' },
            { stepOrder: 2, approverRoleId: null, approverUserId: 'approver-2' },
          ],
        },
      };
      prisma.approvalRequest.findFirst.mockResolvedValue(twoStepRequest);
      prisma.approvalRequest.updateMany.mockResolvedValue({ count: 1 });
      prisma.approvalRequest.findUniqueOrThrow.mockResolvedValue({ ...twoStepRequest, status: 'rejected' });

      await service.decide({ companyId: COMPANY_ID, approvalRequestId: 'req-1', actorUserId: 'approver-1', decision: 'rejected' });

      expect(prisma.approvalRequest.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'rejected', currentStepOrder: 1 } }),
      );
    });

    it('approving a non-final step advances currentStepOrder and stays pending', async () => {
      const twoStepRequest = {
        ...baseRequest,
        workflow: {
          steps: [
            { stepOrder: 1, approverRoleId: null, approverUserId: 'approver-1' },
            { stepOrder: 2, approverRoleId: null, approverUserId: 'approver-2' },
          ],
        },
      };
      prisma.approvalRequest.findFirst.mockResolvedValue(twoStepRequest);
      prisma.approvalRequest.updateMany.mockResolvedValue({ count: 1 });
      prisma.approvalRequest.findUniqueOrThrow.mockResolvedValue({ ...twoStepRequest, status: 'pending', currentStepOrder: 2 });

      await service.decide({ companyId: COMPANY_ID, approvalRequestId: 'req-1', actorUserId: 'approver-1', decision: 'approved' });

      expect(prisma.approvalRequest.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'pending', currentStepOrder: 2 } }),
      );
    });
  });
});
