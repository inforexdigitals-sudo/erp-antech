import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/constants/permissions';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AuthenticatedUser } from '../../common/types/auth.types';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { CreateManualBudgetDto } from './dto/create-manual-budget.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { CostingService } from './project-costing.service';

/**
 * Mounted under the same `projects/:projectId` path as ProjectsController
 * but kept as its own controller/module — Project Costing (module 10) has
 * its own permission codes (costing.*, distinct from project.*) and its
 * own service boundary, even though the URLs read as one nested resource.
 */
@ApiTags('project-costing')
@Controller('projects/:projectId')
export class ProjectCostingController {
  constructor(private readonly costing: CostingService) {}

  @Get('budget')
  @RequirePermission(PERMISSIONS.COSTING_VIEW)
  getBudget(@CurrentUser() user: AuthenticatedUser, @Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.costing.getBudget(user.companyId, projectId);
  }

  @Post('budget/from-quotation')
  @RequirePermission(PERMISSIONS.COSTING_EDIT)
  initializeFromQuotation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.costing.initializeBudgetFromQuotation(user.companyId, projectId);
  }

  @Post('budget/manual')
  @RequirePermission(PERMISSIONS.COSTING_EDIT)
  createManualBudget(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateManualBudgetDto,
  ) {
    return this.costing.createManualBudget(user.companyId, projectId, dto);
  }

  @Get('costing')
  @RequirePermission(PERMISSIONS.COSTING_VIEW)
  getDashboard(@CurrentUser() user: AuthenticatedUser, @Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.costing.getDashboard(user.companyId, projectId);
  }

  @Get('expenses')
  @RequirePermission(PERMISSIONS.COSTING_VIEW)
  listExpenses(@CurrentUser() user: AuthenticatedUser, @Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.costing.listExpenses(user.companyId, projectId);
  }

  @Post('expenses')
  @RequirePermission(PERMISSIONS.COSTING_EDIT)
  recordExpense(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateExpenseDto,
  ) {
    return this.costing.recordExpense(user.companyId, projectId, user.userId, dto);
  }

  @Patch('expenses/:expenseId')
  @RequirePermission(PERMISSIONS.COSTING_EDIT)
  updateExpense(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('expenseId', ParseUUIDPipe) expenseId: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.costing.updateExpense(user.companyId, projectId, expenseId, dto);
  }

  @Delete('expenses/:expenseId')
  @RequirePermission(PERMISSIONS.COSTING_EDIT)
  removeExpense(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('expenseId', ParseUUIDPipe) expenseId: string,
  ) {
    return this.costing.removeExpense(user.companyId, projectId, expenseId);
  }
}
