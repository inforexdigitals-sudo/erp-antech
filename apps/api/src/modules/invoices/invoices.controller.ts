import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { PERMISSIONS } from '../../common/constants/permissions';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AuthenticatedUser } from '../../common/types/auth.types';
import { CreateInvoiceFromClaimDto } from './dto/create-invoice-from-claim.dto';
import { QueryInvoicesDto } from './dto/query-invoices.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { InvoicePdfService } from './invoice-pdf.service';
import { InvoicesService } from './invoices.service';

@ApiTags('invoices')
@Controller()
export class InvoicesController {
  constructor(
    private readonly invoices: InvoicesService,
    private readonly invoicePdf: InvoicePdfService,
  ) {}

  @Get('invoices')
  @RequirePermission(PERMISSIONS.ACCOUNTING_VIEW)
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryInvoicesDto) {
    return this.invoices.list(user.companyId, query);
  }

  @Get('invoices/:id')
  @RequirePermission(PERMISSIONS.ACCOUNTING_VIEW)
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.invoices.findOne(user.companyId, id);
  }

  @Post('claims/:claimId/invoice')
  @RequirePermission(PERMISSIONS.ACCOUNTING_EDIT)
  createFromClaim(
    @CurrentUser() user: AuthenticatedUser,
    @Param('claimId', ParseUUIDPipe) claimId: string,
    @Body() dto: CreateInvoiceFromClaimDto,
  ) {
    return this.invoices.createFromClaim(user.companyId, user.userId, claimId, dto);
  }

  @Patch('invoices/:id')
  @RequirePermission(PERMISSIONS.ACCOUNTING_EDIT)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInvoiceDto,
  ) {
    return this.invoices.update(user.companyId, id, user.userId, dto);
  }

  @Post('invoices/:id/send')
  @RequirePermission(PERMISSIONS.ACCOUNTING_EDIT)
  send(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.invoices.send(user.companyId, id, user.userId);
  }

  @Post('invoices/:id/void')
  @RequirePermission(PERMISSIONS.ACCOUNTING_EDIT)
  voidInvoice(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.invoices.void(user.companyId, id, user.userId);
  }

  @Post('invoices/:id/payments')
  @RequirePermission(PERMISSIONS.ACCOUNTING_EDIT)
  recordPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordPaymentDto,
  ) {
    return this.invoices.recordPayment(user.companyId, id, user.userId, dto);
  }

  /** Full manual @Res() — see QuotationsController.downloadPdf for why passthrough mode isn't used. */
  @Get('invoices/:id/pdf')
  @RequirePermission(PERMISSIONS.ACCOUNTING_EXPORT)
  async downloadPdf(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, filename } = await this.invoicePdf.generate(user.companyId, id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.send(buffer);
  }
}
