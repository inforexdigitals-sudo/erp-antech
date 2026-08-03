import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsISO8601, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

export class DeliveryItemInputDto {
  @IsUUID()
  purchaseOrderItemId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  quantityReceived!: number;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;
}

export class CreateDeliveryDto {
  @IsISO8601()
  deliveryDate!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'A delivery needs at least one received line item.' })
  @ValidateNested({ each: true })
  @Type(() => DeliveryItemInputDto)
  items!: DeliveryItemInputDto[];
}
