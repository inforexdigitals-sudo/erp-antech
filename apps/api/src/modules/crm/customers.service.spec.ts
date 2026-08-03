import { NotFoundException } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { CustomersRepository } from './customers.repository';
import { CustomersService } from './customers.service';

const COMPANY_ID = 'company-1';

describe('CustomersService', () => {
  let service: CustomersService;
  let repository: jest.Mocked<Pick<CustomersRepository, 'create' | 'findById' | 'update' | 'softDelete' | 'list'>>;

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      list: jest.fn(),
    };
    service = new CustomersService(
      repository as unknown as CustomersRepository,
      { record: jest.fn() } as unknown as AuditService,
    );
  });

  it('defaults a new customer to active status', async () => {
    repository.create.mockResolvedValue({ id: 'c1', status: 'active' } as never);

    await service.create(COMPANY_ID, 'user-1', { name: 'Jurong Precision Manufacturing' });

    expect(repository.create).toHaveBeenCalledWith(COMPANY_ID, expect.objectContaining({ status: 'active' }));
  });

  it('lists customers for the tenant', async () => {
    repository.list.mockResolvedValue({ data: [{ id: 'c1' } as never], total: 1 });

    const result = await service.list(COMPANY_ID, { page: 1, pageSize: 25, skip: 0, take: 25 } as never);

    expect(repository.list).toHaveBeenCalledWith(COMPANY_ID, expect.anything());
    expect(result.data).toEqual([{ id: 'c1' }]);
  });

  it('throws NotFoundException for a customer outside the tenant', async () => {
    repository.findById.mockResolvedValue(null);
    await expect(service.findOne(COMPANY_ID, 'not-mine')).rejects.toThrow(NotFoundException);
  });

  it('records an audit entry with before/after state on update', async () => {
    repository.findById.mockResolvedValue({ id: 'c1', name: 'Old Name' } as never);
    repository.update.mockResolvedValue({ id: 'c1', name: 'New Name' } as never);
    const audit = { record: jest.fn() };
    service = new CustomersService(repository as unknown as CustomersRepository, audit as unknown as AuditService);

    await service.update(COMPANY_ID, 'c1', 'user-1', { name: 'New Name' });

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        before: expect.objectContaining({ name: 'Old Name' }),
        after: expect.objectContaining({ name: 'New Name' }),
      }),
    );
  });
});
