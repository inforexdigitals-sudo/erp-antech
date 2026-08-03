import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { QuotationItemInputDto } from './quotation-item-input.dto';

export class CreateRevisionDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountAmount: number = 0;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'A quotation needs at least one line item.' })
  @ValidateNested({ each: true })
  @Type(() => QuotationItemInputDto)
  items!: QuotationItemInputDto[];
}
