import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsNumber, IsOptional, IsString, IsUUID, Min, MinLength, ValidateNested } from 'class-validator';
import { COST_CATEGORIES, CostCategory } from '../../../common/constants/cost-category';

export class BudgetLineInputDto {
  @IsIn(COST_CATEGORIES)
  costCategory!: CostCategory;

  @IsString()
  @MinLength(1)
  description!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budgetedAmount!: number;

  @IsOptional()
  @IsUUID()
  itemLibraryId?: string;
}

/** For projects without a linked quotation — see CostingService.initializeBudgetFromQuotation for the other path. */
export class CreateManualBudgetDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'A budget needs at least one line.' })
  @ValidateNested({ each: true })
  @Type(() => BudgetLineInputDto)
  lines!: BudgetLineInputDto[];
}
