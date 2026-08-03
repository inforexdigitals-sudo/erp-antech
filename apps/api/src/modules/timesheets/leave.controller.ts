import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/constants/permissions';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AuthenticatedUser } from '../../common/types/auth.types';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import { QueryLeaveRequestsDto } from './dto/query-leave-requests.dto';
import { LeaveService } from './leave.service';

@ApiTags('leave')
@Controller()
export class LeaveController {
  constructor(private readonly leave: LeaveService) {}

  @Get('leave-types')
  @RequirePermission(PERMISSIONS.TIMESHEET_VIEW)
  listLeaveTypes(@CurrentUser() user: AuthenticatedUser) {
    return this.leave.listLeaveTypes(user.companyId);
  }

  @Post('leave-types')
  @RequirePermission(PERMISSIONS.TIMESHEET_EDIT)
  createLeaveType(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateLeaveTypeDto) {
    return this.leave.createLeaveType(user.companyId, user.userId, dto);
  }

  @Get('leave-requests')
  @RequirePermission(PERMISSIONS.TIMESHEET_VIEW)
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryLeaveRequestsDto) {
    return this.leave.list(user.companyId, query);
  }

  @Get('leave-requests/:id')
  @RequirePermission(PERMISSIONS.TIMESHEET_VIEW)
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.leave.findOne(user.companyId, id);
  }

  @Post('leave-requests')
  @RequirePermission(PERMISSIONS.TIMESHEET_CREATE)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateLeaveRequestDto) {
    return this.leave.createLeaveRequest(user.companyId, user.userId, dto);
  }

  @Post('leave-requests/:id/approve')
  @RequirePermission(PERMISSIONS.TIMESHEET_APPROVE)
  approve(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.leave.decide(user.companyId, id, user.userId, 'approved');
  }

  @Post('leave-requests/:id/reject')
  @RequirePermission(PERMISSIONS.TIMESHEET_APPROVE)
  reject(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.leave.decide(user.companyId, id, user.userId, 'rejected');
  }
}
