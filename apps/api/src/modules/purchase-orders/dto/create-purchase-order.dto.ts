import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { PoItemInputDto } from './po-item-input.dto';

export class CreatePurchaseOrderDto {
  @IsUUID()
  supplierId!: string;

  @IsUUID()
  projectId!: string;

  @IsOptional()
  @IsUUID()
  materialRequestId?: string;

  @IsOptional()
  @IsISO8601()
  expectedDeliveryDate?: string;

  @IsOptional()
  @IsString()
  paymentTerms?: string;

  /**
   * purchase_order_items has no per-line tax field (db/migrations/0005) —
   * tax on a PO is a flat header-level amount, unlike Quotations where
   * it's computed per-line from each item's tax code.
   */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  taxAmount: number = 0;

  @IsArray()
  @ArrayMinSize(1, { message: 'A purchase order needs at least one line item.' })
  @ValidateNested({ each: true })
  @Type(() => PoItemInputDto)
  items!: PoItemInputDto[];
}
