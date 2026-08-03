import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';

export class RfqItemInputDto {
  @IsOptional()
  @IsUUID()
  itemLibraryId?: string;

  @IsString()
  @MinLength(1)
  description!: string;

  @IsString()
  @MinLength(1)
  unit!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  quantity!: number;
}
