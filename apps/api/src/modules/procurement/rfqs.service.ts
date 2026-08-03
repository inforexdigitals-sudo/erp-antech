import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { PaginatedResult, PaginationQueryDto, paginate } from '../../common/dto/pagination.dto';
import { DocumentNumberingService } from '../../common/numbering/document-numbering.service';
import { ProjectsRepository } from '../projects/projects.repository';
import { SuppliersRepository } from '../suppliers/suppliers.repository';
import { AddRfqRecipientsDto } from './dto/add-rfq-recipients.dto';
import { CreateRfqDto } from './dto/create-rfq.dto';
import { RecordRfqResponseDto } from './dto/record-rfq-response.dto';
import { MaterialRequestsRepository } from './material-requests.repository';
import { RfqWithDetail, RfqsRepository } from './rfqs.repository';

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

@Injectable()
export class RfqsService {
  constructor(
    private readonly repository: RfqsRepository,
    private readonly materialRequests: MaterialRequestsRepository,
    private readonly projects: ProjectsRepository,
    private readonly suppliers: SuppliersRepository,
    private readonly numbering: DocumentNumberingService,
    private readonly audit: AuditService,
  ) {}

  async create(companyId: string, actorUserId: string, dto: CreateRfqDto): Promise<RfqWithDetail> {
    if (dto.materialRequestId) {
      const materialRequest = await this.materialRequests.findById(companyId, dto.materialRequestId);
      if (!materialRequest) {
        throw new BadRequestException('Material request not found.');
      }
    }
    if (dto.projectId) {
      const project = await this.projects.findById(companyId, dto.projectId);
      if (!project) {
        throw new BadRequestException('Project not found.');
      }
    }
    if (dto.supplierIds?.length) {
      await this.assertSuppliersBelongToTenant(companyId, dto.supplierIds);
    }

    const rfqNumber = await this.numbering.allocate(companyId, 'rfq');
    const rfq = await this.repository.create({
      companyId,
      rfqNumber,
      materialRequestId: dto.materialRequestId,
      projectId: dto.projectId,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      createdBy: actorUserId,
      items: dto.items,
      supplierIds: dto.supplierIds,
    });

    await this.audit.record({ companyId, actorUserId, action: 'create', entityType: 'rfq', entityId: rfq.id, after: rfq });
    return rfq;
  }

  async findOne(companyId: string, id: string): Promise<RfqWithDetail> {
    const rfq = await this.repository.findById(companyId, id);
    if (!rfq) {
      throw new NotFoundException('RFQ not found.');
    }
    return rfq;
  }

  async list(
    companyId: string,
    query: PaginationQueryDto & { status?: string; projectId?: string },
  ): Promise<PaginatedResult<RfqWithDetail>> {
    const { data, total } = await this.repository.list(companyId, query);
    return paginate(data, total, query);
  }

  async addRecipients(companyId: string, id: string, actorUserId: string, dto: AddRfqRecipientsDto): Promise<RfqWithDetail> {
    const rfq = await this.findOne(companyId, id);
    if (rfq.status === 'closed') {
      throw new ForbiddenException('This RFQ is closed — a response was already selected.');
    }
    await this.assertSuppliersBelongToTenant(companyId, dto.supplierIds);
    await this.repository.addRecipients(id, dto.supplierIds);
    await this.audit.record({ companyId, actorUserId, action: 'add_recipients', entityType: 'rfq', entityId: id, after: { supplierIds: dto.supplierIds } });
    return this.findOne(companyId, id);
  }

  /** Dispatch is stubbed — same tier as QuotationDeliveryService/SupplierNotificationService: the endpoint contract is real, actual email delivery isn't wired yet. */
  async send(companyId: string, id: string, actorUserId: string): Promise<RfqWithDetail> {
    const rfq = await this.findOne(companyId, id);
    if (rfq.recipients.length === 0) {
      throw new BadRequestException('Add at least one supplier recipient before sending this RFQ.');
    }
    const claimed = await this.repository.tryTransitionStatus(companyId, id, 'draft', 'sent');
    if (!claimed) {
      throw new ForbiddenException('Only a draft RFQ can be sent.');
    }
    await this.repository.markRecipientsSent(id);
    await this.audit.record({ companyId, actorUserId, action: 'send', entityType: 'rfq', entityId: id });
    return this.findOne(companyId, id);
  }

  /**
   * FR-6.2 — recording a supplier's quote. A response from a supplier
   * not yet on the recipient list is accepted (an unsolicited quote is
   * still useful for comparison) and adds them as a recipient rather
   * than being rejected.
   */
  async recordResponse(companyId: string, id: string, actorUserId: string, dto: RecordRfqResponseDto): Promise<RfqWithDetail> {
    const rfq = await this.findOne(companyId, id);
    if (rfq.status === 'closed') {
      throw new ForbiddenException('This RFQ is closed — no further responses can be recorded.');
    }
    const supplier = await this.suppliers.findById(companyId, dto.supplierId);
    if (!supplier) {
      throw new BadRequestException('Supplier not found.');
    }
    const rfqItemIds = new Set(rfq.items.map((item) => item.id));
    for (const item of dto.items) {
      if (!rfqItemIds.has(item.rfqItemId)) {
        throw new BadRequestException(`Item ${item.rfqItemId} does not belong to this RFQ.`);
      }
    }
    if (!rfq.recipients.some((r) => r.supplierId === dto.supplierId)) {
      await this.repository.addRecipients(id, [dto.supplierId]);
    }

    const items = dto.items.map((item) => ({ ...item, lineTotal: round2(item.unitPrice * item.quantity) }));
    const totalAmount = round2(items.reduce((sum, item) => sum + item.lineTotal, 0));

    await this.repository.recordResponse(id, dto.supplierId, totalAmount, dto.leadTimeDays, dto.notes, items);

    if (rfq.status === 'sent') {
      await this.repository.updateStatus(companyId, id, 'responses_received');
    }

    await this.audit.record({
      companyId,
      actorUserId,
      action: 'record_response',
      entityType: 'rfq',
      entityId: id,
      after: { supplierId: dto.supplierId, totalAmount },
    });
    return this.findOne(companyId, id);
  }

  /** FR-6.3 — no scoring algorithm: this closes the RFQ and marks the chosen response, ranking responses (by totalAmount/leadTimeDays) is left to the caller/frontend to present, not computed server-side. */
  async selectResponse(companyId: string, id: string, actorUserId: string, responseId: string): Promise<RfqWithDetail> {
    const rfq = await this.findOne(companyId, id);
    if (!rfq.responses.some((r) => r.id === responseId)) {
      throw new BadRequestException('This response does not belong to this RFQ.');
    }
    await this.repository.selectResponse(companyId, id, responseId);
    await this.audit.record({ companyId, actorUserId, action: 'select_response', entityType: 'rfq', entityId: id, after: { responseId } });
    return this.findOne(companyId, id);
  }

  private async assertSuppliersBelongToTenant(companyId: string, supplierIds: string[]): Promise<void> {
    for (const supplierId of supplierIds) {
      const supplier = await this.suppliers.findById(companyId, supplierId);
      if (!supplier) {
        throw new BadRequestException(`Supplier ${supplierId} not found.`);
      }
    }
  }
}
