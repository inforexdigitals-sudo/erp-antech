import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { COST_CATEGORIES, CostCategory } from '../../../common/constants/cost-category';

/**
 * quantity/unitCost/unitPrice are all optional — variation_order_items
 * has no NOT NULL on any of them (db/migrations/0008), unlike
 * quotation_items. A VO line can be a pure lump-sum description with
 * no quantity breakdown; when quantity+price are omitted, the line
 * simply contributes $0 to cost/revenue impact rather than being
 * rejected.
 */
export class VoItemInputDto {
  @IsString()
  @MinLength(1)
  description!: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @IsIn(COST_CATEGORIES)
  costCategory: CostCategory = 'material';
}
