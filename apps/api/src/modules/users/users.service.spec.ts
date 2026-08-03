import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

const COMPANY_ID = 'company-1';
const USER_ID = 'user-1';

describe('UsersService', () => {
  let service: UsersService;
  let repository: jest.Mocked<
    Pick<
      UsersRepository,
      | 'findMeWithRoles'
      | 'findAllForCompany'
      | 'findByEmailInCompany'
      | 'createWithRoles'
      | 'findAdminList'
      | 'findAdminById'
      | 'updateFields'
      | 'setRoles'
    >
  >;
  let audit: jest.Mocked<Pick<AuditService, 'record'>>;

  beforeEach(() => {
    repository = {
      findMeWithRoles: jest.fn(),
      findAllForCompany: jest.fn(),
      findByEmailInCompany: jest.fn(),
      createWithRoles: jest.fn(),
      findAdminList: jest.fn(),
      findAdminById: jest.fn(),
      updateFields: jest.fn(),
      setRoles: jest.fn(),
    };
    audit = { record: jest.fn() };
    service = new UsersService(repository as unknown as UsersRepository, audit as unknown as AuditService);
  });

  it('lists active users for the tenant', async () => {
    repository.findAllForCompany.mockResolvedValue([{ id: USER_ID, fullName: 'Priya', jobTitle: 'QS' } as never]);
    const result = await service.list(COMPANY_ID);
    expect(repository.findAllForCompany).toHaveBeenCalledWith(COMPANY_ID);
    expect(result).toEqual([{ id: USER_ID, fullName: 'Priya', jobTitle: 'QS' }]);
  });

  it('throws NotFoundException when the user cannot be found', async () => {
    repository.findMeWithRoles.mockResolvedValue(null);
    await expect(service.getMe(COMPANY_ID, USER_ID)).rejects.toThrow(NotFoundException);
  });

  it('flattens role names out of the nested userRoles shape', async () => {
    repository.findMeWithRoles.mockResolvedValue({
      id: USER_ID,
      fullName: 'Priya Ramachandran',
      email: 'priya@example.com',
      jobTitle: 'Quantity Surveyor',
      avatarUrl: null,
      userRoles: [{ role: { name: 'QS' } }, { role: { name: 'Approver' } }],
    } as never);

    const result = await service.getMe(COMPANY_ID, USER_ID);

    expect(result).toEqual({
      id: USER_ID,
      fullName: 'Priya Ramachandran',
      email: 'priya@example.com',
      jobTitle: 'Quantity Surveyor',
      avatarUrl: null,
      roles: ['QS', 'Approver'],
    });
  });

  describe('create', () => {
    it('rejects a duplicate email within the tenant', async () => {
      repository.findByEmailInCompany.mockResolvedValue({ id: 'existing' } as never);

      await expect(
        service.create(COMPANY_ID, USER_ID, {
          fullName: 'New Hire',
          email: 'taken@example.com',
          password: 'password123',
          roleIds: ['role-1'],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.createWithRoles).not.toHaveBeenCalled();
    });

    it('hashes the password and assigns the given roles', async () => {
      repository.findByEmailInCompany.mockResolvedValue(null);
      repository.createWithRoles.mockResolvedValue({ id: 'new-user' } as never);
      repository.findAdminById.mockResolvedValue({
        id: 'new-user',
        fullName: 'New Hire',
        email: 'new@example.com',
        jobTitle: null,
        phone: null,
        isActive: true,
        userRoles: [{ role: { id: 'role-1', name: 'Site Supervisor' } }],
      } as never);

      await service.create(COMPANY_ID, USER_ID, {
        fullName: 'New Hire',
        email: 'new@example.com',
        password: 'password123',
        roleIds: ['role-1'],
      });

      expect(repository.createWithRoles).toHaveBeenCalledWith(
        COMPANY_ID,
        expect.objectContaining({ email: 'new@example.com', roleIds: ['role-1'] }),
      );
      const createdArgs = repository.createWithRoles.mock.calls[0][1];
      expect(createdArgs.passwordHash).not.toEqual('password123'); // never store it plain
      expect(audit.record).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it("refuses to deactivate your own account", async () => {
      repository.findAdminById.mockResolvedValue({
        id: USER_ID,
        fullName: 'Me',
        email: 'me@example.com',
        jobTitle: null,
        phone: null,
        isActive: true,
        userRoles: [],
      } as never);

      await expect(service.update(COMPANY_ID, USER_ID, USER_ID, { isActive: false })).rejects.toThrow(
        ForbiddenException,
      );
      expect(repository.updateFields).not.toHaveBeenCalled();
    });

    it("refuses to strip your own last role", async () => {
      repository.findAdminById.mockResolvedValue({
        id: USER_ID,
        fullName: 'Me',
        email: 'me@example.com',
        jobTitle: null,
        phone: null,
        isActive: true,
        userRoles: [{ role: { id: 'role-1', name: 'Owner' } }],
      } as never);

      await expect(service.update(COMPANY_ID, USER_ID, USER_ID, { roleIds: [] })).rejects.toThrow(
        ForbiddenException,
      );
      expect(repository.setRoles).not.toHaveBeenCalled();
    });

    it('updates fields and roles for someone else', async () => {
      repository.findAdminById
        .mockResolvedValueOnce({
          id: 'other-user',
          fullName: 'Old Name',
          email: 'other@example.com',
          jobTitle: null,
          phone: null,
          isActive: true,
          userRoles: [],
        } as never)
        .mockResolvedValueOnce({
          id: 'other-user',
          fullName: 'New Name',
          email: 'other@example.com',
          jobTitle: null,
          phone: null,
          isActive: true,
          userRoles: [{ role: { id: 'role-2', name: 'Accountant' } }],
        } as never);

      await service.update(COMPANY_ID, USER_ID, 'other-user', { fullName: 'New Name', roleIds: ['role-2'] });

      expect(repository.updateFields).toHaveBeenCalledWith(COMPANY_ID, 'other-user', { fullName: 'New Name' });
      expect(repository.setRoles).toHaveBeenCalledWith('other-user', ['role-2']);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ before: expect.anything(), after: expect.anything() }),
      );
    });
  });
});
