import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsNumber, IsOptional, IsString, Length, Min } from 'class-validator';
import { STATUTORY_SCHEMES, StatutoryScheme } from '../payroll.types';

export class CreateStatutoryRuleDto {
  @IsString()
  @Length(2, 2)
  countryCode!: string;

  @IsIn(STATUTORY_SCHEMES)
  scheme!: StatutoryScheme;

  @IsOptional()
  @IsString()
  ageBand?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  employeeRate!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  employerRate!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  salaryCeiling?: number;

  @IsDateString()
  effectiveFrom!: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}
