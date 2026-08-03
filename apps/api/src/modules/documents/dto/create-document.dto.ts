import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';

export class CreateDocumentDto {
  @IsOptional()
  @IsUUID()
  folderId?: string;

  @IsString()
  @MinLength(1)
  relatedEntityType!: string;

  @IsUUID()
  relatedEntityId!: string;

  @IsString()
  @MinLength(1)
  fileName!: string;

  @IsString()
  @MinLength(1)
  mimeType!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  sizeBytes!: number;
}
