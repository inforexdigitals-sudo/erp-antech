import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { SUBCONTRACTOR_STATUSES } from '../subcontractor.types';

export class CreateSubcontractorDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  trade?: string;

  @IsOptional()
  @IsIn(SUBCONTRACTOR_STATUSES)
  status?: (typeof SUBCONTRACTOR_STATUSES)[number];

  @IsOptional()
  @IsString()
  paymentTerms?: string;
}
