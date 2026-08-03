import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { UsersRepository } from '../users/users.repository';
import { DocumentStorageService } from './document-storage.service';
import { DocumentsRepository, DocumentWithDetail } from './documents.repository';
import { DocumentsService } from './documents.service';

const COMPANY_ID = 'company-1';
const USER_ID = 'user-1';
const DOC_ID = 'doc-1';

function makeDocument(overrides: Record<string, unknown> = {}): DocumentWithDetail {
  return {
    id: DOC_ID,
    companyId: COMPANY_ID,
    fileName: 'contract.pdf',
    storageKey: 'companies/company-1/abc-contract.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 2048,
    versions: [{ id: 'v1', versionNumber: 1, sizeBytes: 2048 }],
    ...overrides,
  } as never;
}

describe('DocumentsService', () => {
  let service: DocumentsService;
  let repository: jest.Mocked<
    Pick<DocumentsRepository, 'createFolder' | 'findFolderById' | 'listFolders' | 'createDocument' | 'findById' | 'list' | 'addVersion' | 'grantPermission' | 'revokePermission'>
  >;
  let storage: jest.Mocked<Pick<DocumentStorageService, 'generateStorageKey' | 'getDownloadUrl'>>;
  let users: jest.Mocked<Pick<UsersRepository, 'findByIdForCompany'>>;

  beforeEach(() => {
    repository = {
      createFolder: jest.fn(),
      findFolderById: jest.fn(),
      listFolders: jest.fn(),
      createDocument: jest.fn().mockResolvedValue(makeDocument()),
      findById: jest.fn().mockResolvedValue(makeDocument()),
      list: jest.fn(),
      addVersion: jest.fn().mockResolvedValue(makeDocument({ versions: [{ id: 'v1' }, { id: 'v2' }] })),
      grantPermission: jest.fn(),
      revokePermission: jest.fn(),
    };
    storage = {
      generateStorageKey: jest.fn().mockReturnValue('companies/company-1/generated-key.pdf'),
      getDownloadUrl: jest.fn().mockReturnValue('stub://fake-url'),
    };
    users = { findByIdForCompany: jest.fn().mockResolvedValue({ id: 'user-2' }) };

    service = new DocumentsService(
      repository as unknown as DocumentsRepository,
      storage as unknown as DocumentStorageService,
      users as unknown as UsersRepository,
      { record: jest.fn() } as unknown as AuditService,
    );
  });

  describe('createDocument', () => {
    it('rejects a folder that does not belong to the tenant', async () => {
      repository.findFolderById.mockResolvedValue(null);
      await expect(
        service.createDocument(COMPANY_ID, USER_ID, {
          folderId: 'not-mine',
          relatedEntityType: 'project',
          relatedEntityId: 'project-1',
          fileName: 'a.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 100,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.createDocument).not.toHaveBeenCalled();
    });

    it('generates a storage key and creates the document', async () => {
      const doc = await service.createDocument(COMPANY_ID, USER_ID, {
        relatedEntityType: 'project',
        relatedEntityId: 'project-1',
        fileName: 'a.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 100,
      });
      expect(storage.generateStorageKey).toHaveBeenCalledWith(COMPANY_ID, 'a.pdf');
      expect(doc.id).toBe(DOC_ID);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException for a document outside the tenant', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.findOne(COMPANY_ID, 'not-mine')).rejects.toThrow(NotFoundException);
    });
  });

  describe('addVersion', () => {
    it('adds a new version without touching prior ones (repository call only)', async () => {
      await service.addVersion(COMPANY_ID, DOC_ID, USER_ID, { mimeType: 'application/pdf', sizeBytes: 4096 });
      expect(repository.addVersion).toHaveBeenCalledWith(COMPANY_ID, DOC_ID, undefined, expect.any(String), 'application/pdf', 4096, USER_ID);
    });
  });

  describe('grantPermission', () => {
    it('rejects when neither roleId nor userId is set', async () => {
      await expect(service.grantPermission(COMPANY_ID, DOC_ID, USER_ID, { permission: 'view' })).rejects.toThrow(BadRequestException);
    });

    it('rejects when both roleId and userId are set', async () => {
      await expect(
        service.grantPermission(COMPANY_ID, DOC_ID, USER_ID, { roleId: 'role-1', userId: 'user-2', permission: 'view' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a userId outside the tenant', async () => {
      users.findByIdForCompany.mockResolvedValue(null);
      await expect(
        service.grantPermission(COMPANY_ID, DOC_ID, USER_ID, { userId: 'not-mine', permission: 'view' }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.grantPermission).not.toHaveBeenCalled();
    });

    it('grants when exactly one of roleId/userId is set', async () => {
      await service.grantPermission(COMPANY_ID, DOC_ID, USER_ID, { userId: 'user-2', permission: 'edit' });
      expect(repository.grantPermission).toHaveBeenCalledWith(DOC_ID, undefined, 'user-2', 'edit');
    });
  });
});
