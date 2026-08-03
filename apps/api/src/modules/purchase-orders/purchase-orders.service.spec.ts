import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ApprovalService } from '../../common/approval/approval.service';
import { AuditService } from '../../common/audit/audit.service';
import { DocumentNumberingService } from '../../common/numbering/document-numbering.service';
import { MaterialRequestsRepository } from '../procurement/material-requests.repository';
import { CostingService } from '../project-costing/project-costing.service';
import { ProjectsRepository } from '../projects/projects.repository';
import { SuppliersRepository } from '../suppliers/suppliers.repository';
import { PurchaseOrdersRepository } from './purchase-orders.repository';
import { PurchaseOrdersService } from './purchase-orders.service';
import { SupplierNotificationService } from './supplier-notification.service';

const COMPANY_ID = 'company-1';
const USER_ID = 'user-1';

function makePo(overrides: Record<string, unknown> = {}) {
  return {
    id: 'po-1',
    companyId: COMPANY_ID,
    projectId: 'project-1',
    status: 'draft',
    total: 5000,
    supplier: { id: 'supplier-1', name: 'SteelWorks Trading' },
    items: [
      { id: 'item-1', costCategory: 'material', lineTotal: 3000, unitPrice: 30, quantity: 100 },
      { id: 'item-2', costCategory: 'equipment', lineTotal: 2000, unitPrice: 2000, quantity: 1 },
    ],
    ...overrides,
  };
}

describe('PurchaseOrdersService', () => {
  let service: PurchaseOrdersService;
  let repository: jest.Mocked<
    Pick<PurchaseOrdersRepository, 'create' | 'findById' | 'updateStatus' | 'tryTransitionStatus' | 'list' | 'recordDelivery'>
  >;
  let suppliers: jest.Mocked<Pick<SuppliersRepository, 'findById'>>;
  let projects: jest.Mocked<Pick<ProjectsRepository, 'findById'>>;
  let materialRequests: jest.Mocked<Pick<MaterialRequestsRepository, 'findById'>>;
  let approval: jest.Mocked<Pick<ApprovalService, 'start' | 'decide' | 'getOpenRequestForEntity'>>;
  let costing: jest.Mocked<Pick<CostingService, 'record'>>;

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findById: jest.fn(),
      updateStatus: jest.fn(),
      tryTransitionStatus: jest.fn().mockResolvedValue(true),
      list: jest.fn(),
      recordDelivery: jest.fn(),
    };
    suppliers = { findById: jest.fn() };
    projects = { findById: jest.fn() };
    materialRequests = { findById: jest.fn() };
    approval = { start: jest.fn(), decide: jest.fn(), getOpenRequestForEntity: jest.fn() };
    costing = { record: jest.fn() };

    service = new PurchaseOrdersService(
      repository as unknown as PurchaseOrdersRepository,
      suppliers as unknown as SuppliersRepository,
      projects as unknown as ProjectsRepository,
      materialRequests as unknown as MaterialRequestsRepository,
      { allocate: jest.fn().mockResolvedValue('PO-0001') } as unknown as DocumentNumberingService,
      approval as unknown as ApprovalService,
      { record: jest.fn() } as unknown as AuditService,
      { sendPurchaseOrder: jest.fn() } as unknown as SupplierNotificationService,
      costing as unknown as CostingService,
    );
  });

  describe('create', () => {
    const validDto = {
      supplierId: 'supplier-1',
      projectId: 'project-1',
      taxAmount: 0,
      items: [{ description: 'Rebar', unit: 'kg', quantity: 100, unitPrice: 5, costCategory: 'material' as const }],
    };

    it('rejects a supplier that does not belong to the tenant', async () => {
      suppliers.findById.mockResolvedValue(null);

      await expect(service.create(COMPANY_ID, USER_ID, validDto)).rejects.toThrow(BadRequestException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('rejects an inactive/blacklisted supplier', async () => {
      suppliers.findById.mockResolvedValue({ id: 'supplier-1', status: 'blacklisted', name: 'Bad Co' } as never);

      await expect(service.create(COMPANY_ID, USER_ID, validDto)).rejects.toThrow(BadRequestException);
    });

    it('rejects a project that does not belong to the tenant', async () => {
      suppliers.findById.mockResolvedValue({ id: 'supplier-1', status: 'active', paymentTerms: null } as never);
      projects.findById.mockResolvedValue(null);

      await expect(service.create(COMPANY_ID, USER_ID, validDto)).rejects.toThrow(BadRequestException);
    });

    it('computes line totals as quantity * unitPrice and passes them to the repository', async () => {
      suppliers.findById.mockResolvedValue({ id: 'supplier-1', status: 'active', paymentTerms: 'Net 30' } as never);
      projects.findById.mockResolvedValue({ id: 'project-1' } as never);
      repository.create.mockResolvedValue(makePo() as never);

      await service.create(COMPANY_ID, USER_ID, validDto);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [expect.objectContaining({ lineTotal: 500 })], // 100 * 5
        }),
      );
    });
  });

  describe('issue', () => {
    it('refuses to issue a PO that is not approved', async () => {
      repository.findById.mockResolvedValue(makePo({ status: 'draft' }) as never);

      await expect(service.issue(COMPANY_ID, 'po-1', USER_ID)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('cancel', () => {
    it.each(['draft', 'pending_approval'])('allows cancelling a %s PO', async (status) => {
      repository.findById.mockResolvedValue(makePo({ status }) as never);

      await service.cancel(COMPANY_ID, 'po-1', USER_ID);

      expect(repository.updateStatus).toHaveBeenCalledWith(COMPANY_ID, 'po-1', 'cancelled');
    });

    it.each(['approved', 'issued', 'partially_received'])(
      'refuses to cancel a %s PO, since it would need to reverse committed cost the ledger can\'t isolate per PO',
      async (status) => {
        repository.findById.mockResolvedValue(makePo({ status }) as never);

        await expect(service.cancel(COMPANY_ID, 'po-1', USER_ID)).rejects.toThrow(ForbiddenException);
        expect(repository.updateStatus).not.toHaveBeenCalled();
      },
    );

    it('refuses to cancel a PO that is already received or closed', async () => {
      repository.findById.mockResolvedValue(makePo({ status: 'received' }) as never);

      await expect(service.cancel(COMPANY_ID, 'po-1', USER_ID)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('submitForApproval', () => {
    it('refuses to submit a PO that is not in draft status', async () => {
      repository.findById.mockResolvedValue(makePo({ status: 'issued' }) as never);

      await expect(service.submitForApproval(COMPANY_ID, 'po-1', USER_ID)).rejects.toThrow(ForbiddenException);
      expect(approval.start).not.toHaveBeenCalled();
    });

    it('rejects cleanly when it loses the atomic-claim race to a concurrent submit on the same draft', async () => {
      repository.findById.mockResolvedValue(makePo() as never);
      repository.tryTransitionStatus.mockResolvedValue(false);

      await expect(service.submitForApproval(COMPANY_ID, 'po-1', USER_ID)).rejects.toThrow(ForbiddenException);
      expect(approval.start).not.toHaveBeenCalled();
    });

    it('auto-approves when no workflow is configured, advancing past the claimed pending_approval state', async () => {
      repository.findById.mockResolvedValue(makePo() as never);
      approval.start.mockResolvedValue({ status: 'approved' } as never);

      await service.submitForApproval(COMPANY_ID, 'po-1', USER_ID);

      expect(repository.tryTransitionStatus).toHaveBeenCalledWith(COMPANY_ID, 'po-1', 'draft', 'pending_approval');
      expect(repository.updateStatus).toHaveBeenCalledWith(
        COMPANY_ID,
        'po-1',
        'approved',
        expect.objectContaining({ approvedBy: USER_ID }),
      );
    });

    /**
     * Regression test for a real bug: this auto-approve branch used to
     * update status directly without recording committed cost, unlike
     * `decide()`'s approved branch — found via the frontend's real
     * end-to-end click-through (a PO approved this way left the
     * project's costing dashboard with a permanently negative
     * "Committed" figure once delivered, since there was nothing for
     * the delivery's release entry to net against). Confirmed against
     * the real `cost_transactions` table before fixing, not just
     * inferred from the code.
     */
    it('records committed cost on auto-approve, the same as an explicit approval decision', async () => {
      repository.findById.mockResolvedValue(makePo() as never);
      approval.start.mockResolvedValue({ status: 'approved' } as never);

      await service.submitForApproval(COMPANY_ID, 'po-1', USER_ID);

      expect(costing.record).toHaveBeenCalledWith(
        expect.objectContaining({ costCategory: 'material', transactionType: 'committed', amount: 3000 }),
      );
      expect(costing.record).toHaveBeenCalledWith(
        expect.objectContaining({ costCategory: 'equipment', transactionType: 'committed', amount: 2000 }),
      );
    });

    it('leaves the PO pending when a workflow is configured, without a redundant second status write', async () => {
      repository.findById.mockResolvedValue(makePo() as never);
      approval.start.mockResolvedValue({ status: 'pending' } as never);

      await service.submitForApproval(COMPANY_ID, 'po-1', USER_ID);

      expect(repository.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe('decide', () => {
    it('records one committed cost transaction per category present on the PO when approved', async () => {
      repository.findById.mockResolvedValue(makePo({ status: 'pending_approval' }) as never);
      approval.getOpenRequestForEntity.mockResolvedValue({ id: 'req-1' } as never);
      approval.decide.mockResolvedValue({ status: 'approved' } as never);

      await service.decide(COMPANY_ID, 'po-1', USER_ID, 'approved');

      expect(costing.record).toHaveBeenCalledWith(
        expect.objectContaining({ costCategory: 'material', transactionType: 'committed', amount: 3000 }),
      );
      expect(costing.record).toHaveBeenCalledWith(
        expect.objectContaining({ costCategory: 'equipment', transactionType: 'committed', amount: 2000 }),
      );
    });

    it('does not touch the cost ledger when the decision is a rejection', async () => {
      repository.findById.mockResolvedValue(makePo({ status: 'pending_approval' }) as never);
      approval.getOpenRequestForEntity.mockResolvedValue({ id: 'req-1' } as never);
      approval.decide.mockResolvedValue({ status: 'rejected' } as never);

      await service.decide(COMPANY_ID, 'po-1', USER_ID, 'rejected');

      expect(costing.record).not.toHaveBeenCalled();
    });
  });

  describe('recordDelivery', () => {
    it('refuses a delivery against a PO that has not been issued', async () => {
      repository.findById.mockResolvedValue(makePo({ status: 'approved' }) as never);

      await expect(
        service.recordDelivery(COMPANY_ID, 'po-1', USER_ID, {
          deliveryDate: '2026-07-01',
          items: [{ purchaseOrderItemId: 'item-1', quantityReceived: 10 }],
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(repository.recordDelivery).not.toHaveBeenCalled();
    });

    it('allows a delivery against an issued PO', async () => {
      repository.findById.mockResolvedValue(makePo({ status: 'issued' }) as never);
      repository.recordDelivery.mockResolvedValue(makePo({ status: 'partially_received' }) as never);

      const result = await service.recordDelivery(COMPANY_ID, 'po-1', USER_ID, {
        deliveryDate: '2026-07-01',
        items: [{ purchaseOrderItemId: 'item-1', quantityReceived: 10 }],
      });

      expect(result.status).toBe('partially_received');
    });

    it('releases committed and records actual for the delivered value, keyed off the pre-delivery unit price', async () => {
      // item-1 is material @ unitPrice 30; receiving 10 units -> $300 delivered value.
      repository.findById.mockResolvedValue(makePo({ status: 'issued' }) as never);
      repository.recordDelivery.mockResolvedValue(makePo({ status: 'partially_received' }) as never);

      await service.recordDelivery(COMPANY_ID, 'po-1', USER_ID, {
        deliveryDate: '2026-07-01',
        items: [{ purchaseOrderItemId: 'item-1', quantityReceived: 10 }],
      });

      expect(costing.record).toHaveBeenCalledWith(
        expect.objectContaining({ costCategory: 'material', transactionType: 'committed', amount: -300 }),
      );
      expect(costing.record).toHaveBeenCalledWith(
        expect.objectContaining({ costCategory: 'material', transactionType: 'actual', amount: 300 }),
      );
      // item-2 (equipment) was not part of this delivery — no ledger entries for it.
      expect(costing.record).not.toHaveBeenCalledWith(expect.objectContaining({ costCategory: 'equipment' }));
    });
  });
});
