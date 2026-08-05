import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ApprovalService } from '../../common/approval/approval.service';
import { AuditService } from '../../common/audit/audit.service';
import { CostCategory } from '../../common/constants/cost-category';
import { PaginatedResult, PaginationQueryDto, paginate } from '../../common/dto/pagination.dto';
import { DocumentNumberingService } from '../../common/numbering/document-numbering.service';
import { CostingService } from '../project-costing/project-costing.service';
import { ProjectsRepository } from '../projects/projects.repository';
import { CreateVariationOrderDto } from './dto/create-variation-order.dto';
import { CreateVoRevisionDto } from './dto/create-vo-revision.dto';
import { UpdateVariationOrderDto } from './dto/update-variation-order.dto';
import { VoItemInputDto } from './dto/vo-item-input.dto';
import { VariationOrderStatus } from './variation-order.types';
import { VariationOrderWithDetail, VariationOrdersRepository, VoItemInput } from './variation-orders.repository';

/**
 * Also editable while pending_approval, not just draft/rejected — safe
 * because addRevision resets status back to 'draft' itself (see
 * VariationOrdersRepository.addRevision), so an edit mid-review doesn't
 * silently mutate what an approver is looking at; it withdraws the VO
 * from review and requires re-submission, same effect a manual
 * "withdraw" action would have.
 */
const EDITABLE_STATUSES: VariationOrderStatus[] = ['draft', 'pending_approval', 'rejected'];

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** cost = quantity × unitCost, revenue = quantity × unitPrice; either factor missing on a line means $0 for that line, not an error (see VoItemInputDto). */
function sumImpacts(items: VoItemInputDto[]): { costImpact: number; revenueImpact: number } {
  let costImpact = 0;
  let revenueImpact = 0;
  for (const item of items) {
    const quantity = item.quantity ?? 0;
    costImpact += quantity * (item.unitCost ?? 0);
    revenueImpact += quantity * (item.unitPrice ?? 0);
  }
  return { costImpact: round2(costImpact), revenueImpact: round2(revenueImpact) };
}

function toRepositoryItems(items: VoItemInputDto[]): VoItemInput[] {
  return items.map((item) => ({
    description: item.description,
    unit: item.unit,
    quantity: item.quantity,
    unitCost: item.unitCost,
    unitPrice: item.unitPrice,
    costCategory: item.costCategory,
  }));
}

@Injectable()
export class VariationOrdersService {
  constructor(
    private readonly repository: VariationOrdersRepository,
    private readonly projects: ProjectsRepository,
    private readonly numbering: DocumentNumberingService,
    private readonly approval: ApprovalService,
    private readonly audit: AuditService,
    private readonly costing: CostingService,
  ) {}

  async create(companyId: string, actorUserId: string, dto: CreateVariationOrderDto): Promise<VariationOrderWithDetail> {
    const project = await this.projects.findById(companyId, dto.projectId);
    if (!project) {
      throw new BadRequestException('Project not found.');
    }

    const { costImpact, revenueImpact } = sumImpacts(dto.items);
    const voNumber = await this.numbering.allocate(companyId, 'variation_order');

    const vo = await this.repository.create({
      companyId,
      projectId: dto.projectId,
      voNumber,
      title: dto.title,
      cause: dto.cause,
      scheduleImpactDays: dto.scheduleImpactDays ?? 0,
      requestedBy: actorUserId,
      costImpact,
      revenueImpact,
      items: toRepositoryItems(dto.items),
    });

    await this.audit.record({
      companyId,
      actorUserId,
      action: 'create',
      entityType: 'variation_order',
      entityId: vo.id,
      after: vo,
    });
    return vo;
  }

  async findOne(companyId: string, id: string): Promise<VariationOrderWithDetail> {
    const vo = await this.repository.findById(companyId, id);
    if (!vo) {
      throw new NotFoundException('Variation order not found.');
    }
    return vo;
  }

  /** Edit action for title/cause/scheduleImpactDays — line items/pricing go through addRevision instead. */
  async updateHeader(companyId: string, id: string, actorUserId: string, dto: UpdateVariationOrderDto): Promise<VariationOrderWithDetail> {
    const existing = await this.findOne(companyId, id);
    if (!EDITABLE_STATUSES.includes(existing.status as VariationOrderStatus)) {
      throw new ForbiddenException(
        `A variation order in '${existing.status}' status cannot be edited. Allowed from: ${EDITABLE_STATUSES.join(', ')}.`,
      );
    }

    const updated = await this.repository.updateHeader(companyId, id, {
      title: dto.title,
      cause: dto.cause,
      scheduleImpactDays: dto.scheduleImpactDays,
    });

    await this.audit.record({
      companyId,
      actorUserId,
      action: 'update',
      entityType: 'variation_order',
      entityId: id,
      before: existing,
      after: updated,
    });
    return updated;
  }

  async list(
    companyId: string,
    query: PaginationQueryDto & { status?: string; projectId?: string },
  ): Promise<PaginatedResult<VariationOrderWithDetail>> {
    const { data, total } = await this.repository.list(companyId, query);
    return paginate(data, total, query);
  }

  /** FR-9.6 — re-pricing replaces the live item set and logs the new totals as the next revision; see the repository for why items aren't versioned the way quotation items are. */
  async addRevision(
    companyId: string,
    id: string,
    actorUserId: string,
    dto: CreateVoRevisionDto,
  ): Promise<VariationOrderWithDetail> {
    const existing = await this.findOne(companyId, id);
    if (!EDITABLE_STATUSES.includes(existing.status as VariationOrderStatus)) {
      throw new ForbiddenException(
        `A variation order in '${existing.status}' status cannot be revised. Allowed from: ${EDITABLE_STATUSES.join(', ')}.`,
      );
    }

    const { costImpact, revenueImpact } = sumImpacts(dto.items);
    const nextRevisionNumber = (existing.revisions[0]?.revisionNumber ?? 0) + 1;

    const updated = await this.repository.addRevision(
      companyId,
      id,
      nextRevisionNumber,
      toRepositoryItems(dto.items),
      costImpact,
      revenueImpact,
      dto.notes,
      actorUserId,
    );

    await this.audit.record({
      companyId,
      actorUserId,
      action: 'create',
      entityType: 'variation_order_revision',
      entityId: id,
      after: { revisionNumber: nextRevisionNumber, costImpact, revenueImpact },
    });
    return updated;
  }

  /** FR-9.2 — internal approval only; see decide() for why cost commits here but revenue waits for client sign-off. */
  async submitForApproval(companyId: string, id: string, actorUserId: string): Promise<VariationOrderWithDetail> {
    const vo = await this.findOne(companyId, id);
    if (vo.status !== 'draft') {
      throw new ForbiddenException('Only a draft variation order can be submitted for approval.');
    }

    const claimed = await this.repository.tryTransitionStatus(companyId, id, 'draft', 'pending_approval');
    if (!claimed) {
      throw new ForbiddenException('This variation order was already submitted for approval by someone else.');
    }

    const request = await this.approval.start({
      companyId,
      module: 'variation_order',
      entityType: 'variation_order',
      entityId: id,
      amount: Math.abs(Number(vo.costImpact)),
    });

    if (request.status === 'approved') {
      await this.approveInternally(companyId, id, actorUserId);
    }

    await this.audit.record({
      companyId,
      actorUserId,
      action: 'submit_for_approval',
      entityType: 'variation_order',
      entityId: id,
      after: { status: request.status === 'approved' ? 'approved' : 'pending_approval' },
    });
    return this.findOne(companyId, id);
  }

  /**
   * Internal approve/reject only (FR-9.2's other half — client
   * sign-off — is `recordClientSignOff` below). Approving commits the
   * VO's cost impact to the project's cost ledger immediately, because
   * the company incurs that cost once it authorizes the work
   * regardless of whether the client has agreed to pay for it yet.
   * Revenue impact is deliberately NOT applied to the project's
   * contract value here — see recordClientSignOff for why that waits.
   */
  async decide(
    companyId: string,
    id: string,
    actorUserId: string,
    decision: 'approved' | 'rejected',
    comments?: string,
  ): Promise<VariationOrderWithDetail> {
    const vo = await this.findOne(companyId, id);
    if (vo.status !== 'pending_approval') {
      throw new ForbiddenException('This variation order is not awaiting approval.');
    }

    const openRequest = await this.approval.getOpenRequestForEntity(companyId, 'variation_order', id);
    if (!openRequest) {
      throw new BadRequestException('No open approval request found for this variation order.');
    }

    const result = await this.approval.decide({
      companyId,
      approvalRequestId: openRequest.id,
      actorUserId,
      decision,
      comments,
    });

    if (result.status === 'approved') {
      await this.approveInternally(companyId, id, actorUserId);
    } else if (result.status === 'rejected') {
      await this.repository.updateStatus(companyId, id, 'rejected');
    }
    return this.findOne(companyId, id);
  }

  /**
   * FR-9.2 — the client-facing half of approval. No client portal
   * exists yet (module 14/portal_accounts aren't wired up), so this is
   * recorded by internal staff confirming the client has signed off
   * out of band (email, physical signature, etc.) — same pattern as
   * SiteReports recording what happened on site rather than the client
   * submitting it themselves.
   *
   * This is where revenue impact actually lands on the project's
   * contract value — only once the client has contractually agreed to
   * pay for it, not at internal approval, which only authorizes the
   * work and its cost.
   */
  async recordClientSignOff(companyId: string, id: string, actorUserId: string): Promise<VariationOrderWithDetail> {
    const vo = await this.findOne(companyId, id);
    if (vo.status !== 'approved' && vo.status !== 'client_signoff_pending') {
      throw new ForbiddenException(
        `A variation order in '${vo.status}' status cannot record client sign-off. It must be internally approved first.`,
      );
    }

    const claimed = await this.repository.tryTransitionStatus(
      companyId,
      id,
      vo.status as VariationOrderStatus,
      'client_approved',
    );
    if (!claimed) {
      throw new ForbiddenException('This variation order was already updated by someone else — refresh and check its current status.');
    }

    const revenueImpact = Number(vo.revenueImpact);
    if (revenueImpact !== 0) {
      await this.projects.incrementContractValue(companyId, vo.projectId, revenueImpact);
    }

    await this.audit.record({
      companyId,
      actorUserId,
      action: 'client_sign_off',
      entityType: 'variation_order',
      entityId: id,
      after: { status: 'client_approved', contractValueDelta: revenueImpact },
    });
    return this.findOne(companyId, id);
  }

  /** FR-9.2 — an internal alternative to immediate sign-off: marks that the VO has been sent to the client and is awaiting their confirmation. */
  async requestClientSignOff(companyId: string, id: string, actorUserId: string): Promise<VariationOrderWithDetail> {
    const vo = await this.findOne(companyId, id);
    if (vo.status !== 'approved') {
      throw new ForbiddenException('Only an internally-approved variation order can be sent for client sign-off.');
    }
    await this.repository.updateStatus(companyId, id, 'client_signoff_pending');
    await this.audit.record({
      companyId,
      actorUserId,
      action: 'request_client_sign_off',
      entityType: 'variation_order',
      entityId: id,
    });
    return this.findOne(companyId, id);
  }

  private async approveInternally(companyId: string, id: string, actorUserId: string): Promise<void> {
    await this.repository.updateStatus(companyId, id, 'approved', { approvedBy: actorUserId, approvedAt: new Date() });
    const vo = await this.findOne(companyId, id);
    await this.recordCommittedCost(companyId, vo);
  }

  private async recordCommittedCost(companyId: string, vo: VariationOrderWithDetail): Promise<void> {
    const totals = new Map<CostCategory, number>();
    for (const item of vo.items) {
      const category = item.costCategory as CostCategory;
      const quantity = Number(item.quantity ?? 0);
      const unitCost = Number(item.unitCost ?? 0);
      totals.set(category, (totals.get(category) ?? 0) + quantity * unitCost);
    }
    for (const [costCategory, amount] of totals) {
      await this.costing.record({
        companyId,
        projectId: vo.projectId,
        costCategory,
        transactionType: 'committed',
        sourceType: 'variation_order',
        sourceId: vo.id,
        amount: round2(amount),
      });
    }
  }
}
