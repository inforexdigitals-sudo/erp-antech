import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumber, IsUUID, Min, ValidateNested } from 'class-validator';

export class HoursAllocationInputDto {
  @IsUUID()
  projectId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  hours!: number;
}

export class AllocateHoursDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one project allocation is required.' })
  @ValidateNested({ each: true })
  @Type(() => HoursAllocationInputDto)
  allocations!: HoursAllocationInputDto[];
}
