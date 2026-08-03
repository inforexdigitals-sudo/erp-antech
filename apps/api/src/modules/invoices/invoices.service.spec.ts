import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { DocumentNumberingService } from '../../common/numbering/document-numbering.service';
import { ClaimsService } from '../claims/claims.service';
import { InvoicesRepository } from './invoices.repository';
import { InvoicesService } from './invoices.service';

const COMPANY_ID = 'company-1';
const USER_ID = 'user-1';
const CLAIM_ID = 'claim-1';
const INVOICE_ID = 'invoice-1';

function makeClaim(overrides: Record<string, unknown> = {}) {
  return {
    id: CLAIM_ID,
    projectId: 'project-1',
    customerId: 'customer-1',
    claimType: 'client',
    status: 'certified',
    netClaimAmount: 900,
    ...overrides,
  };
}

function makeInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: INVOICE_ID,
    companyId: COMPANY_ID,
    claimId: CLAIM_ID,
    status: 'draft',
    total: 900,
    amountPaid: 0,
    ...overrides,
  };
}

describe('InvoicesService', () => {
  let service: InvoicesService;
  let repository: jest.Mocked<
    Pick<InvoicesRepository, 'create' | 'findById' | 'findByClaimId' | 'list' | 'tryTransitionStatus' | 'recordPayment'>
  >;
  let claims: jest.Mocked<Pick<ClaimsService, 'findOne' | 'markPaid'>>;

  beforeEach(() => {
    repository = {
      create: jest.fn().mockResolvedValue(makeInvoice()),
      findById: jest.fn().mockResolvedValue(makeInvoice()),
      findByClaimId: jest.fn().mockResolvedValue(null),
      list: jest.fn(),
      tryTransitionStatus: jest.fn().mockResolvedValue(true),
      recordPayment: jest.fn(),
    };
    claims = {
      findOne: jest.fn().mockResolvedValue(makeClaim()),
      markPaid: jest.fn(),
    };

    service = new InvoicesService(
      repository as unknown as InvoicesRepository,
      claims as unknown as ClaimsService,
      { allocate: jest.fn().mockResolvedValue('INV-0001') } as unknown as DocumentNumberingService,
      { record: jest.fn() } as unknown as AuditService,
    );
  });

  describe('createFromClaim', () => {
    it('rejects a subcontractor claim', async () => {
      claims.findOne.mockResolvedValue(makeClaim({ claimType: 'subcontractor' }) as never);
      await expect(service.createFromClaim(COMPANY_ID, USER_ID, CLAIM_ID, {})).rejects.toThrow(BadRequestException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('rejects a claim that is not yet certified', async () => {
      claims.findOne.mockResolvedValue(makeClaim({ status: 'under_review' }) as never);
      await expect(service.createFromClaim(COMPANY_ID, USER_ID, CLAIM_ID, {})).rejects.toThrow(BadRequestException);
    });

    it('rejects a claim that already has an invoice', async () => {
      repository.findByClaimId.mockResolvedValue(makeInvoice() as never);
      await expect(service.createFromClaim(COMPANY_ID, USER_ID, CLAIM_ID, {})).rejects.toThrow(BadRequestException);
    });

    it('derives subtotal from the claim net amount and adds tax to compute the total', async () => {
      await service.createFromClaim(COMPANY_ID, USER_ID, CLAIM_ID, { taxAmount: 63 });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ subtotal: 900, taxAmount: 63, total: 963, customerId: 'customer-1' }),
      );
    });
  });

  describe('send', () => {
    it('rejects cleanly when it loses the atomic-claim race (already sent)', async () => {
      repository.tryTransitionStatus.mockResolvedValue(false);
      await expect(service.send(COMPANY_ID, INVOICE_ID, USER_ID)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('void', () => {
    it('refuses to void a partially paid invoice', async () => {
      repository.findById.mockResolvedValue(makeInvoice({ status: 'partially_paid' }) as never);
      await expect(service.void(COMPANY_ID, INVOICE_ID, USER_ID)).rejects.toThrow(ForbiddenException);
      expect(repository.tryTransitionStatus).not.toHaveBeenCalled();
    });

    it('voids a draft invoice', async () => {
      repository.findById.mockResolvedValue(makeInvoice({ status: 'draft' }) as never);
      await service.void(COMPANY_ID, INVOICE_ID, USER_ID);
      expect(repository.tryTransitionStatus).toHaveBeenCalledWith(COMPANY_ID, INVOICE_ID, 'draft', 'void');
    });
  });

  describe('recordPayment', () => {
    it('marks the originating claim paid once the invoice is fully paid', async () => {
      repository.recordPayment.mockResolvedValue(makeInvoice({ status: 'paid', amountPaid: 900 }) as never);

      await service.recordPayment(COMPANY_ID, INVOICE_ID, USER_ID, { amount: 900 });

      expect(claims.markPaid).toHaveBeenCalledWith(COMPANY_ID, CLAIM_ID);
    });

    it('does not touch the claim on a partial payment', async () => {
      repository.recordPayment.mockResolvedValue(makeInvoice({ status: 'partially_paid', amountPaid: 400 }) as never);

      await service.recordPayment(COMPANY_ID, INVOICE_ID, USER_ID, { amount: 400 });

      expect(claims.markPaid).not.toHaveBeenCalled();
    });
  });
});
