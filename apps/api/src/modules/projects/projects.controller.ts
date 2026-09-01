import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/constants/permissions';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AuthenticatedUser } from '../../common/types/auth.types';
import { AddTeamMemberDto } from './dto/add-team-member.dto';
import { CreateIssueDto, UpdateIssueDto } from './dto/issue.dto';
import { CreateMilestoneDto, UpdateMilestoneDto } from './dto/milestone.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { CreateSiteReportDto } from './dto/create-site-report.dto';
import { QueryProjectsDto } from './dto/query-projects.dto';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';

@ApiTags('projects')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.PROJECT_VIEW)
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryProjectsDto) {
    return this.projects.list(user.companyId, query);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.PROJECT_VIEW)
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.projects.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermission(PERMISSIONS.PROJECT_CREATE)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateProjectDto) {
    return this.projects.create(user.companyId, user.userId, dto);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.PROJECT_EDIT)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projects.update(user.companyId, id, user.userId, dto);
  }

  @Delete(':id')
  @RequirePermission(PERMISSIONS.PROJECT_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.projects.remove(user.companyId, id, user.userId);
  }

  @Post(':id/team-members')
  @RequirePermission(PERMISSIONS.PROJECT_EDIT)
  addTeamMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddTeamMemberDto,
  ) {
    return this.projects.addTeamMember(user.companyId, id, user.userId, dto);
  }

  @Delete(':id/team-members/:userId')
  @RequirePermission(PERMISSIONS.PROJECT_EDIT)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeTeamMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.projects.removeTeamMember(user.companyId, id, user.userId, userId);
  }

  @Post(':id/milestones')
  @RequirePermission(PERMISSIONS.PROJECT_EDIT)
  createMilestone(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateMilestoneDto,
  ) {
    return this.projects.createMilestone(user.companyId, id, user.userId, dto);
  }

  @Patch(':id/milestones/:milestoneId')
  @RequirePermission(PERMISSIONS.PROJECT_EDIT)
  updateMilestone(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
    @Body() dto: UpdateMilestoneDto,
  ) {
    return this.projects.updateMilestone(user.companyId, id, milestoneId, user.userId, dto);
  }

  @Get(':id/tasks')
  @RequirePermission(PERMISSIONS.PROJECT_VIEW)
  listTasks(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.projects.listTasks(user.companyId, id);
  }

  @Post(':id/tasks')
  @RequirePermission(PERMISSIONS.PROJECT_EDIT)
  createTask(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTaskDto,
  ) {
    return this.projects.createTask(user.companyId, id, user.userId, dto);
  }

  @Patch(':id/tasks/:taskId')
  @RequirePermission(PERMISSIONS.PROJECT_EDIT)
  updateTask(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.projects.updateTask(user.companyId, id, taskId, user.userId, dto);
  }

  @Get(':id/site-reports')
  @RequirePermission(PERMISSIONS.PROJECT_VIEW)
  listSiteReports(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.projects.listSiteReports(user.companyId, id);
  }

  @Post(':id/site-reports')
  @RequirePermission(PERMISSIONS.PROJECT_EDIT)
  createSiteReport(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateSiteReportDto,
  ) {
    return this.projects.createSiteReport(user.companyId, id, user.userId, dto);
  }

  @Get(':id/issues')
  @RequirePermission(PERMISSIONS.PROJECT_VIEW)
  listIssues(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.projects.listIssues(user.companyId, id);
  }

  @Post(':id/issues')
  @RequirePermission(PERMISSIONS.PROJECT_EDIT)
  createIssue(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateIssueDto,
  ) {
    return this.projects.createIssue(user.companyId, id, user.userId, dto);
  }

  @Patch(':id/issues/:issueId')
  @RequirePermission(PERMISSIONS.PROJECT_EDIT)
  updateIssue(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('issueId', ParseUUIDPipe) issueId: string,
    @Body() dto: UpdateIssueDto,
  ) {
    return this.projects.updateIssue(user.companyId, id, issueId, user.userId, dto);
  }
}
