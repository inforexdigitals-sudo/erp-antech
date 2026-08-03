import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { PERMISSIONS } from '../../common/constants/permissions';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { DecisionDto } from '../../common/dto/decision.dto';
import { AuthenticatedUser } from '../../common/types/auth.types';
import { ClaimsService } from './claims.service';
import { CreateClaimDto } from './dto/create-claim.dto';
import { QueryClaimsDto } from './dto/query-claims.dto';
import { PaymentCertificatePdfService } from './payment-certificate-pdf.service';

@ApiTags('claims')
@Controller('claims')
export class ClaimsController {
  constructor(
    private readonly claims: ClaimsService,
    private readonly certificatePdf: PaymentCertificatePdfService,
  ) {}

  @Get()
  @RequirePermission(PERMISSIONS.CLAIM_VIEW)
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryClaimsDto) {
    return this.claims.list(user.companyId, query);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.CLAIM_VIEW)
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.claims.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermission(PERMISSIONS.CLAIM_CREATE)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateClaimDto) {
    return this.claims.create(user.companyId, user.userId, dto);
  }

  @Post(':id/submit-for-approval')
  @RequirePermission(PERMISSIONS.CLAIM_EDIT)
  submitForApproval(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.claims.submitForApproval(user.companyId, id, user.userId);
  }

  @Post(':id/certify')
  @RequirePermission(PERMISSIONS.CLAIM_APPROVE)
  certify(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DecisionDto) {
    return this.claims.decide(user.companyId, id, user.userId, 'approved', dto.comments);
  }

  @Post(':id/reject')
  @RequirePermission(PERMISSIONS.CLAIM_APPROVE)
  reject(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DecisionDto) {
    return this.claims.decide(user.companyId, id, user.userId, 'rejected', dto.comments);
  }

  /** Full manual @Res() — see QuotationsController.downloadPdf for why passthrough mode isn't used. */
  @Get(':id/certificate/pdf')
  @RequirePermission(PERMISSIONS.CLAIM_EXPORT)
  async downloadCertificatePdf(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, filename } = await this.certificatePdf.generate(user.companyId, id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.send(buffer);
  }
}
