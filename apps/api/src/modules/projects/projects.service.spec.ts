import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { CustomersRepository } from '../crm/customers.repository';
import { ProjectsRepository } from './projects.repository';
import { ProjectsService } from './projects.service';

const COMPANY_ID = 'company-1';
const USER_ID = 'user-1';
const PROJECT_ID = 'project-1';

function makeProject(overrides: Record<string, unknown> = {}) {
  return { id: PROJECT_ID, companyId: COMPANY_ID, name: 'Test Project', ...overrides };
}

describe('ProjectsService', () => {
  let service: ProjectsService;
  let repository: jest.Mocked<
    Pick<
      ProjectsRepository,
      | 'findDetailById'
      | 'create'
      | 'update'
      | 'list'
      | 'findMilestoneById'
      | 'createTask'
      | 'findTaskById'
      | 'updateTask'
      | 'findIssueById'
      | 'updateIssue'
      | 'createIssue'
    >
  >;
  let customers: jest.Mocked<Pick<CustomersRepository, 'findById'>>;

  beforeEach(() => {
    repository = {
      findDetailById: jest.fn().mockResolvedValue(makeProject()),
      create: jest.fn(),
      update: jest.fn(),
      list: jest.fn(),
      findMilestoneById: jest.fn(),
      createTask: jest.fn(),
      findTaskById: jest.fn(),
      updateTask: jest.fn(),
      findIssueById: jest.fn(),
      updateIssue: jest.fn(),
      createIssue: jest.fn(),
    };
    customers = { findById: jest.fn() };

    service = new ProjectsService(
      repository as unknown as ProjectsRepository,
      customers as unknown as CustomersRepository,
      { record: jest.fn() } as unknown as AuditService,
    );
  });

  describe('create', () => {
    it('rejects a customerId that does not belong to the tenant', async () => {
      customers.findById.mockResolvedValue(null);

      await expect(
        service.create(COMPANY_ID, USER_ID, { name: 'New Project', customerId: 'not-mine', contractValue: 0 }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException for a project outside the tenant', async () => {
      repository.findDetailById.mockResolvedValue(null);
      await expect(service.findOne(COMPANY_ID, 'nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createTask', () => {
    it('rejects a milestoneId that does not belong to this project', async () => {
      repository.findMilestoneById.mockResolvedValue(null);

      await expect(
        service.createTask(COMPANY_ID, PROJECT_ID, USER_ID, { name: 'Task', milestoneId: 'other-project-milestone' }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.createTask).not.toHaveBeenCalled();
    });

    it('creates the task when no milestone is specified', async () => {
      repository.createTask.mockResolvedValue({ id: 'task-1' } as never);

      await service.createTask(COMPANY_ID, PROJECT_ID, USER_ID, { name: 'Unassigned task' });

      expect(repository.createTask).toHaveBeenCalled();
    });
  });

  describe('updateIssue', () => {
    it('stamps resolvedAt when transitioning to resolved', async () => {
      repository.findIssueById.mockResolvedValue({ id: 'issue-1', status: 'open', resolvedAt: null } as never);
      repository.updateIssue.mockResolvedValue({ id: 'issue-1', status: 'resolved' } as never);

      await service.updateIssue(COMPANY_ID, PROJECT_ID, 'issue-1', USER_ID, { status: 'resolved' });

      expect(repository.updateIssue).toHaveBeenCalledWith(
        'issue-1',
        expect.objectContaining({ status: 'resolved', resolvedAt: expect.any(Date) }),
      );
    });

    it('clears resolvedAt when a resolved issue is reopened', async () => {
      repository.findIssueById.mockResolvedValue({
        id: 'issue-1',
        status: 'resolved',
        resolvedAt: new Date('2026-01-01'),
      } as never);
      repository.updateIssue.mockResolvedValue({ id: 'issue-1', status: 'open' } as never);

      await service.updateIssue(COMPANY_ID, PROJECT_ID, 'issue-1', USER_ID, { status: 'open' });

      expect(repository.updateIssue).toHaveBeenCalledWith(
        'issue-1',
        expect.objectContaining({ status: 'open', resolvedAt: null }),
      );
    });

    it('leaves resolvedAt untouched on an update that does not change status', async () => {
      repository.findIssueById.mockResolvedValue({ id: 'issue-1', status: 'open', resolvedAt: null } as never);
      repository.updateIssue.mockResolvedValue({ id: 'issue-1' } as never);

      await service.updateIssue(COMPANY_ID, PROJECT_ID, 'issue-1', USER_ID, { description: 'more detail' });

      expect(repository.updateIssue).toHaveBeenCalledWith(
        'issue-1',
        expect.objectContaining({ resolvedAt: undefined }),
      );
    });
  });
});
