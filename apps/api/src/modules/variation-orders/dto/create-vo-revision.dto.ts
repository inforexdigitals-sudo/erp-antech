import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { VoItemInputDto } from './vo-item-input.dto';

export class CreateVoRevisionDto {
  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'A variation order needs at least one line item.' })
  @ValidateNested({ each: true })
  @Type(() => VoItemInputDto)
  items!: VoItemInputDto[];
}
