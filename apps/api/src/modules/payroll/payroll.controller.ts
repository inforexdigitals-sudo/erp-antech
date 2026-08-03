import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/constants/permissions';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AuthenticatedUser } from '../../common/types/auth.types';
import { CreatePayrollPeriodDto } from './dto/create-payroll-period.dto';
import { CreateStatutoryRuleDto } from './dto/create-statutory-rule.dto';
import { GeneratePayrollExportDto } from './dto/generate-payroll-export.dto';
import { PayrollService } from './payroll.service';

@ApiTags('payroll')
@Controller()
export class PayrollController {
  constructor(private readonly payroll: PayrollService) {}

  @Get('payroll/periods')
  @RequirePermission(PERMISSIONS.PAYROLL_VIEW)
  listPeriods(@CurrentUser() user: AuthenticatedUser) {
    return this.payroll.listPeriods(user.companyId);
  }

  @Get('payroll/periods/:id')
  @RequirePermission(PERMISSIONS.PAYROLL_VIEW)
  findPeriod(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.payroll.findPeriod(user.companyId, id);
  }

  @Post('payroll/periods')
  @RequirePermission(PERMISSIONS.PAYROLL_CREATE)
  createPeriod(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePayrollPeriodDto) {
    return this.payroll.createPeriod(user.companyId, user.userId, dto);
  }

  @Get('payroll/periods/:id/preview')
  @RequirePermission(PERMISSIONS.PAYROLL_VIEW)
  previewHours(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.payroll.previewHours(user.companyId, id);
  }

  @Post('payroll/periods/:id/exports')
  @RequirePermission(PERMISSIONS.PAYROLL_EXPORT)
  generateExport(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GeneratePayrollExportDto,
  ) {
    return this.payroll.generateExport(user.companyId, id, user.userId, dto);
  }

  @Get('payroll/periods/:id/exports/latest.csv')
  @RequirePermission(PERMISSIONS.PAYROLL_EXPORT)
  @Header('Content-Type', 'text/csv')
  async downloadLatestCsv(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    const period = await this.payroll.findPeriod(user.companyId, id);
    return this.payroll.toCsv(period);
  }

  @Get('statutory-contribution-rules')
  @RequirePermission(PERMISSIONS.PAYROLL_VIEW)
  listRules(@CurrentUser() user: AuthenticatedUser) {
    return this.payroll.listStatutoryRules(user.companyId);
  }

  @Post('statutory-contribution-rules')
  @RequirePermission(PERMISSIONS.PAYROLL_CREATE)
  createRule(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateStatutoryRuleDto) {
    return this.payroll.createStatutoryRule(user.companyId, user.userId, dto);
  }
}
