import { NotFoundException } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { SuppliersRepository } from './suppliers.repository';
import { SuppliersService } from './suppliers.service';

describe('SuppliersService', () => {
  let service: SuppliersService;
  let repository: jest.Mocked<Pick<SuppliersRepository, 'create' | 'findById' | 'update' | 'softDelete' | 'list'>>;

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      list: jest.fn(),
    };
    service = new SuppliersService(
      repository as unknown as SuppliersRepository,
      { record: jest.fn() } as unknown as AuditService,
    );
  });

  it('defaults a new supplier to active status', async () => {
    repository.create.mockResolvedValue({ id: 's1', status: 'active' } as never);

    await service.create('company-1', 'user-1', { name: 'SteelWorks Trading Pte Ltd' });

    expect(repository.create).toHaveBeenCalledWith(
      'company-1',
      expect.objectContaining({ status: 'active' }),
    );
  });

  it('throws NotFoundException for a supplier outside the tenant', async () => {
    repository.findById.mockResolvedValue(null);
    await expect(service.findOne('company-1', 'not-mine')).rejects.toThrow(NotFoundException);
  });

  it('records an audit entry with before/after state on update', async () => {
    repository.findById.mockResolvedValue({ id: 's1', name: 'Old Name' } as never);
    repository.update.mockResolvedValue({ id: 's1', name: 'New Name' } as never);
    const audit = { record: jest.fn() };
    service = new SuppliersService(repository as unknown as SuppliersRepository, audit as unknown as AuditService);

    await service.update('company-1', 's1', 'user-1', { name: 'New Name' });

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        before: expect.objectContaining({ name: 'Old Name' }),
        after: expect.objectContaining({ name: 'New Name' }),
      }),
    );
  });
});
