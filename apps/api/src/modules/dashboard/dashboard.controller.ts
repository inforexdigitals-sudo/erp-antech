import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/constants/permissions';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AuthenticatedUser } from '../../common/types/auth.types';
import { DashboardService } from './dashboard.service';

/**
 * Every route sits behind a single `dashboard.view` permission
 * (db/migrations/0016 seeds no per-widget permission) — FR-1.10's
 * role-awareness is a frontend concern: different roles render
 * different subsets of these same widgets, rather than the backend
 * gating each one separately.
 */
@ApiTags('dashboard')
@Controller('dashboard')
@RequirePermission(PERMISSIONS.DASHBOARD_VIEW)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('portfolio')
  getPortfolio(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.getPortfolio(user.companyId);
  }

  @Get('quotations')
  getOutstandingQuotations(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.getOutstandingQuotations(user.companyId);
  }

  @Get('my-approvals')
  getMyPendingApprovals(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.getMyPendingApprovals(user.companyId, user.userId);
  }

  @Get('procurement')
  getOpenProcurement(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.getOpenProcurement(user.companyId);
  }

  @Get('claims')
  getOutstandingClaims(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.getOutstandingClaims(user.companyId);
  }

  @Get('costing')
  getCostingRollup(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.getCostingRollup(user.companyId);
  }

  @Get('cash-flow')
  getCashFlow(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.getCashFlowApproximation(user.companyId);
  }

  @Get('attendance')
  getAttendance(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.getTodayAttendance(user.companyId);
  }

  @Get('activity')
  getActivity(@CurrentUser() user: AuthenticatedUser, @Query('limit') limit?: string) {
    const parsed = limit ? parseInt(limit, 10) : undefined;
    return this.dashboard.getRecentActivity(user.companyId, parsed && parsed > 0 ? Math.min(parsed, 100) : undefined);
  }
}
