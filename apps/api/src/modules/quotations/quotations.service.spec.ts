import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ApprovalService } from '../../common/approval/approval.service';
import { AuditService } from '../../common/audit/audit.service';
import { DocumentNumberingService } from '../../common/numbering/document-numbering.service';
import { CustomersRepository } from '../crm/customers.repository';
import { ProjectsRepository } from '../projects/projects.repository';
import { QuotationDeliveryService } from './quotation-delivery.service';
import { QuotationsRepository } from './quotations.repository';
import { QuotationsService } from './quotations.service';

const COMPANY_ID = 'company-1';
const USER_ID = 'user-1';

function makeQuotation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'quotation-1',
    companyId: COMPANY_ID,
    customerId: 'customer-1',
    status: 'draft',
    currentRevisionId: 'revision-1',
    currentRevision: { id: 'revision-1', revisionNumber: 1, total: 1000 },
    title: 'Test Quotation',
    ...overrides,
  };
}

describe('QuotationsService', () => {
  let service: QuotationsService;
  let repository: jest.Mocked<Pick<QuotationsRepository, 'findById' | 'createWithFirstRevision' | 'updateStatus' | 'tryTransitionStatus' | 'getTaxRates' | 'list' | 'updateHeader' | 'addRevision'>>;
  let customers: jest.Mocked<Pick<CustomersRepository, 'findById'>>;
  let projects: jest.Mocked<Pick<ProjectsRepository, 'createFromQuotation'>>;
  let approval: jest.Mocked<Pick<ApprovalService, 'start' | 'decide' | 'getOpenRequestForEntity'>>;

  beforeEach(() => {
    repository = {
      findById: jest.fn(),
      createWithFirstRevision: jest.fn(),
      updateStatus: jest.fn(),
      tryTransitionStatus: jest.fn().mockResolvedValue(true),
      getTaxRates: jest.fn().mockResolvedValue(new Map()),
      list: jest.fn(),
      updateHeader: jest.fn(),
      addRevision: jest.fn(),
    };
    customers = { findById: jest.fn() };
    projects = { createFromQuotation: jest.fn() };
    approval = {
      start: jest.fn(),
      decide: jest.fn(),
      getOpenRequestForEntity: jest.fn(),
    };

    service = new QuotationsService(
      repository as unknown as QuotationsRepository,
      customers as unknown as CustomersRepository,
      projects as unknown as ProjectsRepository,
      { allocate: jest.fn().mockResolvedValue('QT-0001') } as unknown as DocumentNumberingService,
      approval as unknown as ApprovalService,
      { record: jest.fn() } as unknown as AuditService,
      { sendToCustomer: jest.fn() } as unknown as QuotationDeliveryService,
    );
  });

  describe('create', () => {
    it('rejects a customerId that does not belong to the tenant', async () => {
      customers.findById.mockResolvedValue(null);

      await expect(
        service.create(COMPANY_ID, USER_ID, {
          customerId: 'not-mine',
          title: 'x',
          discountAmount: 0,
          items: [
            {
              description: 'Item',
              category: 'material',
              unit: 'ea',
              quantity: 1,
              unitCost: 0,
              unitPrice: 10,
              markupPercent: 0,
              discountPercent: 0,
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.createWithFirstRevision).not.toHaveBeenCalled();
    });
  });

  describe('submitForApproval', () => {
    it('refuses to submit a quotation that is not in draft status', async () => {
      repository.findById.mockResolvedValue(makeQuotation({ status: 'sent' }) as never);

      await expect(service.submitForApproval(COMPANY_ID, 'quotation-1', USER_ID)).rejects.toThrow(
        ForbiddenException,
      );
      expect(approval.start).not.toHaveBeenCalled();
    });

    it('auto-approves when the approval engine returns an already-approved request (no workflow configured)', async () => {
      repository.findById.mockResolvedValue(makeQuotation() as never);
      approval.start.mockResolvedValue({ status: 'approved' } as never);

      await service.submitForApproval(COMPANY_ID, 'quotation-1', USER_ID);

      expect(repository.updateStatus).toHaveBeenCalledWith(COMPANY_ID, 'quotation-1', 'approved');
    });

    it('leaves the quotation pending when a workflow is configured and awaiting a decision', async () => {
      repository.findById.mockResolvedValue(makeQuotation() as never);
      approval.start.mockResolvedValue({ status: 'pending' } as never);

      await service.submitForApproval(COMPANY_ID, 'quotation-1', USER_ID);

      // The atomic claim already set status to 'pending_approval' —
      // no second updateStatus call is needed (or made) in this branch.
      expect(repository.tryTransitionStatus).toHaveBeenCalledWith(COMPANY_ID, 'quotation-1', 'draft', 'pending_approval');
      expect(repository.updateStatus).not.toHaveBeenCalled();
    });

    it('rejects cleanly when it loses the atomic-claim race to a concurrent submit on the same draft', async () => {
      repository.findById.mockResolvedValue(makeQuotation() as never);
      repository.tryTransitionStatus.mockResolvedValue(false);

      await expect(service.submitForApproval(COMPANY_ID, 'quotation-1', USER_ID)).rejects.toThrow(
        ForbiddenException,
      );
      expect(approval.start).not.toHaveBeenCalled();
    });
  });

  describe('decide', () => {
    it('refuses to decide a quotation that is not pending approval', async () => {
      repository.findById.mockResolvedValue(makeQuotation({ status: 'draft' }) as never);

      await expect(service.decide(COMPANY_ID, 'quotation-1', USER_ID, 'approved')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws if no open approval request exists for a pending quotation (data integrity guard)', async () => {
      repository.findById.mockResolvedValue(makeQuotation({ status: 'pending_approval' }) as never);
      approval.getOpenRequestForEntity.mockResolvedValue(null);

      await expect(service.decide(COMPANY_ID, 'quotation-1', USER_ID, 'approved')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('recordCustomerDecision', () => {
    it('only allows a decision from sent status', async () => {
      repository.findById.mockResolvedValue(makeQuotation({ status: 'approved' }) as never);

      await expect(service.recordCustomerDecision(COMPANY_ID, 'quotation-1', USER_ID, 'accepted')).rejects.toThrow(
        ForbiddenException,
      );
      expect(repository.tryTransitionStatus).not.toHaveBeenCalled();
    });

    it('transitions sent -> accepted', async () => {
      repository.findById.mockResolvedValue(makeQuotation({ status: 'sent' }) as never);

      await service.recordCustomerDecision(COMPANY_ID, 'quotation-1', USER_ID, 'accepted');

      expect(repository.tryTransitionStatus).toHaveBeenCalledWith(COMPANY_ID, 'quotation-1', 'sent', 'accepted');
    });

    it('rejects cleanly when it loses the atomic-claim race', async () => {
      repository.findById.mockResolvedValue(makeQuotation({ status: 'sent' }) as never);
      repository.tryTransitionStatus.mockResolvedValue(false);

      await expect(service.recordCustomerDecision(COMPANY_ID, 'quotation-1', USER_ID, 'accepted')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('convertToProject', () => {
    it('only allows conversion from accepted status', async () => {
      repository.findById.mockResolvedValue(makeQuotation({ status: 'sent' }) as never);

      await expect(service.convertToProject(COMPANY_ID, 'quotation-1', USER_ID)).rejects.toThrow(
        ForbiddenException,
      );
      expect(projects.createFromQuotation).not.toHaveBeenCalled();
    });

    it('creates a project carrying the current revision total as contract value', async () => {
      repository.findById.mockResolvedValue(makeQuotation({ status: 'accepted' }) as never);
      projects.createFromQuotation.mockResolvedValue({ id: 'project-1' } as never);

      await service.convertToProject(COMPANY_ID, 'quotation-1', USER_ID);

      expect(projects.createFromQuotation).toHaveBeenCalledWith(
        expect.objectContaining({ contractValue: 1000, quotationId: 'quotation-1' }),
      );
      expect(repository.updateStatus).toHaveBeenCalledWith(COMPANY_ID, 'quotation-1', 'converted');
    });
  });
});
