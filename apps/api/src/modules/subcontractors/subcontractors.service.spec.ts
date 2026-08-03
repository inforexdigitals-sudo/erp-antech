import { NotFoundException } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { SubcontractorsRepository } from './subcontractors.repository';
import { SubcontractorsService } from './subcontractors.service';

describe('SubcontractorsService', () => {
  let service: SubcontractorsService;
  let repository: jest.Mocked<Pick<SubcontractorsRepository, 'create' | 'findById' | 'update' | 'softDelete' | 'list'>>;

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      list: jest.fn(),
    };
    service = new SubcontractorsService(
      repository as unknown as SubcontractorsRepository,
      { record: jest.fn() } as unknown as AuditService,
    );
  });

  it('defaults a new subcontractor to active status', async () => {
    repository.create.mockResolvedValue({ id: 'sc1', status: 'active' } as never);

    await service.create('company-1', 'user-1', { name: 'Apex Electrical Works' });

    expect(repository.create).toHaveBeenCalledWith(
      'company-1',
      expect.objectContaining({ status: 'active' }),
    );
  });

  it('throws NotFoundException for a subcontractor outside the tenant', async () => {
    repository.findById.mockResolvedValue(null);
    await expect(service.findOne('company-1', 'not-mine')).rejects.toThrow(NotFoundException);
  });

  it('records an audit entry with before/after state on update', async () => {
    repository.findById.mockResolvedValue({ id: 'sc1', name: 'Old Name' } as never);
    repository.update.mockResolvedValue({ id: 'sc1', name: 'New Name' } as never);
    const audit = { record: jest.fn() };
    service = new SubcontractorsService(repository as unknown as SubcontractorsRepository, audit as unknown as AuditService);

    await service.update('company-1', 'sc1', 'user-1', { name: 'New Name' });

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        before: expect.objectContaining({ name: 'Old Name' }),
        after: expect.objectContaining({ name: 'New Name' }),
      }),
    );
  });
});
