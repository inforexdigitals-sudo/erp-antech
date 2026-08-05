import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ApprovalService } from '../../common/approval/approval.service';
import { AuditService } from '../../common/audit/audit.service';
import { DocumentNumberingService } from '../../common/numbering/document-numbering.service';
import { CostingService } from '../project-costing/project-costing.service';
import { ProjectsRepository } from '../projects/projects.repository';
import { VariationOrdersRepository } from './variation-orders.repository';
import { VariationOrdersService } from './variation-orders.service';

const COMPANY_ID = 'company-1';
const USER_ID = 'user-1';
const VO_ID = 'vo-1';

function makeVo(overrides: Record<string, unknown> = {}) {
  return {
    id: VO_ID,
    companyId: COMPANY_ID,
    projectId: 'project-1',
    status: 'draft',
    costImpact: 1000,
    revenueImpact: 1500,
    revisions: [{ revisionNumber: 1 }],
    items: [
      { costCategory: 'material', quantity: 10, unitCost: 50, unitPrice: 75 },
      { costCategory: 'equipment', quantity: 1, unitCost: 500, unitPrice: 750 },
    ],
    ...overrides,
  };
}

describe('VariationOrdersService', () => {
  let service: VariationOrdersService;
  let repository: jest.Mocked<
    Pick<VariationOrdersRepository, 'create' | 'findById' | 'addRevision' | 'updateHeader' | 'updateStatus' | 'tryTransitionStatus' | 'list'>
  >;
  let projects: jest.Mocked<Pick<ProjectsRepository, 'findById' | 'incrementContractValue'>>;
  let approval: jest.Mocked<Pick<ApprovalService, 'start' | 'decide' | 'getOpenRequestForEntity'>>;
  let costing: jest.Mocked<Pick<CostingService, 'record'>>;

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findById: jest.fn().mockResolvedValue(makeVo()),
      addRevision: jest.fn(),
      updateHeader: jest.fn(),
      updateStatus: jest.fn(),
      tryTransitionStatus: jest.fn().mockResolvedValue(true),
      list: jest.fn(),
    };
    projects = { findById: jest.fn(), incrementContractValue: jest.fn() };
    approval = { start: jest.fn(), decide: jest.fn(), getOpenRequestForEntity: jest.fn() };
    costing = { record: jest.fn() };

    service = new VariationOrdersService(
      repository as unknown as VariationOrdersRepository,
      projects as unknown as ProjectsRepository,
      { allocate: jest.fn().mockResolvedValue('VO-0001') } as unknown as DocumentNumberingService,
      approval as unknown as ApprovalService,
      { record: jest.fn() } as unknown as AuditService,
      costing as unknown as CostingService,
    );
  });

  describe('create', () => {
    it('rejects a project that does not belong to the tenant', async () => {
      projects.findById.mockResolvedValue(null);

      await expect(
        service.create(COMPANY_ID, USER_ID, {
          projectId: 'not-mine',
          title: 'Extra piping',
          cause: 'site_condition',
          items: [{ description: 'Extra pipe', costCategory: 'material', quantity: 10, unitCost: 5, unitPrice: 8 }],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('sums quantity × unitCost / unitPrice across lines, treating a missing quantity or price as $0 for that line', async () => {
      projects.findById.mockResolvedValue({ id: 'project-1' } as never);
      repository.create.mockResolvedValue(makeVo() as never);

      await service.create(COMPANY_ID, USER_ID, {
        projectId: 'project-1',
        title: 'Extra piping',
        cause: 'site_condition',
        items: [
          { description: 'Pipe', costCategory: 'material', quantity: 10, unitCost: 5, unitPrice: 8 },
          { description: 'Lump sum note only' as never, costCategory: 'material' } as never,
        ],
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ costImpact: 50, revenueImpact: 80 }),
      );
    });
  });

  describe('submitForApproval', () => {
    it('rejects cleanly when it loses the atomic-claim race to a concurrent submit on the same draft', async () => {
      repository.tryTransitionStatus.mockResolvedValue(false);

      await expect(service.submitForApproval(COMPANY_ID, VO_ID, USER_ID)).rejects.toThrow(ForbiddenException);
      expect(approval.start).not.toHaveBeenCalled();
    });

    it('auto-approves and records committed cost per category when no workflow is configured', async () => {
      approval.start.mockResolvedValue({ status: 'approved' } as never);

      await service.submitForApproval(COMPANY_ID, VO_ID, USER_ID);

      expect(repository.updateStatus).toHaveBeenCalledWith(
        COMPANY_ID,
        VO_ID,
        'approved',
        expect.objectContaining({ approvedBy: USER_ID }),
      );
      expect(costing.record).toHaveBeenCalledWith(
        expect.objectContaining({ costCategory: 'material', transactionType: 'committed', amount: 500 }),
      );
      expect(costing.record).toHaveBeenCalledWith(
        expect.objectContaining({ costCategory: 'equipment', transactionType: 'committed', amount: 500 }),
      );
      // Revenue must NOT be applied at internal approval — only at client sign-off.
      expect(projects.incrementContractValue).not.toHaveBeenCalled();
    });
  });

  describe('decide', () => {
    it('rejects a VO that is not awaiting approval', async () => {
      repository.findById.mockResolvedValue(makeVo({ status: 'draft' }) as never);

      await expect(service.decide(COMPANY_ID, VO_ID, USER_ID, 'approved')).rejects.toThrow(ForbiddenException);
    });

    it('does not commit cost or touch contract value on rejection', async () => {
      repository.findById.mockResolvedValue(makeVo({ status: 'pending_approval' }) as never);
      approval.getOpenRequestForEntity.mockResolvedValue({ id: 'req-1' } as never);
      approval.decide.mockResolvedValue({ status: 'rejected' } as never);

      await service.decide(COMPANY_ID, VO_ID, USER_ID, 'rejected');

      expect(repository.updateStatus).toHaveBeenCalledWith(COMPANY_ID, VO_ID, 'rejected');
      expect(costing.record).not.toHaveBeenCalled();
      expect(projects.incrementContractValue).not.toHaveBeenCalled();
    });
  });

  describe('recordClientSignOff', () => {
    it('refuses sign-off before internal approval', async () => {
      repository.findById.mockResolvedValue(makeVo({ status: 'draft' }) as never);

      await expect(service.recordClientSignOff(COMPANY_ID, VO_ID, USER_ID)).rejects.toThrow(ForbiddenException);
      expect(projects.incrementContractValue).not.toHaveBeenCalled();
    });

    it('applies the revenue impact to the project contract value once the client signs off', async () => {
      repository.findById.mockResolvedValue(makeVo({ status: 'approved', revenueImpact: 1500 }) as never);

      await service.recordClientSignOff(COMPANY_ID, VO_ID, USER_ID);

      expect(projects.incrementContractValue).toHaveBeenCalledWith(COMPANY_ID, 'project-1', 1500);
    });

    it('rejects cleanly when it loses the atomic-claim race (e.g. already signed off)', async () => {
      repository.findById.mockResolvedValue(makeVo({ status: 'approved' }) as never);
      repository.tryTransitionStatus.mockResolvedValue(false);

      await expect(service.recordClientSignOff(COMPANY_ID, VO_ID, USER_ID)).rejects.toThrow(ForbiddenException);
      expect(projects.incrementContractValue).not.toHaveBeenCalled();
    });
  });

  describe('addRevision', () => {
    it('allows revising a VO pending approval — addRevision resets it to draft itself, so this withdraws it from review rather than mutating an open request', async () => {
      repository.findById.mockResolvedValue(makeVo({ status: 'pending_approval' }) as never);
      repository.addRevision.mockResolvedValue(makeVo({ status: 'draft' }) as never);

      await expect(
        service.addRevision(COMPANY_ID, VO_ID, USER_ID, {
          items: [{ description: 'Revised', costCategory: 'material', quantity: 1, unitCost: 1, unitPrice: 1 }],
        }),
      ).resolves.toBeDefined();
      expect(repository.addRevision).toHaveBeenCalled();
    });

    it('refuses to revise an approved VO — cost has already committed to the ledger by then', async () => {
      repository.findById.mockResolvedValue(makeVo({ status: 'approved' }) as never);

      await expect(
        service.addRevision(COMPANY_ID, VO_ID, USER_ID, {
          items: [{ description: 'Revised', costCategory: 'material', quantity: 1, unitCost: 1, unitPrice: 1 }],
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(repository.addRevision).not.toHaveBeenCalled();
    });
  });

  describe('updateHeader', () => {
    it('allows editing title/cause/scheduleImpactDays while pending_approval', async () => {
      repository.findById.mockResolvedValue(makeVo({ status: 'pending_approval' }) as never);
      repository.updateHeader.mockResolvedValue(makeVo({ title: 'Updated title' }) as never);

      await expect(
        service.updateHeader(COMPANY_ID, VO_ID, USER_ID, { title: 'Updated title' }),
      ).resolves.toBeDefined();
      expect(repository.updateHeader).toHaveBeenCalledWith(COMPANY_ID, VO_ID, {
        title: 'Updated title',
        cause: undefined,
        scheduleImpactDays: undefined,
      });
    });

    it('refuses to edit an approved VO', async () => {
      repository.findById.mockResolvedValue(makeVo({ status: 'approved' }) as never);

      await expect(
        service.updateHeader(COMPANY_ID, VO_ID, USER_ID, { title: 'Updated title' }),
      ).rejects.toThrow(ForbiddenException);
      expect(repository.updateHeader).not.toHaveBeenCalled();
    });
  });
});
