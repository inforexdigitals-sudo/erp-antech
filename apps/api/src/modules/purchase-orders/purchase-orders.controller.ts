import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { PERMISSIONS } from '../../common/constants/permissions';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { DecisionDto } from '../../common/dto/decision.dto';
import { AuthenticatedUser } from '../../common/types/auth.types';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { QueryPurchaseOrdersDto } from './dto/query-purchase-orders.dto';
import { PurchaseOrderPdfService } from './purchase-order-pdf.service';
import { PurchaseOrdersService } from './purchase-orders.service';

@ApiTags('purchase-orders')
@Controller('purchase-orders')
export class PurchaseOrdersController {
  constructor(
    private readonly purchaseOrders: PurchaseOrdersService,
    private readonly purchaseOrderPdf: PurchaseOrderPdfService,
  ) {}

  @Get()
  @RequirePermission(PERMISSIONS.PURCHASE_ORDER_VIEW)
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryPurchaseOrdersDto) {
    return this.purchaseOrders.list(user.companyId, query);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.PURCHASE_ORDER_VIEW)
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.purchaseOrders.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermission(PERMISSIONS.PURCHASE_ORDER_CREATE)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePurchaseOrderDto) {
    return this.purchaseOrders.create(user.companyId, user.userId, dto);
  }

  @Post(':id/submit-for-approval')
  @RequirePermission(PERMISSIONS.PURCHASE_ORDER_EDIT)
  submitForApproval(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.purchaseOrders.submitForApproval(user.companyId, id, user.userId);
  }

  @Post(':id/approve')
  @RequirePermission(PERMISSIONS.PURCHASE_ORDER_APPROVE)
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecisionDto,
  ) {
    return this.purchaseOrders.decide(user.companyId, id, user.userId, 'approved', dto.comments);
  }

  @Post(':id/reject')
  @RequirePermission(PERMISSIONS.PURCHASE_ORDER_APPROVE)
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecisionDto,
  ) {
    return this.purchaseOrders.decide(user.companyId, id, user.userId, 'rejected', dto.comments);
  }

  @Post(':id/issue')
  @RequirePermission(PERMISSIONS.PURCHASE_ORDER_EDIT)
  issue(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.purchaseOrders.issue(user.companyId, id, user.userId);
  }

  /** Only draft/pending-approval POs — see PurchaseOrdersService.cancel for why an approved PO can't be cancelled yet. */
  @Post(':id/cancel')
  @RequirePermission(PERMISSIONS.PURCHASE_ORDER_EDIT)
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecisionDto,
  ) {
    return this.purchaseOrders.cancel(user.companyId, id, user.userId, dto.comments);
  }

  @Post(':id/deliveries')
  @RequirePermission(PERMISSIONS.PURCHASE_ORDER_EDIT)
  recordDelivery(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateDeliveryDto,
  ) {
    return this.purchaseOrders.recordDelivery(user.companyId, id, user.userId, dto);
  }

  /** Full manual @Res() — see QuotationsController.downloadPdf for why passthrough mode isn't used. */
  @Get(':id/pdf')
  @RequirePermission(PERMISSIONS.PURCHASE_ORDER_EXPORT)
  async downloadPdf(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, filename } = await this.purchaseOrderPdf.generate(user.companyId, id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.send(buffer);
  }
}
