import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsNumber, IsOptional, Max, Min, ValidateNested } from 'class-validator';
import { ClaimItemInputDto } from './claim-item-input.dto';

/**
 * Only while a claim is still 'draft' — see ClaimsService.update. projectId,
 * claimType and the customer/subcontractor are identity fields set at
 * creation and not revisable here; items, when given, replace the claim's
 * BOQ lines wholesale (same as CreateClaimDto), not a partial patch.
 */
export class UpdateClaimDto {
  @IsOptional()
  @IsDateString()
  claimPeriodStart?: string;

  @IsOptional()
  @IsDateString()
  claimPeriodEnd?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  retentionPercent?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'A claim needs at least one line item.' })
  @ValidateNested({ each: true })
  @Type(() => ClaimItemInputDto)
  items?: ClaimItemInputDto[];
}
