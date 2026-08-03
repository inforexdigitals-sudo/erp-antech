import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/constants/permissions';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { DecisionDto } from '../../common/dto/decision.dto';
import { AuthenticatedUser } from '../../common/types/auth.types';
import { CreateVariationOrderDto } from './dto/create-variation-order.dto';
import { CreateVoRevisionDto } from './dto/create-vo-revision.dto';
import { QueryVariationOrdersDto } from './dto/query-variation-orders.dto';
import { VariationOrdersService } from './variation-orders.service';

@ApiTags('variation-orders')
@Controller('variation-orders')
export class VariationOrdersController {
  constructor(private readonly variationOrders: VariationOrdersService) {}

  @Get()
  @RequirePermission(PERMISSIONS.VARIATION_ORDER_VIEW)
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryVariationOrdersDto) {
    return this.variationOrders.list(user.companyId, query);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.VARIATION_ORDER_VIEW)
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.variationOrders.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermission(PERMISSIONS.VARIATION_ORDER_CREATE)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateVariationOrderDto) {
    return this.variationOrders.create(user.companyId, user.userId, dto);
  }

  @Post(':id/revisions')
  @RequirePermission(PERMISSIONS.VARIATION_ORDER_EDIT)
  addRevision(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateVoRevisionDto,
  ) {
    return this.variationOrders.addRevision(user.companyId, id, user.userId, dto);
  }

  @Post(':id/submit-for-approval')
  @RequirePermission(PERMISSIONS.VARIATION_ORDER_EDIT)
  submitForApproval(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.variationOrders.submitForApproval(user.companyId, id, user.userId);
  }

  @Post(':id/approve')
  @RequirePermission(PERMISSIONS.VARIATION_ORDER_APPROVE)
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecisionDto,
  ) {
    return this.variationOrders.decide(user.companyId, id, user.userId, 'approved', dto.comments);
  }

  @Post(':id/reject')
  @RequirePermission(PERMISSIONS.VARIATION_ORDER_APPROVE)
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecisionDto,
  ) {
    return this.variationOrders.decide(user.companyId, id, user.userId, 'rejected', dto.comments);
  }

  @Post(':id/request-client-signoff')
  @RequirePermission(PERMISSIONS.VARIATION_ORDER_EDIT)
  requestClientSignOff(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.variationOrders.requestClientSignOff(user.companyId, id, user.userId);
  }

  @Post(':id/client-signoff')
  @RequirePermission(PERMISSIONS.VARIATION_ORDER_APPROVE)
  recordClientSignOff(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.variationOrders.recordClientSignOff(user.companyId, id, user.userId);
  }
}
