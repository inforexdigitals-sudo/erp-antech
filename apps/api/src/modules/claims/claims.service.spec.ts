import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ApprovalService } from '../../common/approval/approval.service';
import { AuditService } from '../../common/audit/audit.service';
import { DocumentNumberingService } from '../../common/numbering/document-numbering.service';
import { CustomersRepository } from '../crm/customers.repository';
import { CostingService } from '../project-costing/project-costing.service';
import { ProjectsRepository } from '../projects/projects.repository';
import { SubcontractorsRepository } from '../subcontractors/subcontractors.repository';
import { ClaimsRepository } from './claims.repository';
import { ClaimsService } from './claims.service';

const COMPANY_ID = 'company-1';
const USER_ID = 'user-1';
const CLAIM_ID = 'claim-1';

function makeClaim(overrides: Record<string, unknown> = {}) {
  return {
    id: CLAIM_ID,
    companyId: COMPANY_ID,
    projectId: 'project-1',
    claimType: 'client',
    status: 'draft',
    claimAmount: 1000,
    retentionAmount: 100,
    netClaimAmount: 900,
    claimNumber: 'CLM-0001',
    ...overrides,
  };
}

describe('ClaimsService', () => {
  let service: ClaimsService;
  let repository: jest.Mocked<
    Pick<
      ClaimsRepository,
      | 'create'
      | 'findById'
      | 'list'
      | 'getPreviousCumulativePercents'
      | 'updateStatus'
      | 'tryTransitionStatus'
      | 'createPaymentCertificate'
      | 'createRetentionRecord'
    >
  >;
  let projects: jest.Mocked<Pick<ProjectsRepository, 'findById'>>;
  let customers: jest.Mocked<Pick<CustomersRepository, 'findById'>>;
  let subcontractors: jest.Mocked<Pick<SubcontractorsRepository, 'findById'>>;
  let approval: jest.Mocked<Pick<ApprovalService, 'start' | 'decide' | 'getOpenRequestForEntity'>>;
  let costing: jest.Mocked<Pick<CostingService, 'record'>>;

  beforeEach(() => {
    repository = {
      create: jest.fn().mockResolvedValue(makeClaim()),
      findById: jest.fn().mockResolvedValue(makeClaim()),
      list: jest.fn(),
      getPreviousCumulativePercents: jest.fn().mockResolvedValue(new Map()),
      updateStatus: jest.fn(),
      tryTransitionStatus: jest.fn().mockResolvedValue(true),
      createPaymentCertificate: jest.fn(),
      createRetentionRecord: jest.fn(),
    };
    projects = { findById: jest.fn().mockResolvedValue({ id: 'project-1' }) };
    customers = { findById: jest.fn().mockResolvedValue({ id: 'customer-1' }) };
    subcontractors = { findById: jest.fn().mockResolvedValue({ id: 'sub-1' }) };
    approval = { start: jest.fn(), decide: jest.fn(), getOpenRequestForEntity: jest.fn() };
    costing = { record: jest.fn() };

    service = new ClaimsService(
      repository as unknown as ClaimsRepository,
      projects as unknown as ProjectsRepository,
      customers as unknown as CustomersRepository,
      subcontractors as unknown as SubcontractorsRepository,
      { allocate: jest.fn().mockResolvedValue('CLM-0001') } as unknown as DocumentNumberingService,
      approval as unknown as ApprovalService,
      costing as unknown as CostingService,
      { record: jest.fn() } as unknown as AuditService,
    );
  });

  describe('create', () => {
    const baseDto = {
      projectId: 'project-1',
      claimType: 'client' as const,
      customerId: 'customer-1',
      claimPeriodStart: '2026-07-01',
      claimPeriodEnd: '2026-07-31',
      items: [{ description: 'Foundation works', currentPercent: 40, amount: 1000 }],
    };

    it('rejects a project that does not belong to the tenant', async () => {
      projects.findById.mockResolvedValue(null);
      await expect(service.create(COMPANY_ID, USER_ID, baseDto)).rejects.toThrow(BadRequestException);
    });

    it('rejects a client claim missing customerId', async () => {
      await expect(
        service.create(COMPANY_ID, USER_ID, { ...baseDto, customerId: undefined }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a claim mixing customerId and subcontractorId', async () => {
      await expect(
        service.create(COMPANY_ID, USER_ID, { ...baseDto, subcontractorId: 'sub-1' } as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('computes retentionAmount and netClaimAmount from retentionPercent', async () => {
      await service.create(COMPANY_ID, USER_ID, { ...baseDto, retentionPercent: 10 });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ claimAmount: 1000, retentionAmount: 100, netClaimAmount: 900 }),
      );
    });

    it('rejects a line item whose cumulative percent would exceed 100', async () => {
      repository.getPreviousCumulativePercents.mockResolvedValue(new Map([['qi-1', 70]]));

      await expect(
        service.create(COMPANY_ID, USER_ID, {
          ...baseDto,
          items: [{ quotationItemId: 'qi-1', description: 'Foundation works', currentPercent: 40, amount: 1000 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('submitForApproval', () => {
    it('rejects cleanly when it loses the atomic-claim race to a concurrent submit', async () => {
      repository.tryTransitionStatus.mockResolvedValue(false);

      await expect(service.submitForApproval(COMPANY_ID, CLAIM_ID, USER_ID)).rejects.toThrow(ForbiddenException);
      expect(approval.start).not.toHaveBeenCalled();
    });

    it('moves to under_review when a workflow keeps the approval pending', async () => {
      approval.start.mockResolvedValue({ status: 'pending' } as never);

      await service.submitForApproval(COMPANY_ID, CLAIM_ID, USER_ID);

      expect(repository.updateStatus).toHaveBeenCalledWith(COMPANY_ID, CLAIM_ID, 'under_review');
      expect(repository.createPaymentCertificate).not.toHaveBeenCalled();
    });

    it('certifies immediately and records actual subcontractor cost when auto-approved', async () => {
      repository.findById.mockResolvedValue(makeClaim({ claimType: 'subcontractor', claimAmount: 800 }) as never);
      approval.start.mockResolvedValue({ status: 'approved' } as never);

      await service.submitForApproval(COMPANY_ID, CLAIM_ID, USER_ID);

      expect(repository.updateStatus).toHaveBeenCalledWith(
        COMPANY_ID,
        CLAIM_ID,
        'certified',
        expect.objectContaining({ certifiedBy: USER_ID }),
      );
      expect(repository.createPaymentCertificate).toHaveBeenCalled();
      expect(costing.record).toHaveBeenCalledWith(
        expect.objectContaining({ costCategory: 'subcontractor', transactionType: 'actual', amount: 800 }),
      );
    });

    it('does not touch the cost ledger for a certified client claim', async () => {
      repository.findById.mockResolvedValue(makeClaim({ claimType: 'client' }) as never);
      approval.start.mockResolvedValue({ status: 'approved' } as never);

      await service.submitForApproval(COMPANY_ID, CLAIM_ID, USER_ID);

      expect(costing.record).not.toHaveBeenCalled();
    });

    it('creates a retention record only when retentionAmount is positive', async () => {
      repository.findById.mockResolvedValue(makeClaim({ retentionAmount: 0 }) as never);
      approval.start.mockResolvedValue({ status: 'approved' } as never);

      await service.submitForApproval(COMPANY_ID, CLAIM_ID, USER_ID);

      expect(repository.createRetentionRecord).not.toHaveBeenCalled();
    });
  });

  describe('decide', () => {
    it('rejects a claim that is not under review', async () => {
      repository.findById.mockResolvedValue(makeClaim({ status: 'draft' }) as never);

      await expect(service.decide(COMPANY_ID, CLAIM_ID, USER_ID, 'approved')).rejects.toThrow(ForbiddenException);
    });

    it('throws when no open approval request exists', async () => {
      repository.findById.mockResolvedValue(makeClaim({ status: 'under_review' }) as never);
      approval.getOpenRequestForEntity.mockResolvedValue(null);

      await expect(service.decide(COMPANY_ID, CLAIM_ID, USER_ID, 'approved')).rejects.toThrow(BadRequestException);
    });

    it('marks the claim rejected without certifying', async () => {
      repository.findById.mockResolvedValue(makeClaim({ status: 'under_review' }) as never);
      approval.getOpenRequestForEntity.mockResolvedValue({ id: 'req-1' } as never);
      approval.decide.mockResolvedValue({ status: 'rejected' } as never);

      await service.decide(COMPANY_ID, CLAIM_ID, USER_ID, 'rejected');

      expect(repository.updateStatus).toHaveBeenCalledWith(COMPANY_ID, CLAIM_ID, 'rejected');
      expect(repository.createPaymentCertificate).not.toHaveBeenCalled();
    });
  });

  describe('markPaid', () => {
    it('rejects when the claim is not certified', async () => {
      repository.tryTransitionStatus.mockResolvedValue(false);
      await expect(service.markPaid(COMPANY_ID, CLAIM_ID)).rejects.toThrow(ForbiddenException);
    });

    it('transitions a certified claim to paid', async () => {
      await service.markPaid(COMPANY_ID, CLAIM_ID);
      expect(repository.tryTransitionStatus).toHaveBeenCalledWith(COMPANY_ID, CLAIM_ID, 'certified', 'paid');
    });
  });
});
