import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentFolder, DocumentPermission } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { PaginatedResult, PaginationQueryDto, paginate } from '../../common/dto/pagination.dto';
import { UsersRepository } from '../users/users.repository';
import { AddDocumentVersionDto } from './dto/add-document-version.dto';
import { CreateDocumentDto } from './dto/create-document.dto';
import { CreateDocumentFolderDto } from './dto/create-document-folder.dto';
import { GrantDocumentPermissionDto } from './dto/grant-document-permission.dto';
import { DocumentStorageService } from './document-storage.service';
import { DocumentWithDetail, DocumentsRepository } from './documents.repository';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly repository: DocumentsRepository,
    private readonly storage: DocumentStorageService,
    private readonly users: UsersRepository,
    private readonly audit: AuditService,
  ) {}

  async createFolder(companyId: string, actorUserId: string, dto: CreateDocumentFolderDto): Promise<DocumentFolder> {
    if (dto.parentFolderId) {
      const parent = await this.repository.findFolderById(companyId, dto.parentFolderId);
      if (!parent) {
        throw new BadRequestException('Parent folder not found.');
      }
    }
    const folder = await this.repository.createFolder(
      companyId,
      dto.name,
      dto.relatedEntityType,
      dto.relatedEntityId,
      dto.parentFolderId,
    );
    await this.audit.record({ companyId, actorUserId, action: 'create', entityType: 'document_folder', entityId: folder.id, after: folder });
    return folder;
  }

  async listFolders(
    companyId: string,
    filter: { relatedEntityType?: string; relatedEntityId?: string; parentFolderId?: string },
  ): Promise<DocumentFolder[]> {
    return this.repository.listFolders(companyId, filter);
  }

  async createDocument(companyId: string, actorUserId: string, dto: CreateDocumentDto): Promise<DocumentWithDetail> {
    if (dto.folderId) {
      const folder = await this.repository.findFolderById(companyId, dto.folderId);
      if (!folder) {
        throw new BadRequestException('Folder not found.');
      }
    }

    const storageKey = this.storage.generateStorageKey(companyId, dto.fileName);
    const document = await this.repository.createDocument({
      companyId,
      folderId: dto.folderId,
      relatedEntityType: dto.relatedEntityType,
      relatedEntityId: dto.relatedEntityId,
      fileName: dto.fileName,
      storageKey,
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes,
      uploadedBy: actorUserId,
    });

    await this.audit.record({
      companyId,
      actorUserId,
      action: 'create',
      entityType: 'document',
      entityId: document.id,
      after: { fileName: document.fileName, relatedEntityType: document.relatedEntityType, relatedEntityId: document.relatedEntityId },
    });
    return document;
  }

  async findOne(companyId: string, id: string): Promise<DocumentWithDetail> {
    const document = await this.repository.findById(companyId, id);
    if (!document) {
      throw new NotFoundException('Document not found.');
    }
    return document;
  }

  async list(
    companyId: string,
    query: PaginationQueryDto & { relatedEntityType?: string; relatedEntityId?: string; folderId?: string },
  ): Promise<PaginatedResult<DocumentWithDetail>> {
    const { data, total } = await this.repository.list(companyId, query);
    return paginate(data, total, query);
  }

  /** FR-14.2 — new upload creates a version, not a duplicate document. */
  async addVersion(companyId: string, id: string, actorUserId: string, dto: AddDocumentVersionDto): Promise<DocumentWithDetail> {
    await this.findOne(companyId, id);
    const storageKey = this.storage.generateStorageKey(companyId, dto.fileName ?? 'document');
    const document = await this.repository.addVersion(companyId, id, dto.fileName, storageKey, dto.mimeType, dto.sizeBytes, actorUserId);
    await this.audit.record({
      companyId,
      actorUserId,
      action: 'add_version',
      entityType: 'document',
      entityId: id,
      after: { versionCount: document.versions.length },
    });
    return document;
  }

  getDownloadUrl(document: DocumentWithDetail): string {
    return this.storage.getDownloadUrl(document.storageKey);
  }

  /**
   * Data layer only — grants/revokes are recorded, but nothing in the
   * document read/download path checks them yet (the module-level
   * `@RequirePermission(DOCUMENT_VIEW)` guard is the only enforcement
   * today). Flagged rather than silently implying a per-document ACL
   * is actually enforced.
   */
  async grantPermission(companyId: string, id: string, actorUserId: string, dto: GrantDocumentPermissionDto): Promise<DocumentPermission> {
    await this.findOne(companyId, id);
    if (!dto.roleId === !dto.userId) {
      throw new BadRequestException('Exactly one of roleId or userId is required.');
    }
    if (dto.userId) {
      const user = await this.users.findByIdForCompany(companyId, dto.userId);
      if (!user) {
        throw new BadRequestException('User not found.');
      }
    }
    // roleId's tenant ownership isn't verified — there is no Roles
    // module/repository to check against yet (roles land with the
    // Settings/User Management batch). Flagged, not silently skipped.
    const permission = await this.repository.grantPermission(id, dto.roleId, dto.userId, dto.permission);
    await this.audit.record({ companyId, actorUserId, action: 'grant_permission', entityType: 'document', entityId: id, after: permission });
    return permission;
  }

  async revokePermission(companyId: string, id: string, permissionId: string, actorUserId: string): Promise<void> {
    await this.findOne(companyId, id);
    await this.repository.revokePermission(id, permissionId);
    await this.audit.record({ companyId, actorUserId, action: 'revoke_permission', entityType: 'document', entityId: id, after: { permissionId } });
  }
}
