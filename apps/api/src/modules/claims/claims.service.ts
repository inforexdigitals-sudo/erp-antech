import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ApprovalService } from '../../common/approval/approval.service';
import { AuditService } from '../../common/audit/audit.service';
import { PaginatedResult, PaginationQueryDto, paginate } from '../../common/dto/pagination.dto';
import { DocumentNumberingService } from '../../common/numbering/document-numbering.service';
import { CustomersRepository } from '../crm/customers.repository';
import { CostingService } from '../project-costing/project-costing.service';
import { ProjectsRepository } from '../projects/projects.repository';
import { SubcontractorsRepository } from '../subcontractors/subcontractors.repository';
import { ClaimItemInput, ClaimWithDetail, ClaimsRepository } from './claims.repository';
import { ClaimItemInputDto } from './dto/claim-item-input.dto';
import { CreateClaimDto } from './dto/create-claim.dto';

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

@Injectable()
export class ClaimsService {
  constructor(
    private readonly repository: ClaimsRepository,
    private readonly projects: ProjectsRepository,
    private readonly customers: CustomersRepository,
    private readonly subcontractors: SubcontractorsRepository,
    private readonly numbering: DocumentNumberingService,
    private readonly approval: ApprovalService,
    private readonly costing: CostingService,
    private readonly audit: AuditService,
  ) {}

  /** FR-8.1/8.2/8.3/8.6 — validates claim_type's exactly-one-of customer/subcontractor CHECK, computes running claimed-to-date totals per BOQ line, and retention. */
  async create(companyId: string, actorUserId: string, dto: CreateClaimDto): Promise<ClaimWithDetail> {
    const project = await this.projects.findById(companyId, dto.projectId);
    if (!project) {
      throw new BadRequestException('Project not found.');
    }
    if (new Date(dto.claimPeriodEnd) < new Date(dto.claimPeriodStart)) {
      throw new BadRequestException('claimPeriodEnd cannot be before claimPeriodStart.');
    }
    await this.validateClaimant(companyId, dto);

    const items = await this.buildItems(companyId, dto.projectId, dto.items);
    const claimAmount = round2(items.reduce((sum, item) => sum + item.amount, 0));
    const retentionPercent = dto.retentionPercent ?? 0;
    const retentionAmount = round2(claimAmount * (retentionPercent / 100));
    const netClaimAmount = round2(claimAmount - retentionAmount);
    const claimNumber = await this.numbering.allocate(companyId, 'claim');

    const claim = await this.repository.create({
      companyId,
      projectId: dto.projectId,
      claimNumber,
      claimType: dto.claimType,
      customerId: dto.claimType === 'client' ? dto.customerId : undefined,
      subcontractorId: dto.claimType === 'subcontractor' ? dto.subcontractorId : undefined,
      claimPeriodStart: new Date(dto.claimPeriodStart),
      claimPeriodEnd: new Date(dto.claimPeriodEnd),
      cumulativePercentComplete: dto.cumulativePercentComplete,
      claimAmount,
      retentionPercent,
      retentionAmount,
      netClaimAmount,
      submittedBy: actorUserId,
      items,
    });

    await this.audit.record({ companyId, actorUserId, action: 'create', entityType: 'claim', entityId: claim.id, after: claim });
    return claim;
  }

  async findOne(companyId: string, id: string): Promise<ClaimWithDetail> {
    const claim = await this.repository.findById(companyId, id);
    if (!claim) {
      throw new NotFoundException('Claim not found.');
    }
    return claim;
  }

  async list(
    companyId: string,
    query: PaginationQueryDto & { status?: string; projectId?: string },
  ): Promise<PaginatedResult<ClaimWithDetail>> {
    const { data, total } = await this.repository.list(companyId, query);
    return paginate(data, total, query);
  }

  /** FR-8.2 — "routed for QS review": opens the generic approval workflow for module 'claim'. */
  async submitForApproval(companyId: string, id: string, actorUserId: string): Promise<ClaimWithDetail> {
    const claim = await this.findOne(companyId, id);
    if (claim.status !== 'draft') {
      throw new ForbiddenException('Only a draft claim can be submitted for approval.');
    }

    const claimed = await this.repository.tryTransitionStatus(companyId, id, 'draft', 'submitted');
    if (!claimed) {
      throw new ForbiddenException('This claim was already submitted by someone else.');
    }

    const request = await this.approval.start({
      companyId,
      module: 'claim',
      entityType: 'claim',
      entityId: id,
      amount: Number(claim.netClaimAmount),
    });

    if (request.status === 'approved') {
      await this.certify(companyId, id, actorUserId);
    } else {
      // Plain update, not tryTransitionStatus: nothing else can move a
      // claim off 'submitted' between the atomic claim above and here
      // — we're the only caller that could have reached this line.
      await this.repository.updateStatus(companyId, id, 'under_review');
    }

    await this.audit.record({
      companyId,
      actorUserId,
      action: 'submit_for_approval',
      entityType: 'claim',
      entityId: id,
      after: { status: request.status === 'approved' ? 'certified' : 'under_review' },
    });
    return this.findOne(companyId, id);
  }

  /** FR-8.7 — certifying commits the payment certificate; a certified subcontractor claim also records its actual cost (see certify()). */
  async decide(
    companyId: string,
    id: string,
    actorUserId: string,
    decision: 'approved' | 'rejected',
    comments?: string,
  ): Promise<ClaimWithDetail> {
    const claim = await this.findOne(companyId, id);
    if (claim.status !== 'under_review') {
      throw new ForbiddenException('This claim is not awaiting review.');
    }

    const openRequest = await this.approval.getOpenRequestForEntity(companyId, 'claim', id);
    if (!openRequest) {
      throw new BadRequestException('No open approval request found for this claim.');
    }

    const result = await this.approval.decide({ companyId, approvalRequestId: openRequest.id, actorUserId, decision, comments });

    if (result.status === 'approved') {
      await this.certify(companyId, id, actorUserId);
    } else if (result.status === 'rejected') {
      await this.repository.updateStatus(companyId, id, 'rejected');
    }
    return this.findOne(companyId, id);
  }

  /** Invoked by the Invoices module once the linked invoice is fully paid — see InvoicesService. */
  async markPaid(companyId: string, id: string): Promise<void> {
    const claimed = await this.repository.tryTransitionStatus(companyId, id, 'certified', 'paid');
    if (!claimed) {
      throw new ForbiddenException('Only a certified claim can be marked paid.');
    }
  }

  /**
   * Only ever reached once per claim: from submitForApproval() when
   * approval.start() auto-approves (guarded by that method's own
   * draft->submitted atomic claim, so only one concurrent submitter
   * wins), or from decide() when approval.decide() returns 'approved'
   * (itself atomic — see ApprovalService.decide()). No extra
   * tryTransitionStatus guard is needed here as a result — same
   * reasoning as VariationOrdersService.approveInternally().
   */
  private async certify(companyId: string, id: string, actorUserId: string): Promise<void> {
    await this.repository.updateStatus(companyId, id, 'certified', { certifiedBy: actorUserId, certifiedAt: new Date() });

    const claim = await this.findOne(companyId, id);

    // Certificate number is derived from the claim's own number (no
    // 'payment_certificate' entry exists in document_numbering_sequences'
    // CHECK constraint — see db/migrations/0001 — so this avoids
    // inventing a parallel numbering sequence for it).
    await this.repository.createPaymentCertificate(id, `CERT-${claim.claimNumber}`, Number(claim.netClaimAmount));

    if (Number(claim.retentionAmount) > 0) {
      await this.repository.createRetentionRecord(claim.projectId, id, Number(claim.retentionAmount));
    }

    // Client claims are revenue (billed via the Invoices module once
    // that batch lands); only subcontractor claims represent a project
    // cost, so only they hit the cost ledger — as 'actual', since a
    // certified claim reflects verified work done, not a mere
    // commitment.
    if (claim.claimType === 'subcontractor') {
      await this.costing.record({
        companyId,
        projectId: claim.projectId,
        costCategory: 'subcontractor',
        transactionType: 'actual',
        sourceType: 'subcontractor_claim',
        sourceId: claim.id,
        amount: Number(claim.claimAmount),
      });
    }

    await this.audit.record({
      companyId,
      actorUserId,
      action: 'certify',
      entityType: 'claim',
      entityId: id,
      after: { status: 'certified', netClaimAmount: claim.netClaimAmount },
    });
  }

  private async validateClaimant(companyId: string, dto: CreateClaimDto): Promise<void> {
    if (dto.claimType === 'client') {
      if (!dto.customerId || dto.subcontractorId) {
        throw new BadRequestException('A client claim requires customerId and must not set subcontractorId.');
      }
      const customer = await this.customers.findById(companyId, dto.customerId);
      if (!customer) {
        throw new BadRequestException('Customer not found.');
      }
    } else {
      if (!dto.subcontractorId || dto.customerId) {
        throw new BadRequestException('A subcontractor claim requires subcontractorId and must not set customerId.');
      }
      const subcontractor = await this.subcontractors.findById(companyId, dto.subcontractorId);
      if (!subcontractor) {
        throw new BadRequestException('Subcontractor not found.');
      }
    }
  }

  /**
   * The 100%-cumulative guard below only checks against the last
   * *certified* claim (getPreviousCumulativePercents), by design — a
   * draft/under_review claim shouldn't block a different draft from
   * being prepared concurrently. That leaves a real gap: two draft
   * claims covering overlapping percentages on the same BOQ line can
   * each individually pass this check, and nothing re-validates the
   * cap at certify() time. Preventing that needs either a serialized
   * certify path per project or a re-check against the then-current
   * certified total at certify() — neither is built here; flagged
   * rather than silently assumed safe.
   */
  private async buildItems(companyId: string, projectId: string, inputs: ClaimItemInputDto[]): Promise<ClaimItemInput[]> {
    const quotationItemIds = inputs.map((item) => item.quotationItemId).filter((id): id is string => !!id);
    const previousPercents = await this.repository.getPreviousCumulativePercents(companyId, projectId, quotationItemIds);

    return inputs.map((item) => {
      const previousPercent = item.quotationItemId ? (previousPercents.get(item.quotationItemId) ?? 0) : 0;
      const cumulativePercent = previousPercent + item.currentPercent;
      if (item.quotationItemId && cumulativePercent > 100) {
        throw new BadRequestException(
          `Line "${item.description}" would reach ${cumulativePercent}% cumulative — cannot exceed 100%.`,
        );
      }
      return {
        quotationItemId: item.quotationItemId,
        description: item.description,
        contractQuantity: item.contractQuantity,
        previousPercent,
        currentPercent: item.currentPercent,
        cumulativePercent,
        amount: round2(item.amount),
      };
    });
  }
}
