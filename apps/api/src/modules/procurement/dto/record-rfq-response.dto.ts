import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { RecordRfqResponseItemDto } from './record-rfq-response-item.dto';

export class RecordRfqResponseDto {
  @IsUUID()
  supplierId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  leadTimeDays?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'A response needs a price for at least one line item.' })
  @ValidateNested({ each: true })
  @Type(() => RecordRfqResponseItemDto)
  items!: RecordRfqResponseItemDto[];
}
