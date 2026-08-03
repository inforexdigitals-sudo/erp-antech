import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';
import { COST_CATEGORIES, CostCategory } from '../../../common/constants/cost-category';

/** quotation_items.category shares the same domain as cost_category elsewhere (db/migrations/0003) — see common/constants/cost-category.ts. */
export const ITEM_CATEGORIES = COST_CATEGORIES;
export type ItemCategory = CostCategory;

export class QuotationItemInputDto {
  @IsOptional()
  @IsUUID()
  itemLibraryId?: string;

  @IsString()
  @MinLength(1)
  description!: string;

  @IsIn(ITEM_CATEGORIES)
  category!: ItemCategory;

  @IsString()
  @MinLength(1)
  unit!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  quantity!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitCost: number = 0;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  markupPercent: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountPercent: number = 0;

  @IsOptional()
  @IsUUID()
  taxCodeId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}
