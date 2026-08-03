import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/constants/permissions';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { DecisionDto } from '../../common/dto/decision.dto';
import { AuthenticatedUser } from '../../common/types/auth.types';
import { AllocateHoursDto } from './dto/allocate-hours.dto';
import { ClockDto } from './dto/clock.dto';
import { CreateManualTimesheetDto } from './dto/create-manual-timesheet.dto';
import { QueryTimesheetsDto } from './dto/query-timesheets.dto';
import { TimesheetsService } from './timesheets.service';

@ApiTags('timesheets')
@Controller('timesheets')
export class TimesheetsController {
  constructor(private readonly timesheets: TimesheetsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.TIMESHEET_VIEW)
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryTimesheetsDto) {
    return this.timesheets.list(user.companyId, query);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.TIMESHEET_VIEW)
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.timesheets.findOne(user.companyId, id);
  }

  @Post('clock-in')
  @RequirePermission(PERMISSIONS.TIMESHEET_CREATE)
  clockIn(@CurrentUser() user: AuthenticatedUser, @Body() dto: ClockDto) {
    return this.timesheets.clockIn(user.companyId, user.userId, dto);
  }

  @Post('clock-out')
  @RequirePermission(PERMISSIONS.TIMESHEET_CREATE)
  clockOut(@CurrentUser() user: AuthenticatedUser, @Body() dto: ClockDto) {
    return this.timesheets.clockOut(user.companyId, user.userId, dto);
  }

  /** Admin/office entry — distinct (higher) permission from self-service clock-in/out. */
  @Post('manual')
  @RequirePermission(PERMISSIONS.TIMESHEET_EDIT)
  createManual(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateManualTimesheetDto) {
    return this.timesheets.createManual(user.companyId, user.userId, dto);
  }

  @Post(':id/allocations')
  @RequirePermission(PERMISSIONS.TIMESHEET_EDIT)
  allocateHours(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AllocateHoursDto,
  ) {
    return this.timesheets.allocateHours(user.companyId, id, user.userId, dto);
  }

  @Post(':id/submit-for-approval')
  @RequirePermission(PERMISSIONS.TIMESHEET_CREATE)
  submitForApproval(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.timesheets.submitForApproval(user.companyId, id, user.userId);
  }

  @Post(':id/approve')
  @RequirePermission(PERMISSIONS.TIMESHEET_APPROVE)
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecisionDto,
  ) {
    return this.timesheets.decide(user.companyId, id, user.userId, 'approved', dto.comments);
  }

  @Post(':id/reject')
  @RequirePermission(PERMISSIONS.TIMESHEET_APPROVE)
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecisionDto,
  ) {
    return this.timesheets.decide(user.companyId, id, user.userId, 'rejected', dto.comments);
  }
}
