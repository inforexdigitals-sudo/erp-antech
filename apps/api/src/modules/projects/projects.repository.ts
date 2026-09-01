import { Injectable } from '@nestjs/common';
import {
  Prisma,
  Project,
  ProjectIssue,
  ProjectMilestone,
  ProjectTask,
  ProjectTeamMember,
  SiteReport,
} from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { DocumentNumberingService } from '../../common/numbering/document-numbering.service';
import { PrismaService } from '../../database/prisma/prisma.service';

export interface CreateProjectFromQuotationParams {
  companyId: string;
  name: string;
  customerId: string;
  quotationId: string;
  contractValue: number;
}

export interface CreateProjectParams {
  companyId: string;
  name: string;
  customerId: string;
  projectManagerId?: string;
  startDate?: string;
  plannedEndDate?: string;
  contractValue: number;
  address?: string;
  description?: string;
}

const projectDetailInclude = {
  customer: { select: { id: true, name: true } },
  projectManager: { select: { id: true, fullName: true } },
  teamMembers: { include: { user: { select: { id: true, fullName: true, jobTitle: true } } } },
  milestones: { orderBy: { sortOrder: 'asc' } },
  budget: true,
} satisfies Prisma.ProjectInclude;

export type ProjectWithDetail = Prisma.ProjectGetPayload<{ include: typeof projectDetailInclude }>;

/**
 * Full Project Management module (module 4) repository — CRUD for the
 * project itself plus every sub-resource (team, milestones, tasks,
 * site reports, issues). `findById` and `createFromQuotation` are also
 * called by Quotations and Purchase Orders, so their signatures are
 * kept stable rather than folded into the richer methods below.
 */
@Injectable()
export class ProjectsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numbering: DocumentNumberingService,
  ) {}

  async findById(companyId: string, id: string): Promise<Project | null> {
    return this.prisma.project.findFirst({ where: { id, companyId } });
  }

  /** Scoped lookup for QuotationsService.remove — a Quotation converts to at most one Project (Project.quotationId is @unique). */
  async findByQuotationId(companyId: string, quotationId: string): Promise<Project | null> {
    return this.prisma.project.findFirst({ where: { quotationId, companyId } });
  }

  /**
   * Tears down a project and every real-money/real-work record attached
   * to it — used only when a converted quotation is deleted with
   * "delete it all" explicitly chosen (QuotationsService.remove).
   * Irreversible; there is no soft-delete or undo here.
   *
   * Several children have a required, non-cascading FK to Project
   * (db/migrations don't mark them onDelete: Cascade — CostTransaction,
   * PurchaseOrder, VariationOrder, TimesheetAllocation, Invoice, Claim,
   * MaterialRequest), so a plain `project.delete()` would just fail
   * with a foreign-key violation. Deleted here explicitly, in an order
   * that respects every remaining constraint:
   *  - PurchaseOrder/VariationOrder/Invoice/Claim/MaterialRequest each
   *    cascade to their own children (items, deliveries, payments,
   *    revisions, retention records) automatically once the parent row
   *    is deleted — no need to touch those tables directly.
   *  - RetentionRecord.claimId cascades from Claim, so deleting Claims
   *    removes it even though RetentionRecord.projectId itself doesn't.
   *  - PurchaseOrders are deleted before MaterialRequests, since a PO
   *    can reference one.
   *  - Everything else hanging off Project (team members, milestones,
   *    tasks, site reports + their photos/documents, issues, budget)
   *  is already onDelete: Cascade and needs no explicit handling —
   *    removed by the final `project.delete()` below.
   * ImportedFile/Rfq's optional projectId is onDelete: SetNull, so
   * those rows survive with the reference cleared, not deleted.
   *
   * Also called directly for a standalone "delete this project"
   * (ProjectsService.remove), not just via a converted quotation's
   * delete — so if this project came from a quotation, that quotation
   * is reverted to 'accepted' (the exact precondition
   * QuotationsService.convertToProject required) rather than left
   * behind claiming 'converted' with no project to show for it. A
   * harmless no-op when the caller is about to delete that same
   * quotation right after (QuotationsService.remove's converted path).
   */
  async deleteCascade(companyId: string, projectId: string): Promise<void> {
    const project = await this.prisma.project.findFirstOrThrow({
      where: { id: projectId, companyId },
      select: { quotationId: true },
    });

    await this.prisma.$transaction([
      ...(project.quotationId
        ? [this.prisma.quotation.updateMany({ where: { id: project.quotationId, companyId }, data: { status: 'accepted' } })]
        : []),
      this.prisma.costTransaction.deleteMany({ where: { projectId, companyId } }),
      this.prisma.purchaseOrder.deleteMany({ where: { projectId, companyId } }),
      this.prisma.variationOrder.deleteMany({ where: { projectId, companyId } }),
      this.prisma.timesheetAllocation.deleteMany({ where: { projectId } }),
      this.prisma.invoice.deleteMany({ where: { projectId, companyId } }),
      this.prisma.claim.deleteMany({ where: { projectId, companyId } }),
      this.prisma.materialRequest.deleteMany({ where: { projectId, companyId } }),
      this.prisma.project.delete({ where: { id: projectId, companyId } }),
    ]);
  }

  async findDetailById(companyId: string, id: string): Promise<ProjectWithDetail | null> {
    return this.prisma.project.findFirst({ where: { id, companyId }, include: projectDetailInclude });
  }

  async createFromQuotation(params: CreateProjectFromQuotationParams): Promise<Project> {
    const projectNumber = await this.numbering.allocate(params.companyId, 'project');
    return this.prisma.project.create({
      data: {
        companyId: params.companyId,
        projectNumber,
        name: params.name,
        customerId: params.customerId,
        quotationId: params.quotationId,
        contractValue: params.contractValue,
        status: 'planning',
      },
    });
  }

  async create(params: CreateProjectParams): Promise<Project> {
    const projectNumber = await this.numbering.allocate(params.companyId, 'project');
    return this.prisma.project.create({
      data: {
        companyId: params.companyId,
        projectNumber,
        name: params.name,
        customerId: params.customerId,
        projectManagerId: params.projectManagerId,
        startDate: params.startDate ? new Date(params.startDate) : undefined,
        plannedEndDate: params.plannedEndDate ? new Date(params.plannedEndDate) : undefined,
        contractValue: params.contractValue,
        address: params.address,
        description: params.description,
        status: 'planning',
      },
    });
  }

  async list(
    companyId: string,
    query: PaginationQueryDto & { status?: string; customerId?: string },
  ): Promise<{ data: ProjectWithDetail[]; total: number }> {
    const where: Prisma.ProjectWhereInput = { companyId, status: query.status, customerId: query.customerId };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        include: projectDetailInclude,
        skip: query.skip,
        take: query.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.project.count({ where }),
    ]);
    return { data, total };
  }

  async update(companyId: string, id: string, data: Prisma.ProjectUncheckedUpdateInput): Promise<Project> {
    return this.prisma.project.update({ where: { id, companyId }, data });
  }

  /**
   * Atomic — compiles to `SET contract_value = contract_value + delta`,
   * so concurrent callers (e.g. two variation orders reaching client
   * sign-off around the same time) can't clobber each other the way a
   * read-then-write update would. Used by VariationOrdersService when
   * a VO's revenue impact becomes contractually confirmed.
   */
  async incrementContractValue(companyId: string, id: string, delta: number): Promise<Project> {
    return this.prisma.project.update({
      where: { id, companyId },
      data: { contractValue: { increment: delta } },
    });
  }

  // -- Team members --------------------------------------------------

  async addTeamMember(projectId: string, userId: string, roleOnProject?: string): Promise<ProjectTeamMember> {
    return this.prisma.projectTeamMember.create({ data: { projectId, userId, roleOnProject } });
  }

  async removeTeamMember(projectId: string, userId: string): Promise<void> {
    await this.prisma.projectTeamMember.deleteMany({ where: { projectId, userId } });
  }

  // -- Milestones -------------------------------------------------------

  async createMilestone(
    projectId: string,
    data: { name: string; dueDate?: string; sortOrder?: number },
  ): Promise<ProjectMilestone> {
    return this.prisma.projectMilestone.create({
      data: {
        projectId,
        name: data.name,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        sortOrder: data.sortOrder ?? 0,
      },
    });
  }

  async findMilestoneById(projectId: string, milestoneId: string): Promise<ProjectMilestone | null> {
    return this.prisma.projectMilestone.findFirst({ where: { id: milestoneId, projectId } });
  }

  async updateMilestone(milestoneId: string, data: Prisma.ProjectMilestoneUpdateInput): Promise<ProjectMilestone> {
    return this.prisma.projectMilestone.update({ where: { id: milestoneId }, data });
  }

  // -- Tasks ------------------------------------------------------------

  async createTask(
    projectId: string,
    data: { name: string; milestoneId?: string; description?: string; assigneeUserId?: string; dueDate?: string },
  ): Promise<ProjectTask> {
    return this.prisma.projectTask.create({
      data: {
        projectId,
        name: data.name,
        milestoneId: data.milestoneId,
        description: data.description,
        assigneeUserId: data.assigneeUserId,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      },
    });
  }

  async findTaskById(projectId: string, taskId: string): Promise<ProjectTask | null> {
    return this.prisma.projectTask.findFirst({ where: { id: taskId, projectId } });
  }

  async updateTask(taskId: string, data: Prisma.ProjectTaskUncheckedUpdateInput): Promise<ProjectTask> {
    return this.prisma.projectTask.update({ where: { id: taskId }, data });
  }

  async listTasks(projectId: string): Promise<ProjectTask[]> {
    return this.prisma.projectTask.findMany({ where: { projectId }, orderBy: { createdAt: 'asc' } });
  }

  // -- Site reports -------------------------------------------------------

  async createSiteReport(
    projectId: string,
    submittedBy: string,
    data: { reportDate: string; weather?: string; manpowerCount?: number; progressSummary?: string },
  ): Promise<SiteReport> {
    return this.prisma.siteReport.create({
      data: {
        projectId,
        submittedBy,
        reportDate: new Date(data.reportDate),
        weather: data.weather,
        manpowerCount: data.manpowerCount,
        progressSummary: data.progressSummary,
      },
    });
  }

  async listSiteReports(projectId: string): Promise<SiteReport[]> {
    return this.prisma.siteReport.findMany({ where: { projectId }, orderBy: { reportDate: 'desc' } });
  }

  // -- Issues -----------------------------------------------------------

  async createIssue(
    projectId: string,
    reportedBy: string,
    data: { title: string; description?: string; severity: string; assignedTo?: string; dueDate?: string },
  ): Promise<ProjectIssue> {
    return this.prisma.projectIssue.create({
      data: {
        projectId,
        reportedBy,
        title: data.title,
        description: data.description,
        severity: data.severity,
        assignedTo: data.assignedTo,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      },
    });
  }

  async findIssueById(projectId: string, issueId: string): Promise<ProjectIssue | null> {
    return this.prisma.projectIssue.findFirst({ where: { id: issueId, projectId } });
  }

  async updateIssue(issueId: string, data: Prisma.ProjectIssueUncheckedUpdateInput): Promise<ProjectIssue> {
    return this.prisma.projectIssue.update({ where: { id: issueId }, data });
  }

  async listIssues(projectId: string): Promise<ProjectIssue[]> {
    return this.prisma.projectIssue.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } });
  }
}
