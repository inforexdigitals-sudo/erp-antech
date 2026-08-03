import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { DocumentNumberingService } from '../../common/numbering/document-numbering.service';
import { ProjectsRepository } from '../projects/projects.repository';
import { SuppliersRepository } from '../suppliers/suppliers.repository';
import { MaterialRequestsRepository } from './material-requests.repository';
import { RfqsRepository } from './rfqs.repository';
import { RfqsService } from './rfqs.service';

const COMPANY_ID = 'company-1';
const USER_ID = 'user-1';
const RFQ_ID = 'rfq-1';

function makeRfq(overrides: Record<string, unknown> = {}) {
  return {
    id: RFQ_ID,
    companyId: COMPANY_ID,
    status: 'draft',
    items: [{ id: 'item-1' }, { id: 'item-2' }],
    recipients: [{ supplierId: 'supplier-1' }],
    responses: [{ id: 'response-1' }],
    ...overrides,
  };
}

describe('RfqsService', () => {
  let service: RfqsService;
  let repository: jest.Mocked<
    Pick<RfqsRepository, 'create' | 'findById' | 'list' | 'addRecipients' | 'markRecipientsSent' | 'updateStatus' | 'tryTransitionStatus' | 'recordResponse' | 'selectResponse'>
  >;
  let materialRequests: jest.Mocked<Pick<MaterialRequestsRepository, 'findById'>>;
  let projects: jest.Mocked<Pick<ProjectsRepository, 'findById'>>;
  let suppliers: jest.Mocked<Pick<SuppliersRepository, 'findById'>>;

  beforeEach(() => {
    repository = {
      create: jest.fn().mockResolvedValue(makeRfq()),
      findById: jest.fn().mockResolvedValue(makeRfq()),
      list: jest.fn(),
      addRecipients: jest.fn(),
      markRecipientsSent: jest.fn(),
      updateStatus: jest.fn(),
      tryTransitionStatus: jest.fn().mockResolvedValue(true),
      recordResponse: jest.fn(),
      selectResponse: jest.fn(),
    };
    materialRequests = { findById: jest.fn().mockResolvedValue({ id: 'mr-1' }) };
    projects = { findById: jest.fn().mockResolvedValue({ id: 'project-1' }) };
    suppliers = { findById: jest.fn().mockResolvedValue({ id: 'supplier-1', name: 'SteelWorks' }) };

    service = new RfqsService(
      repository as unknown as RfqsRepository,
      materialRequests as unknown as MaterialRequestsRepository,
      projects as unknown as ProjectsRepository,
      suppliers as unknown as SuppliersRepository,
      { allocate: jest.fn().mockResolvedValue('RFQ-0001') } as unknown as DocumentNumberingService,
      { record: jest.fn() } as unknown as AuditService,
    );
  });

  describe('create', () => {
    it('rejects an unknown supplier in supplierIds', async () => {
      suppliers.findById.mockResolvedValue(null);
      await expect(
        service.create(COMPANY_ID, USER_ID, { items: [{ description: 'Cement', unit: 'bag', quantity: 100 }], supplierIds: ['not-mine'] }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('send', () => {
    it('refuses to send an RFQ with no recipients', async () => {
      repository.findById.mockResolvedValue(makeRfq({ recipients: [] }) as never);
      await expect(service.send(COMPANY_ID, RFQ_ID, USER_ID)).rejects.toThrow(BadRequestException);
      expect(repository.tryTransitionStatus).not.toHaveBeenCalled();
    });

    it('rejects cleanly when it loses the atomic-claim race', async () => {
      repository.tryTransitionStatus.mockResolvedValue(false);
      await expect(service.send(COMPANY_ID, RFQ_ID, USER_ID)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('recordResponse', () => {
    it('rejects an item that does not belong to this RFQ', async () => {
      await expect(
        service.recordResponse(COMPANY_ID, RFQ_ID, USER_ID, {
          supplierId: 'supplier-1',
          items: [{ rfqItemId: 'not-mine', unitPrice: 10, quantity: 5 }],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.recordResponse).not.toHaveBeenCalled();
    });

    it('computes lineTotal per item and sums to totalAmount', async () => {
      await service.recordResponse(COMPANY_ID, RFQ_ID, USER_ID, {
        supplierId: 'supplier-1',
        items: [
          { rfqItemId: 'item-1', unitPrice: 10, quantity: 5 },
          { rfqItemId: 'item-2', unitPrice: 3, quantity: 2 },
        ],
      });

      expect(repository.recordResponse).toHaveBeenCalledWith(
        RFQ_ID,
        'supplier-1',
        56,
        undefined,
        undefined,
        expect.arrayContaining([
          expect.objectContaining({ rfqItemId: 'item-1', lineTotal: 50 }),
          expect.objectContaining({ rfqItemId: 'item-2', lineTotal: 6 }),
        ]),
      );
    });

    it('refuses further responses once the RFQ is closed', async () => {
      repository.findById.mockResolvedValue(makeRfq({ status: 'closed' }) as never);
      await expect(
        service.recordResponse(COMPANY_ID, RFQ_ID, USER_ID, { supplierId: 'supplier-1', items: [{ rfqItemId: 'item-1', unitPrice: 1, quantity: 1 }] }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('selectResponse', () => {
    it('rejects a response that does not belong to this RFQ', async () => {
      await expect(service.selectResponse(COMPANY_ID, RFQ_ID, USER_ID, 'not-mine')).rejects.toThrow(BadRequestException);
      expect(repository.selectResponse).not.toHaveBeenCalled();
    });

    it('selects a response that belongs to the RFQ', async () => {
      await service.selectResponse(COMPANY_ID, RFQ_ID, USER_ID, 'response-1');
      expect(repository.selectResponse).toHaveBeenCalledWith(COMPANY_ID, RFQ_ID, 'response-1');
    });
  });
});
