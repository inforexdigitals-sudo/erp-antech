import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ApprovalService } from '../../common/approval/approval.service';
import { AuditService } from '../../common/audit/audit.service';
import { PaginatedResult, PaginationQueryDto, paginate } from '../../common/dto/pagination.dto';
import { DocumentNumberingService } from '../../common/numbering/document-numbering.service';
import { ProjectsRepository } from '../projects/projects.repository';
import { CreateMaterialRequestDto } from './dto/create-material-request.dto';
import { MaterialRequestWithDetail, MaterialRequestsRepository } from './material-requests.repository';

@Injectable()
export class MaterialRequestsService {
  constructor(
    private readonly repository: MaterialRequestsRepository,
    private readonly projects: ProjectsRepository,
    private readonly numbering: DocumentNumberingService,
    private readonly approval: ApprovalService,
    private readonly audit: AuditService,
  ) {}

  async create(companyId: string, actorUserId: string, dto: CreateMaterialRequestDto): Promise<MaterialRequestWithDetail> {
    const project = await this.projects.findById(companyId, dto.projectId);
    if (!project) {
      throw new BadRequestException('Project not found.');
    }

    const requestNumber = await this.numbering.allocate(companyId, 'material_request');
    const request = await this.repository.create({
      companyId,
      projectId: dto.projectId,
      requestNumber,
      requestedBy: actorUserId,
      neededByDate: dto.neededByDate ? new Date(dto.neededByDate) : undefined,
      notes: dto.notes,
      items: dto.items,
    });

    await this.audit.record({
      companyId,
      actorUserId,
      action: 'create',
      entityType: 'material_request',
      entityId: request.id,
      after: request,
    });
    return request;
  }

  async findOne(companyId: string, id: string): Promise<MaterialRequestWithDetail> {
    const request = await this.repository.findById(companyId, id);
    if (!request) {
      throw new NotFoundException('Material request not found.');
    }
    return request;
  }

  async list(
    companyId: string,
    query: PaginationQueryDto & { status?: string; projectId?: string },
  ): Promise<PaginatedResult<MaterialRequestWithDetail>> {
    const { data, total } = await this.repository.list(companyId, query);
    return paginate(data, total, query);
  }

  /** FR-6.4 — a procurement decision, distinct from PO approval (a separate financial-commitment decision made later). */
  async submitForApproval(companyId: string, id: string, actorUserId: string): Promise<MaterialRequestWithDetail> {
    const request = await this.findOne(companyId, id);
    if (request.status !== 'draft') {
      throw new ForbiddenException('Only a draft material request can be submitted for approval.');
    }

    const claimed = await this.repository.tryTransitionStatus(companyId, id, 'draft', 'submitted');
    if (!claimed) {
      throw new ForbiddenException('This material request was already submitted by someone else.');
    }

    const approvalRequest = await this.approval.start({
      companyId,
      module: 'purchase_request',
      entityType: 'material_request',
      entityId: id,
    });

    if (approvalRequest.status === 'approved') {
      await this.repository.updateStatus(companyId, id, 'approved', { approvedBy: actorUserId, approvedAt: new Date() });
    } else {
      // Plain update, not tryTransitionStatus — see ClaimsService.submitForApproval for why
      // this transition is provably race-free at this point.
      await this.repository.updateStatus(companyId, id, 'under_review');
    }

    await this.audit.record({
      companyId,
      actorUserId,
      action: 'submit_for_approval',
      entityType: 'material_request',
      entityId: id,
    });
    return this.findOne(companyId, id);
  }

  async decide(
    companyId: string,
    id: string,
    actorUserId: string,
    decision: 'approved' | 'rejected',
    comments?: string,
  ): Promise<MaterialRequestWithDetail> {
    const request = await this.findOne(companyId, id);
    if (request.status !== 'under_review') {
      throw new ForbiddenException('This material request is not awaiting review.');
    }

    const openRequest = await this.approval.getOpenRequestForEntity(companyId, 'material_request', id);
    if (!openRequest) {
      throw new BadRequestException('No open approval request found for this material request.');
    }

    const result = await this.approval.decide({ companyId, approvalRequestId: openRequest.id, actorUserId, decision, comments });

    if (result.status === 'approved') {
      await this.repository.updateStatus(companyId, id, 'approved', { approvedBy: actorUserId, approvedAt: new Date() });
    } else if (result.status === 'rejected') {
      await this.repository.updateStatus(companyId, id, 'rejected');
    }
    return this.findOne(companyId, id);
  }
}
