import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsISO8601, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { PoItemInputDto } from './po-item-input.dto';

/** Header + items in one DTO — unlike Quotations, a PO has no revision history to keep separate from its header, so one PATCH covers both. */
export class UpdatePurchaseOrderDto {
  @IsOptional()
  @IsISO8601()
  expectedDeliveryDate?: string;

  @IsOptional()
  @IsString()
  paymentTerms?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  taxAmount?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'A purchase order needs at least one line item.' })
  @ValidateNested({ each: true })
  @Type(() => PoItemInputDto)
  items?: PoItemInputDto[];
}
