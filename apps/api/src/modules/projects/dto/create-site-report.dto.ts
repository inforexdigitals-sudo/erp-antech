import { Type } from 'class-transformer';
import { IsISO8601, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateSiteReportDto {
  @IsISO8601()
  reportDate!: string;

  @IsOptional()
  @IsString()
  weather?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  manpowerCount?: number;

  @IsOptional()
  @IsString()
  progressSummary?: string;
}
