import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PERMISSIONS } from '../../common/constants/permissions';
import { DecisionDto } from '../../common/dto/decision.dto';
import { AuthenticatedUser } from '../../common/types/auth.types';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { CreateRevisionDto } from './dto/create-revision.dto';
import { QueryQuotationsDto } from './dto/query-quotations.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import { QuotationPdfService } from './quotation-pdf.service';
import { QuotationsService } from './quotations.service';

@ApiTags('quotations')
@Controller('quotations')
export class QuotationsController {
  constructor(
    private readonly quotations: QuotationsService,
    private readonly quotationPdf: QuotationPdfService,
  ) {}

  @Get()
  @RequirePermission(PERMISSIONS.QUOTATION_VIEW)
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryQuotationsDto) {
    return this.quotations.list(user.companyId, query);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.QUOTATION_VIEW)
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.quotations.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermission(PERMISSIONS.QUOTATION_CREATE)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateQuotationDto) {
    return this.quotations.create(user.companyId, user.userId, dto);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.QUOTATION_EDIT)
  updateHeader(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuotationDto,
  ) {
    return this.quotations.updateHeader(user.companyId, id, user.userId, dto);
  }

  @Post(':id/revisions')
  @RequirePermission(PERMISSIONS.QUOTATION_EDIT)
  addRevision(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateRevisionDto,
  ) {
    return this.quotations.addRevision(user.companyId, id, user.userId, dto);
  }

  @Post(':id/submit-for-approval')
  @RequirePermission(PERMISSIONS.QUOTATION_EDIT)
  submitForApproval(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.quotations.submitForApproval(user.companyId, id, user.userId);
  }

  @Post(':id/approve')
  @RequirePermission(PERMISSIONS.QUOTATION_APPROVE)
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecisionDto,
  ) {
    return this.quotations.decide(user.companyId, id, user.userId, 'approved', dto.comments);
  }

  @Post(':id/reject')
  @RequirePermission(PERMISSIONS.QUOTATION_APPROVE)
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecisionDto,
  ) {
    return this.quotations.decide(user.companyId, id, user.userId, 'rejected', dto.comments);
  }

  @Post(':id/send')
  @RequirePermission(PERMISSIONS.QUOTATION_EDIT)
  send(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.quotations.send(user.companyId, id, user.userId);
  }

  /** See QuotationsService.recordCustomerDecision for why this exists — no client portal, so staff record it on the customer's behalf. */
  @Post(':id/customer-accept')
  @RequirePermission(PERMISSIONS.QUOTATION_EDIT)
  customerAccept(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.quotations.recordCustomerDecision(user.companyId, id, user.userId, 'accepted');
  }

  @Post(':id/customer-reject')
  @RequirePermission(PERMISSIONS.QUOTATION_EDIT)
  customerReject(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.quotations.recordCustomerDecision(user.companyId, id, user.userId, 'rejected');
  }

  @Post(':id/convert-to-project')
  @RequirePermission(PERMISSIONS.QUOTATION_EDIT)
  convertToProject(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.quotations.convertToProject(user.companyId, id, user.userId);
  }

  /**
   * Not @Res({passthrough:true}) — Nest's default response handling would
   * JSON.stringify a returned Buffer (it doesn't special-case binary
   * bodies), which corrupts the PDF. Full manual @Res() control + res.send()
   * is required to write raw bytes with the right Content-Type.
   */
  @Get(':id/pdf')
  @RequirePermission(PERMISSIONS.QUOTATION_EXPORT)
  async downloadPdf(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, filename } = await this.quotationPdf.generate(user.companyId, id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.send(buffer);
  }
}
