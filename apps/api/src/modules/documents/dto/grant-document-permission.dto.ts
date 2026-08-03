import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { DOCUMENT_PERMISSION_LEVELS, DocumentPermissionLevel } from '../document.types';

/** Exactly one of roleId/userId, enforced in DocumentsService (matches the CHECK on document_permissions — Prisma can't express it). */
export class GrantDocumentPermissionDto {
  @IsOptional()
  @IsUUID()
  roleId?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsIn(DOCUMENT_PERMISSION_LEVELS)
  permission!: DocumentPermissionLevel;
}
