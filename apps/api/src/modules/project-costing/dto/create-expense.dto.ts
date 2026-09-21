import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsNumber, IsString, Min, MinLength } from 'class-validator';
import { COST_CATEGORIES, CostCategory } from '../../../common/constants/cost-category';

/** A one-off material/other purchase logged directly against a project — see CostingService.recordExpense. */
export class CreateExpenseDto {
  @IsString()
  @MinLength(1)
  description!: string;

  @IsIn(COST_CATEGORIES)
  costCategory!: CostCategory;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsDateString()
  expenseDate!: string;
}
