import { Injectable } from '@nestjs/common';
import { DocumentFolder, DocumentPermission, Prisma } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../database/prisma/prisma.service';

const documentDetailInclude = {
  versions: { orderBy: { versionNumber: 'desc' } },
  permissions: true,
  uploader: { select: { id: true, fullName: true } },
} satisfies Prisma.DocumentInclude;

type DocumentRaw = Prisma.DocumentGetPayload<{ include: typeof documentDetailInclude }>;

/**
 * `size_bytes` is BIGINT in Postgres, which Prisma types as JS
 * `bigint` — and `JSON.stringify` throws on `bigint` (Node has no
 * native serialization for it), which would crash every response that
 * includes a document. Converting to `number` here is safe (no file
 * this system handles will ever approach 2^53 bytes) and keeps every
 * layer above the repository working with plain numbers.
 */
export type DocumentWithDetail = Omit<DocumentRaw, 'sizeBytes' | 'versions'> & {
  sizeBytes: number;
  versions: Array<Omit<DocumentRaw['versions'][number], 'sizeBytes'> & { sizeBytes: number }>;
};

function serialize(doc: DocumentRaw): DocumentWithDetail {
  return {
    ...doc,
    sizeBytes: Number(doc.sizeBytes),
    versions: doc.versions.map((v) => ({ ...v, sizeBytes: Number(v.sizeBytes) })),
  };
}

export interface CreateDocumentParams {
  companyId: string;
  folderId?: string;
  relatedEntityType: string;
  relatedEntityId: string;
  fileName: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
}

@Injectable()
export class DocumentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createFolder(
    companyId: string,
    name: string,
    relatedEntityType: string | undefined,
    relatedEntityId: string | undefined,
    parentFolderId: string | undefined,
  ): Promise<DocumentFolder> {
    return this.prisma.documentFolder.create({
      data: { companyId, name, relatedEntityType, relatedEntityId, parentFolderId },
    });
  }

  async findFolderById(companyId: string, id: string): Promise<DocumentFolder | null> {
    return this.prisma.documentFolder.findFirst({ where: { id, companyId } });
  }

  async listFolders(
    companyId: string,
    filter: { relatedEntityType?: string; relatedEntityId?: string; parentFolderId?: string | null },
  ): Promise<DocumentFolder[]> {
    return this.prisma.documentFolder.findMany({
      where: {
        companyId,
        relatedEntityType: filter.relatedEntityType,
        relatedEntityId: filter.relatedEntityId,
        parentFolderId: filter.parentFolderId,
      },
      orderBy: { name: 'asc' },
    });
  }

  /** FR-14.2 — a fresh document always starts at version 1, tracked the same way a re-upload adds version N via addVersion. */
  async createDocument(params: CreateDocumentParams): Promise<DocumentWithDetail> {
    const doc = await this.prisma.$transaction(async (tx) => {
      const document = await tx.document.create({
        data: {
          companyId: params.companyId,
          folderId: params.folderId,
          relatedEntityType: params.relatedEntityType,
          relatedEntityId: params.relatedEntityId,
          fileName: params.fileName,
          storageKey: params.storageKey,
          mimeType: params.mimeType,
          sizeBytes: BigInt(params.sizeBytes),
          uploadedBy: params.uploadedBy,
        },
      });
      const version = await tx.documentVersion.create({
        data: {
          documentId: document.id,
          versionNumber: 1,
          storageKey: params.storageKey,
          sizeBytes: BigInt(params.sizeBytes),
          uploadedBy: params.uploadedBy,
        },
      });
      return tx.document.update({
        where: { id: document.id },
        data: { currentVersionId: version.id },
        include: documentDetailInclude,
      });
    });
    return serialize(doc);
  }

  async findById(companyId: string, id: string): Promise<DocumentWithDetail | null> {
    const doc = await this.prisma.document.findFirst({ where: { id, companyId }, include: documentDetailInclude });
    return doc ? serialize(doc) : null;
  }

  async list(
    companyId: string,
    query: PaginationQueryDto & { relatedEntityType?: string; relatedEntityId?: string; folderId?: string },
  ): Promise<{ data: DocumentWithDetail[]; total: number }> {
    const where: Prisma.DocumentWhereInput = {
      companyId,
      relatedEntityType: query.relatedEntityType,
      relatedEntityId: query.relatedEntityId,
      folderId: query.folderId,
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.document.findMany({
        where,
        include: documentDetailInclude,
        skip: query.skip,
        take: query.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.document.count({ where }),
    ]);
    return { data: data.map(serialize), total };
  }

  /** FR-14.2 — "new upload creates a version, not a duplicate": appends a row, then repoints current_version_id, never touches the prior version. */
  async addVersion(
    companyId: string,
    documentId: string,
    fileName: string | undefined,
    storageKey: string,
    mimeType: string,
    sizeBytes: number,
    uploadedBy: string,
  ): Promise<DocumentWithDetail> {
    const doc = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.document.findFirstOrThrow({ where: { id: documentId, companyId }, include: { versions: true } });
      const nextVersionNumber = existing.versions.length + 1;

      const version = await tx.documentVersion.create({
        data: { documentId, versionNumber: nextVersionNumber, storageKey, sizeBytes: BigInt(sizeBytes), uploadedBy },
      });

      return tx.document.update({
        where: { id: documentId },
        data: {
          currentVersionId: version.id,
          storageKey,
          mimeType,
          sizeBytes: BigInt(sizeBytes),
          fileName: fileName ?? existing.fileName,
        },
        include: documentDetailInclude,
      });
    });
    return serialize(doc);
  }

  async grantPermission(
    documentId: string,
    roleId: string | undefined,
    userId: string | undefined,
    permission: string,
  ): Promise<DocumentPermission> {
    return this.prisma.documentPermission.create({ data: { documentId, roleId, userId, permission } });
  }

  async revokePermission(documentId: string, permissionId: string): Promise<void> {
    await this.prisma.documentPermission.deleteMany({ where: { id: permissionId, documentId } });
  }
}
