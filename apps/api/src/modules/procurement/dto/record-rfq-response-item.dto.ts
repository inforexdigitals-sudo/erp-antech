import { Type } from 'class-transformer';
import { IsNumber, IsUUID, Min } from 'class-validator';

export class RecordRfqResponseItemDto {
  @IsUUID()
  rfqItemId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  quantity!: number;
}
