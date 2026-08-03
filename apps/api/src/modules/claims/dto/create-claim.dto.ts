import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { CLAIM_TYPES, ClaimType } from '../claim.types';
import { ClaimItemInputDto } from './claim-item-input.dto';

export class CreateClaimDto {
  @IsUUID()
  projectId!: string;

  @IsIn(CLAIM_TYPES)
  claimType!: ClaimType;

  /** Required when claimType is 'client'; must be omitted when 'subcontractor' — enforced in ClaimsService (see class-level CHECK on claims). */
  @IsOptional()
  @IsUUID()
  customerId?: string;

  /** Required when claimType is 'subcontractor'; must be omitted when 'client'. */
  @IsOptional()
  @IsUUID()
  subcontractorId?: string;

  @IsDateString()
  claimPeriodStart!: string;

  @IsDateString()
  claimPeriodEnd!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  cumulativePercentComplete?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  retentionPercent?: number;

  @IsArray()
  @ArrayMinSize(1, { message: 'A claim needs at least one line item.' })
  @ValidateNested({ each: true })
  @Type(() => ClaimItemInputDto)
  items!: ClaimItemInputDto[];
}
