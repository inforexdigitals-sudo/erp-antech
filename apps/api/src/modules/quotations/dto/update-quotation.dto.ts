import { IsISO8601, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

/** Only header fields — line items/pricing changes go through a new revision (POST .../revisions). */
export class UpdateQuotationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsUUID()
  ownerUserId?: string;

  @IsOptional()
  @IsISO8601()
  validUntil?: string;
}
