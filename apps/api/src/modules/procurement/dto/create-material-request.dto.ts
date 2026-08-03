import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { MaterialRequestItemInputDto } from './material-request-item-input.dto';

export class CreateMaterialRequestDto {
  @IsUUID()
  projectId!: string;

  @IsOptional()
  @IsDateString()
  neededByDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'A material request needs at least one line item.' })
  @ValidateNested({ each: true })
  @Type(() => MaterialRequestItemInputDto)
  items!: MaterialRequestItemInputDto[];
}
