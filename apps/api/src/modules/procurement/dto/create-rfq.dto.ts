import { Type } from 'class-transformer';
import { ArrayMinSize, ArrayUnique, IsArray, IsDateString, IsOptional, IsUUID, ValidateNested } from 'class-validator';
import { RfqItemInputDto } from './rfq-item-input.dto';

export class CreateRfqDto {
  @IsOptional()
  @IsUUID()
  materialRequestId?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'An RFQ needs at least one line item.' })
  @ValidateNested({ each: true })
  @Type(() => RfqItemInputDto)
  items!: RfqItemInputDto[];

  /** Suppliers to add as recipients now; more can be added later via a separate call. */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  supplierIds?: string[];
}
