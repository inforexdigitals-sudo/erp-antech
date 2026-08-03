import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

/**
 * regularHours/overtimeHours deliberately have no field here (FR-12.4 —
 * read-derived from approved Timesheets, never re-entered). Everything
 * below is a figure prepared externally (payroll provider, HR
 * spreadsheet) that this system has no source data to compute — see
 * PayrollExportsService.
 */
export class PayrollExportLineInputDto {
  @IsUUID()
  userId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  allowances?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  deductions?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  statutoryEmployeeContribution?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  statutoryEmployerContribution?: number;

  /**
   * Required, not derived: net pay = gross wage + allowances -
   * deductions - employee statutory contribution, and this schema has
   * no gross-wage source at all (same gap already flagged for
   * Timesheets' cost-ledger wiring). A formula that silently omitted
   * the wage term would look like a real computed net pay while being
   * wrong — so this is never computed here, only ever supplied.
   */
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  netPay!: number;
}
