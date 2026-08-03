import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ProjectIssue, ProjectMilestone, ProjectTask, ProjectTeamMember, SiteReport } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { PaginatedResult, PaginationQueryDto, paginate } from '../../common/dto/pagination.dto';
import { CustomersRepository } from '../crm/customers.repository';
import { AddTeamMemberDto } from './dto/add-team-member.dto';
import { CreateIssueDto, UpdateIssueDto } from './dto/issue.dto';
import { CreateMilestoneDto, UpdateMilestoneDto } from './dto/milestone.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { CreateSiteReportDto } from './dto/create-site-report.dto';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectWithDetail, ProjectsRepository } from './projects.repository';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly repository: ProjectsRepository,
    private readonly customers: CustomersRepository,
    private readonly audit: AuditService,
  ) {}

  async create(companyId: string, actorUserId: string, dto: CreateProjectDto): Promise<ProjectWithDetail> {
    const customer = await this.customers.findById(companyId, dto.customerId);
    if (!customer) {
      throw new BadRequestException('Customer not found.');
    }

    const project = await this.repository.create({ companyId, ...dto });

    await this.audit.record({
      companyId,
      actorUserId,
      action: 'create',
      entityType: 'project',
      entityId: project.id,
      after: project,
    });

    return this.findOne(companyId, project.id);
  }

  async findOne(companyId: string, id: string): Promise<ProjectWithDetail> {
    const project = await this.repository.findDetailById(companyId, id);
    if (!project) {
      throw new NotFoundException('Project not found.');
    }
    return project;
  }

  async list(
    companyId: string,
    query: PaginationQueryDto & { status?: string; customerId?: string },
  ): Promise<PaginatedResult<ProjectWithDetail>> {
    const { data, total } = await this.repository.list(companyId, query);
    return paginate(data, total, query);
  }

  async update(companyId: string, id: string, actorUserId: string, dto: UpdateProjectDto): Promise<ProjectWithDetail> {
    const existing = await this.findOne(companyId, id);

    await this.repository.update(companyId, id, {
      name: dto.name,
      projectManagerId: dto.projectManagerId,
      status: dto.status,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      plannedEndDate: dto.plannedEndDate ? new Date(dto.plannedEndDate) : undefined,
      actualEndDate: dto.actualEndDate ? new Date(dto.actualEndDate) : undefined,
      address: dto.address,
      description: dto.description,
    });

    const updated = await this.findOne(companyId, id);
    await this.audit.record({
      companyId,
      actorUserId,
      action: 'update',
      entityType: 'project',
      entityId: id,
      before: existing,
      after: updated,
    });
    return updated;
  }

  async addTeamMember(
    companyId: string,
    projectId: string,
    actorUserId: string,
    dto: AddTeamMemberDto,
  ): Promise<ProjectTeamMember> {
    await this.findOne(companyId, projectId);
    const member = await this.repository.addTeamMember(projectId, dto.userId, dto.roleOnProject);
    await this.audit.record({
      companyId,
      actorUserId,
      action: 'create',
      entityType: 'project_team_member',
      entityId: member.id,
      after: member,
    });
    return member;
  }

  async removeTeamMember(companyId: string, projectId: string, actorUserId: string, userId: string): Promise<void> {
    await this.findOne(companyId, projectId);
    await this.repository.removeTeamMember(projectId, userId);
    await this.audit.record({
      companyId,
      actorUserId,
      action: 'delete',
      entityType: 'project_team_member',
      entityId: userId,
    });
  }

  async createMilestone(
    companyId: string,
    projectId: string,
    actorUserId: string,
    dto: CreateMilestoneDto,
  ): Promise<ProjectMilestone> {
    await this.findOne(companyId, projectId);
    const milestone = await this.repository.createMilestone(projectId, dto);
    await this.audit.record({
      companyId,
      actorUserId,
      action: 'create',
      entityType: 'project_milestone',
      entityId: milestone.id,
      after: milestone,
    });
    return milestone;
  }

  async updateMilestone(
    companyId: string,
    projectId: string,
    milestoneId: string,
    actorUserId: string,
    dto: UpdateMilestoneDto,
  ): Promise<ProjectMilestone> {
    await this.findOne(companyId, projectId);
    const existing = await this.repository.findMilestoneById(projectId, milestoneId);
    if (!existing) {
      throw new NotFoundException('Milestone not found on this project.');
    }
    const updated = await this.repository.updateMilestone(milestoneId, dto);
    await this.audit.record({
      companyId,
      actorUserId,
      action: 'update',
      entityType: 'project_milestone',
      entityId: milestoneId,
      before: existing,
      after: updated,
    });
    return updated;
  }

  async createTask(companyId: string, projectId: string, actorUserId: string, dto: CreateTaskDto): Promise<ProjectTask> {
    await this.findOne(companyId, projectId);
    if (dto.milestoneId) {
      const milestone = await this.repository.findMilestoneById(projectId, dto.milestoneId);
      if (!milestone) {
        throw new BadRequestException('Milestone does not belong to this project.');
      }
    }
    const task = await this.repository.createTask(projectId, dto);
    await this.audit.record({
      companyId,
      actorUserId,
      action: 'create',
      entityType: 'project_task',
      entityId: task.id,
      after: task,
    });
    return task;
  }

  async updateTask(
    companyId: string,
    projectId: string,
    taskId: string,
    actorUserId: string,
    dto: UpdateTaskDto,
  ): Promise<ProjectTask> {
    await this.findOne(companyId, projectId);
    const existing = await this.repository.findTaskById(projectId, taskId);
    if (!existing) {
      throw new NotFoundException('Task not found on this project.');
    }
    if (dto.milestoneId) {
      const milestone = await this.repository.findMilestoneById(projectId, dto.milestoneId);
      if (!milestone) {
        throw new BadRequestException('Milestone does not belong to this project.');
      }
    }
    const updated = await this.repository.updateTask(taskId, dto);
    await this.audit.record({
      companyId,
      actorUserId,
      action: 'update',
      entityType: 'project_task',
      entityId: taskId,
      before: existing,
      after: updated,
    });
    return updated;
  }

  async listTasks(companyId: string, projectId: string): Promise<ProjectTask[]> {
    await this.findOne(companyId, projectId);
    return this.repository.listTasks(projectId);
  }

  async createSiteReport(
    companyId: string,
    projectId: string,
    actorUserId: string,
    dto: CreateSiteReportDto,
  ): Promise<SiteReport> {
    await this.findOne(companyId, projectId);
    const report = await this.repository.createSiteReport(projectId, actorUserId, dto);
    await this.audit.record({
      companyId,
      actorUserId,
      action: 'create',
      entityType: 'site_report',
      entityId: report.id,
      after: report,
    });
    return report;
  }

  async listSiteReports(companyId: string, projectId: string): Promise<SiteReport[]> {
    await this.findOne(companyId, projectId);
    return this.repository.listSiteReports(projectId);
  }

  async createIssue(
    companyId: string,
    projectId: string,
    actorUserId: string,
    dto: CreateIssueDto,
  ): Promise<ProjectIssue> {
    await this.findOne(companyId, projectId);
    const issue = await this.repository.createIssue(projectId, actorUserId, dto);
    await this.audit.record({
      companyId,
      actorUserId,
      action: 'create',
      entityType: 'project_issue',
      entityId: issue.id,
      after: issue,
    });
    return issue;
  }

  /** Stamps/clears resolvedAt to match the status transition, so it's never left stale on a re-opened issue. */
  async updateIssue(
    companyId: string,
    projectId: string,
    issueId: string,
    actorUserId: string,
    dto: UpdateIssueDto,
  ): Promise<ProjectIssue> {
    await this.findOne(companyId, projectId);
    const existing = await this.repository.findIssueById(projectId, issueId);
    if (!existing) {
      throw new NotFoundException('Issue not found on this project.');
    }

    const isNowResolved = dto.status === 'resolved' || dto.status === 'closed';
    const isReopened = dto.status && !isNowResolved && (existing.status === 'resolved' || existing.status === 'closed');

    const updated = await this.repository.updateIssue(issueId, {
      ...dto,
      resolvedAt: isNowResolved ? new Date() : isReopened ? null : undefined,
    });

    await this.audit.record({
      companyId,
      actorUserId,
      action: 'update',
      entityType: 'project_issue',
      entityId: issueId,
      before: existing,
      after: updated,
    });
    return updated;
  }

  async listIssues(companyId: string, projectId: string): Promise<ProjectIssue[]> {
    await this.findOne(companyId, projectId);
    return this.repository.listIssues(projectId);
  }
}
