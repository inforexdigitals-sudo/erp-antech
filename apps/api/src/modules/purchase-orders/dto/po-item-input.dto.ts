import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';
import { COST_CATEGORIES } from '../purchase-order.types';

export class PoItemInputDto {
  @IsOptional()
  @IsUUID()
  itemLibraryId?: string;

  @IsString()
  @MinLength(1)
  description!: string;

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
  unitPrice!: number;

  @IsOptional()
  @IsIn(COST_CATEGORIES)
  costCategory: (typeof COST_CATEGORIES)[number] = 'material';
}
