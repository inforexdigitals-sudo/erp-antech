import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/constants/permissions';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { DecisionDto } from '../../common/dto/decision.dto';
import { AuthenticatedUser } from '../../common/types/auth.types';
import { CreateMaterialRequestDto } from './dto/create-material-request.dto';
import { QueryMaterialRequestsDto } from './dto/query-material-requests.dto';
import { MaterialRequestsService } from './material-requests.service';

@ApiTags('material-requests')
@Controller('material-requests')
export class MaterialRequestsController {
  constructor(private readonly materialRequests: MaterialRequestsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.PROCUREMENT_VIEW)
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryMaterialRequestsDto) {
    return this.materialRequests.list(user.companyId, query);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.PROCUREMENT_VIEW)
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.materialRequests.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermission(PERMISSIONS.PROCUREMENT_CREATE)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateMaterialRequestDto) {
    return this.materialRequests.create(user.companyId, user.userId, dto);
  }

  @Post(':id/submit-for-approval')
  @RequirePermission(PERMISSIONS.PROCUREMENT_EDIT)
  submitForApproval(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.materialRequests.submitForApproval(user.companyId, id, user.userId);
  }

  @Post(':id/approve')
  @RequirePermission(PERMISSIONS.PROCUREMENT_APPROVE)
  approve(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DecisionDto) {
    return this.materialRequests.decide(user.companyId, id, user.userId, 'approved', dto.comments);
  }

  @Post(':id/reject')
  @RequirePermission(PERMISSIONS.PROCUREMENT_APPROVE)
  reject(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DecisionDto) {
    return this.materialRequests.decide(user.companyId, id, user.userId, 'rejected', dto.comments);
  }
}
