import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { VARIATION_ORDER_CAUSES, VariationOrderCause } from '../variation-order.types';

/** Header fields only — line items/pricing go through a new revision (POST .../revisions), same split as Quotations. */
export class UpdateVariationOrderDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsIn(VARIATION_ORDER_CAUSES)
  cause?: VariationOrderCause;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  scheduleImpactDays?: number;
}
