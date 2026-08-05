import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ApprovalService } from '../../common/approval/approval.service';
import { AuditService } from '../../common/audit/audit.service';
import { PaginatedResult, PaginationQueryDto, paginate } from '../../common/dto/pagination.dto';
import { DocumentNumberingService } from '../../common/numbering/document-numbering.service';
import { CustomersRepository } from '../crm/customers.repository';
import { ProjectsRepository, ProjectWithDetail } from '../projects/projects.repository';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { CreateRevisionDto } from './dto/create-revision.dto';
import { QuotationItemInputDto } from './dto/quotation-item-input.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import { QuotationDeliveryService } from './quotation-delivery.service';
import { priceRevision } from './quotation-pricing.util';
import { QuotationStatus } from './quotation.types';
import {
  QuotationWithDetail,
  QuotationsRepository,
  RevisionForPersistence,
} from './quotations.repository';

/**
 * Also editable while pending_approval, not just draft — this company runs
 * without a configured approval workflow (ApprovalService.start() auto-
 * approves when none exists), so pending_approval is typically momentary
 * anyway. A correction made here doesn't retroactively change anything an
 * approver already decided on.
 */
const EDITABLE_HEADER_STATUSES: QuotationStatus[] = ['draft', 'pending_approval'];
const REVISABLE_STATUSES: QuotationStatus[] = ['draft', 'pending_approval', 'rejected'];

@Injectable()
export class QuotationsService {
  constructor(
    private readonly repository: QuotationsRepository,
    private readonly customers: CustomersRepository,
    private readonly projects: ProjectsRepository,
    private readonly numbering: DocumentNumberingService,
    private readonly approval: ApprovalService,
    private readonly audit: AuditService,
    private readonly delivery: QuotationDeliveryService,
  ) {}

  async create(companyId: string, actorUserId: string, dto: CreateQuotationDto): Promise<QuotationWithDetail> {
    await this.assertCustomerBelongsToTenant(companyId, dto.customerId);
    const revision = await this.priceItems(companyId, dto.items, dto.discountAmount);
    const quotationNumber = await this.numbering.allocate(companyId, 'quotation');

    const quotation = await this.repository.createWithFirstRevision(
      {
        companyId,
        quotationNumber,
        customerId: dto.customerId,
        leadId: dto.leadId,
        opportunityId: dto.opportunityId,
        ownerUserId: dto.ownerUserId ?? actorUserId,
        title: dto.title,
        validUntil: dto.validUntil,
        createdBy: actorUserId,
      },
      revision,
      dto.notes,
    );

    await this.audit.record({
      companyId,
      actorUserId,
      action: 'create',
      entityType: 'quotation',
      entityId: quotation.id,
      after: quotation,
    });

    return quotation;
  }

  async findOne(companyId: string, id: string): Promise<QuotationWithDetail> {
    const quotation = await this.repository.findById(companyId, id);
    if (!quotation) {
      throw new NotFoundException('Quotation not found.');
    }
    return quotation;
  }

  async list(
    companyId: string,
    query: PaginationQueryDto & { status?: string; customerId?: string },
  ): Promise<PaginatedResult<QuotationWithDetail>> {
    const { data, total } = await this.repository.list(companyId, query);
    return paginate(data, total, query);
  }

  async updateHeader(
    companyId: string,
    id: string,
    actorUserId: string,
    dto: UpdateQuotationDto,
  ): Promise<QuotationWithDetail> {
    const existing = await this.findOne(companyId, id);
    this.assertStatusIn(existing, EDITABLE_HEADER_STATUSES, 'edited');

    if (dto.customerId) {
      await this.assertCustomerBelongsToTenant(companyId, dto.customerId);
    }

    await this.repository.updateHeader(companyId, id, {
      title: dto.title,
      customerId: dto.customerId,
      ownerUserId: dto.ownerUserId,
      validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
    });

    const updated = await this.findOne(companyId, id);
    await this.audit.record({
      companyId,
      actorUserId,
      action: 'update',
      entityType: 'quotation',
      entityId: id,
      before: existing,
      after: updated,
    });
    return updated;
  }

  /** FR-3.2 — a new revision is an immutable snapshot; it never mutates a prior one. */
  async addRevision(
    companyId: string,
    id: string,
    actorUserId: string,
    dto: CreateRevisionDto,
  ): Promise<QuotationWithDetail> {
    const existing = await this.findOne(companyId, id);
    this.assertStatusIn(existing, REVISABLE_STATUSES, 'revised');

    const revision = await this.priceItems(companyId, dto.items, dto.discountAmount);
    const nextRevisionNumber = (existing.currentRevision?.revisionNumber ?? 0) + 1;

    const updated = await this.repository.addRevision(
      companyId,
      id,
      nextRevisionNumber,
      revision,
      dto.notes,
      actorUserId,
    );

    await this.audit.record({
      companyId,
      actorUserId,
      action: 'create',
      entityType: 'quotation_revision',
      entityId: updated.currentRevisionId ?? undefined,
      after: updated.currentRevision,
    });
    return updated;
  }

  /**
   * FR-3.5 — routes through the shared approval engine (common/approval).
   *
   * Claims the `draft` -> `pending_approval` transition atomically
   * before calling `approval.start()`. Without that, two concurrent
   * submits on the same draft could both pass the status check, and
   * each would open its own `approval_request` row for the same
   * quotation — the older one orphaned forever, since
   * `getOpenRequestForEntity` only ever returns the newest.
   */
  async submitForApproval(companyId: string, id: string, actorUserId: string): Promise<QuotationWithDetail> {
    const quotation = await this.findOne(companyId, id);
    if (quotation.status !== 'draft') {
      throw new ForbiddenException('Only a draft quotation can be submitted for approval.');
    }
    if (!quotation.currentRevision) {
      throw new BadRequestException('This quotation has no priced revision yet.');
    }

    const claimed = await this.repository.tryTransitionStatus(companyId, id, 'draft', 'pending_approval');
    if (!claimed) {
      throw new ForbiddenException('This quotation was already submitted for approval by someone else.');
    }

    const request = await this.approval.start({
      companyId,
      module: 'quotation',
      entityType: 'quotation',
      entityId: id,
      amount: Number(quotation.currentRevision.total),
    });

    // No workflow configured for this company/module -> approval.start()
    // auto-approved immediately; move past the 'pending_approval' state
    // just claimed to reflect that.
    if (request.status === 'approved') {
      await this.repository.updateStatus(companyId, id, 'approved');
    }

    await this.audit.record({
      companyId,
      actorUserId,
      action: 'submit_for_approval',
      entityType: 'quotation',
      entityId: id,
      after: { status: request.status === 'approved' ? 'approved' : 'pending_approval' },
    });
    return this.findOne(companyId, id);
  }

  async decide(
    companyId: string,
    id: string,
    actorUserId: string,
    decision: 'approved' | 'rejected',
    comments?: string,
  ): Promise<QuotationWithDetail> {
    const quotation = await this.findOne(companyId, id);
    if (quotation.status !== 'pending_approval') {
      throw new ForbiddenException('This quotation is not awaiting approval.');
    }

    const openRequest = await this.approval.getOpenRequestForEntity(companyId, 'quotation', id);
    if (!openRequest) {
      throw new BadRequestException('No open approval request found for this quotation.');
    }

    const result = await this.approval.decide({
      companyId,
      approvalRequestId: openRequest.id,
      actorUserId,
      decision,
      comments,
    });

    const nextStatus: QuotationStatus =
      result.status === 'approved' ? 'approved' : result.status === 'rejected' ? 'rejected' : 'pending_approval';
    await this.repository.updateStatus(companyId, id, nextStatus);
    return this.findOne(companyId, id);
  }

  /** FR-3.4 / FR-3.6 — see quotation-delivery.service.ts for what "send" actually does today. */
  async send(companyId: string, id: string, actorUserId: string): Promise<QuotationWithDetail> {
    const quotation = await this.findOne(companyId, id);
    if (quotation.status !== 'approved') {
      throw new ForbiddenException('Only an approved quotation can be sent to the customer.');
    }

    await this.delivery.sendToCustomer(quotation);
    await this.repository.updateStatus(companyId, id, 'sent');

    await this.audit.record({
      companyId,
      actorUserId,
      action: 'send',
      entityType: 'quotation',
      entityId: id,
    });
    return this.findOne(companyId, id);
  }

  /**
   * FR-3.6 — records whether the customer accepted or declined a sent
   * quotation. No client portal exists yet (`portal_accounts` isn't
   * wired up), so — same pattern as `VariationOrdersService
   * .recordClientSignOff` and `ProjectsService`'s site reports — this
   * is recorded by internal staff confirming what happened out of
   * band (a phone call, a signed PDF, an email reply), not submitted
   * by the customer themselves.
   *
   * This endpoint didn't exist before: `convertToProject` has always
   * required `status === 'accepted'`, but nothing ever transitioned a
   * quotation into that status — a real gap from the original Phase 5
   * batch, caught only once the frontend tried to exercise the full
   * quotation → project workflow for real.
   */
  async recordCustomerDecision(
    companyId: string,
    id: string,
    actorUserId: string,
    decision: 'accepted' | 'rejected',
  ): Promise<QuotationWithDetail> {
    const quotation = await this.findOne(companyId, id);
    if (quotation.status !== 'sent') {
      throw new ForbiddenException('Only a sent quotation can have a customer decision recorded against it.');
    }

    const claimed = await this.repository.tryTransitionStatus(companyId, id, 'sent', decision);
    if (!claimed) {
      throw new ForbiddenException('This quotation was already updated by someone else — refresh and check its current status.');
    }

    await this.audit.record({
      companyId,
      actorUserId,
      action: 'record_customer_decision',
      entityType: 'quotation',
      entityId: id,
      after: { status: decision },
    });
    return this.findOne(companyId, id);
  }

  /** FR-3.7 — one-click conversion into a Project, carrying customer and contract value across. */
  async convertToProject(companyId: string, id: string, actorUserId: string) {
    const quotation = await this.findOne(companyId, id);
    if (quotation.status !== 'accepted') {
      throw new ForbiddenException('Only a customer-accepted quotation can be converted into a project.');
    }
    if (!quotation.currentRevision) {
      throw new BadRequestException('This quotation has no priced revision to carry into the project.');
    }

    const project = await this.projects.createFromQuotation({
      companyId,
      name: quotation.title,
      customerId: quotation.customerId,
      quotationId: quotation.id,
      contractValue: Number(quotation.currentRevision.total),
    });

    await this.repository.updateStatus(companyId, id, 'converted');
    await this.audit.record({
      companyId,
      actorUserId,
      action: 'convert_to_project',
      entityType: 'quotation',
      entityId: id,
      after: { projectId: project.id },
    });

    return project;
  }

  /**
   * Used by PDF import (see ProjectImportService.confirm) to backfill an
   * already-completed historical deal: creates a priced quotation + first
   * revision (like create()) and immediately produces its linked project
   * (like convertToProject() above), skipping the draft→sent→accepted
   * lifecycle since there's no live customer interaction to record for a
   * historical import — the deal is already done, just being digitized.
   */
  async createHistoricalProject(companyId: string, actorUserId: string, dto: CreateQuotationDto): Promise<ProjectWithDetail> {
    await this.assertCustomerBelongsToTenant(companyId, dto.customerId);
    const revision = await this.priceItems(companyId, dto.items, dto.discountAmount);
    const quotationNumber = await this.numbering.allocate(companyId, 'quotation');

    const quotation = await this.repository.createWithFirstRevision(
      {
        companyId,
        quotationNumber,
        customerId: dto.customerId,
        leadId: dto.leadId,
        opportunityId: dto.opportunityId,
        ownerUserId: dto.ownerUserId ?? actorUserId,
        title: dto.title,
        validUntil: dto.validUntil,
        createdBy: actorUserId,
      },
      revision,
      dto.notes,
    );

    const project = await this.projects.createFromQuotation({
      companyId,
      name: quotation.title,
      customerId: quotation.customerId,
      quotationId: quotation.id,
      contractValue: Number(revision.total),
    });

    await this.repository.updateStatus(companyId, quotation.id, 'converted');
    await this.audit.record({
      companyId,
      actorUserId,
      action: 'create',
      entityType: 'quotation',
      entityId: quotation.id,
      after: quotation,
    });

    const projectWithDetail = await this.projects.findDetailById(companyId, project.id);
    if (!projectWithDetail) {
      throw new NotFoundException('Project not found after creation.');
    }
    return projectWithDetail;
  }

  private async priceItems(
    companyId: string,
    items: QuotationItemInputDto[],
    overallDiscountAmount: number,
  ): Promise<RevisionForPersistence> {
    const taxCodeIds = [...new Set(items.map((i) => i.taxCodeId).filter((id): id is string => !!id))];
    const taxRates = await this.repository.getTaxRates(companyId, taxCodeIds);

    for (const item of items) {
      if (item.taxCodeId && !taxRates.has(item.taxCodeId)) {
        throw new BadRequestException(`Tax code ${item.taxCodeId} does not exist for this company.`);
      }
    }

    const totals = priceRevision(
      items.map((item) => ({
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        markupPercent: item.markupPercent,
        discountPercent: item.discountPercent,
        taxRatePercent: item.taxCodeId ? (taxRates.get(item.taxCodeId) ?? 0) : 0,
      })),
      overallDiscountAmount,
    );

    return {
      subtotal: totals.subtotal,
      discountAmount: totals.discountAmount,
      taxAmount: totals.taxAmount,
      total: totals.total,
      items: totals.items.map((priced, index) => ({
        itemLibraryId: items[index].itemLibraryId,
        description: items[index].description,
        category: items[index].category,
        unit: items[index].unit,
        quantity: priced.quantity,
        unitCost: items[index].unitCost,
        unitPrice: priced.unitPrice,
        markupPercent: priced.markupPercent,
        discountPercent: priced.discountPercent,
        taxCodeId: items[index].taxCodeId,
        lineTotal: priced.lineTotal,
        sortOrder: items[index].sortOrder ?? index,
      })),
    };
  }

  private async assertCustomerBelongsToTenant(companyId: string, customerId: string): Promise<void> {
    const customer = await this.customers.findById(companyId, customerId);
    if (!customer) {
      throw new BadRequestException('Customer not found.');
    }
  }

  private assertStatusIn(quotation: QuotationWithDetail, allowed: QuotationStatus[], action: string): void {
    if (!allowed.includes(quotation.status as QuotationStatus)) {
      throw new ForbiddenException(
        `A quotation in '${quotation.status}' status cannot be ${action}. Allowed from: ${allowed.join(', ')}.`,
      );
    }
  }
}
