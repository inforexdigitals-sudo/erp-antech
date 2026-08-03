import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsOptional, ValidateNested } from 'class-validator';
import { PAYROLL_EXPORT_FORMATS, PayrollExportFormat } from '../payroll.types';
import { PayrollExportLineInputDto } from './payroll-export-line-input.dto';

export class GeneratePayrollExportDto {
  @IsOptional()
  @IsIn(PAYROLL_EXPORT_FORMATS)
  format?: PayrollExportFormat;

  @IsArray()
  @ArrayMinSize(1, { message: 'A payroll export needs at least one employee line.' })
  @ValidateNested({ each: true })
  @Type(() => PayrollExportLineInputDto)
  lines!: PayrollExportLineInputDto[];
}
