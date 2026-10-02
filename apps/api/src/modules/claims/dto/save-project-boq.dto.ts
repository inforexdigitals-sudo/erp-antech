import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumber, IsOptional, IsString, Min, MinLength, ValidateNested } from 'class-validator';

export class ProjectBoqLineDto {
  @IsString()
  @MinLength(1)
  description!: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantity!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice!: number;
}

/** A project with no originating quotation keeping its own BOQ — see ClaimsService.saveProjectBoq. */
export class SaveProjectBoqDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'A BOQ needs at least one line.' })
  @ValidateNested({ each: true })
  @Type(() => ProjectBoqLineDto)
  lines!: ProjectBoqLineDto[];
}
