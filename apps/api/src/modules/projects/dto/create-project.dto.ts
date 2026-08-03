import { Type } from 'class-transformer';
import { IsISO8601, IsNumber, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';

/** Manual project creation — most projects instead come from Quotation.convertToProject (FR-3.7). */
export class CreateProjectDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsUUID()
  customerId!: string;

  @IsOptional()
  @IsUUID()
  projectManagerId?: string;

  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  plannedEndDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  contractValue: number = 0;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
