import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class AddDocumentVersionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  fileName?: string;

  @IsString()
  @MinLength(1)
  mimeType!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  sizeBytes!: number;
}
