import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { PaginatedResult, PaginationQueryDto, paginate } from '../../common/dto/pagination.dto';
import { DocumentNumberingService } from '../../common/numbering/document-numbering.service';
import { ClaimsService } from '../claims/claims.service';
import { CreateInvoiceFromClaimDto } from './dto/create-invoice-from-claim.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { InvoiceWithDetail, InvoicesRepository } from './invoices.repository';

const VOIDABLE_STATUSES = ['draft', 'sent'];

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

@Injectable()
export class InvoicesService {
  constructor(
    private readonly repository: InvoicesRepository,
    private readonly claims: ClaimsService,
    private readonly numbering: DocumentNumberingService,
    private readonly audit: AuditService,
  ) {}

  /** FR-13.3 — the only invoice creation path: a certified client claim. Subcontractor claims are a project cost (see ClaimsService.certify), never billed to the client, so they never reach here. */
  async createFromClaim(companyId: string, actorUserId: string, claimId: string, dto: CreateInvoiceFromClaimDto): Promise<InvoiceWithDetail> {
    const claim = await this.claims.findOne(companyId, claimId);
    if (claim.claimType !== 'client') {
      throw new BadRequestException('Only a client claim can be invoiced.');
    }
    if (claim.status !== 'certified') {
      throw new BadRequestException('Only a certified claim can be invoiced.');
    }
    if (!claim.customerId) {
      throw new BadRequestException('This claim has no customer on record.');
    }

    const existing = await this.repository.findByClaimId(companyId, claimId);
    if (existing) {
      throw new BadRequestException('This claim already has an invoice.');
    }

    const subtotal = Number(claim.netClaimAmount);
    const taxAmount = round2(dto.taxAmount ?? 0);
    const total = round2(subtotal + taxAmount);
    const invoiceNumber = await this.numbering.allocate(companyId, 'invoice');

    const invoice = await this.repository.create({
      companyId,
      projectId: claim.projectId,
      claimId,
      invoiceNumber,
      customerId: claim.customerId,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      subtotal,
      taxAmount,
      total,
    });

    await this.audit.record({
      companyId,
      actorUserId,
      action: 'create',
      entityType: 'invoice',
      entityId: invoice.id,
      after: invoice,
    });
    return invoice;
  }

  async findOne(companyId: string, id: string): Promise<InvoiceWithDetail> {
    const invoice = await this.repository.findById(companyId, id);
    if (!invoice) {
      throw new NotFoundException('Invoice not found.');
    }
    return invoice;
  }

  /**
   * Edit action for a not-yet-sent invoice — dueDate and taxAmount only.
   * There's no line-item revision here the way Quotations/POs have one:
   * subtotal is fixed to the claim it was created from, so the amount
   * itself can only change by editing that claim, not this invoice.
   */
  async update(companyId: string, id: string, actorUserId: string, dto: UpdateInvoiceDto): Promise<InvoiceWithDetail> {
    const existing = await this.findOne(companyId, id);
    if (existing.status !== 'draft') {
      throw new ForbiddenException(`An invoice in '${existing.status}' status cannot be edited — only while still draft, before it's sent.`);
    }

    const taxAmount = dto.taxAmount !== undefined ? round2(dto.taxAmount) : Number(existing.taxAmount);
    const total = round2(Number(existing.subtotal) + taxAmount);
    const updated = await this.repository.update(companyId, id, {
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      taxAmount,
      total,
    });

    await this.audit.record({
      companyId,
      actorUserId,
      action: 'update',
      entityType: 'invoice',
      entityId: id,
      before: existing,
      after: updated,
    });
    return updated;
  }

  async list(
    companyId: string,
    query: PaginationQueryDto & { status?: string; projectId?: string; customerId?: string },
  ): Promise<PaginatedResult<InvoiceWithDetail>> {
    const { data, total } = await this.repository.list(companyId, query);
    return paginate(data, total, query);
  }

  async send(companyId: string, id: string, actorUserId: string): Promise<InvoiceWithDetail> {
    const claimed = await this.repository.tryTransitionStatus(companyId, id, 'draft', 'sent');
    if (!claimed) {
      throw new ForbiddenException('Only a draft invoice can be sent.');
    }
    await this.audit.record({ companyId, actorUserId, action: 'send', entityType: 'invoice', entityId: id });
    return this.findOne(companyId, id);
  }

  /** Scoped like PurchaseOrdersService.cancel() — only before any payment has landed; voiding a partially/fully paid invoice needs payment-reversal logic this batch doesn't build. */
  async void(companyId: string, id: string, actorUserId: string): Promise<InvoiceWithDetail> {
    const invoice = await this.findOne(companyId, id);
    if (!VOIDABLE_STATUSES.includes(invoice.status)) {
      throw new ForbiddenException(
        `An invoice in '${invoice.status}' status cannot be voided. Allowed from: ${VOIDABLE_STATUSES.join(', ')}.`,
      );
    }
    const claimed = await this.repository.tryTransitionStatus(companyId, id, invoice.status as 'draft' | 'sent', 'void');
    if (!claimed) {
      throw new ForbiddenException('This invoice was already updated by someone else — refresh and check its current status.');
    }
    await this.audit.record({ companyId, actorUserId, action: 'void', entityType: 'invoice', entityId: id });
    return this.findOne(companyId, id);
  }

  /** FR-13.4's local half (no accounting-system sync exists yet — see apps/api/README.md): records a payment and, once the invoice is fully paid, marks its originating claim paid too. */
  async recordPayment(companyId: string, id: string, actorUserId: string, dto: RecordPaymentDto): Promise<InvoiceWithDetail> {
    const invoice = await this.repository.recordPayment(
      companyId,
      id,
      round2(dto.amount),
      dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
      dto.method,
      dto.reference,
      actorUserId,
    );

    if (invoice.status === 'paid' && invoice.claimId) {
      await this.claims.markPaid(companyId, invoice.claimId);
    }

    await this.audit.record({
      companyId,
      actorUserId,
      action: 'record_payment',
      entityType: 'invoice',
      entityId: id,
      after: { amount: dto.amount, status: invoice.status },
    });
    return invoice;
  }
}
