import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, MinLength, ValidateNested } from 'class-validator';
import { VARIATION_ORDER_CAUSES, VariationOrderCause } from '../variation-order.types';
import { VoItemInputDto } from './vo-item-input.dto';

export class CreateVariationOrderDto {
  @IsUUID()
  projectId!: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsIn(VARIATION_ORDER_CAUSES)
  cause!: VariationOrderCause;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  scheduleImpactDays?: number;

  @IsArray()
  @ArrayMinSize(1, { message: 'A variation order needs at least one line item.' })
  @ValidateNested({ each: true })
  @Type(() => VoItemInputDto)
  items!: VoItemInputDto[];
}
