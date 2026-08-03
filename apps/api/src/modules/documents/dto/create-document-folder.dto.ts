import { IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { DOCUMENT_FOLDER_ENTITY_TYPES, DocumentFolderEntityType } from '../document.types';

export class CreateDocumentFolderDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsIn(DOCUMENT_FOLDER_ENTITY_TYPES)
  relatedEntityType?: DocumentFolderEntityType;

  @IsOptional()
  @IsUUID()
  relatedEntityId?: string;

  @IsOptional()
  @IsUUID()
  parentFolderId?: string;
}
