import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ApprovalService } from '../../common/approval/approval.service';
import { AuditService } from '../../common/audit/audit.service';
import { DocumentNumberingService } from '../../common/numbering/document-numbering.service';
import { ProjectsRepository } from '../projects/projects.repository';
import { MaterialRequestsRepository } from './material-requests.repository';
import { MaterialRequestsService } from './material-requests.service';

const COMPANY_ID = 'company-1';
const USER_ID = 'user-1';
const REQUEST_ID = 'mr-1';

function makeRequest(overrides: Record<string, unknown> = {}) {
  return { id: REQUEST_ID, companyId: COMPANY_ID, projectId: 'project-1', status: 'draft', ...overrides };
}

describe('MaterialRequestsService', () => {
  let service: MaterialRequestsService;
  let repository: jest.Mocked<
    Pick<MaterialRequestsRepository, 'create' | 'findById' | 'list' | 'updateStatus' | 'tryTransitionStatus'>
  >;
  let projects: jest.Mocked<Pick<ProjectsRepository, 'findById'>>;
  let approval: jest.Mocked<Pick<ApprovalService, 'start' | 'decide' | 'getOpenRequestForEntity'>>;

  beforeEach(() => {
    repository = {
      create: jest.fn().mockResolvedValue(makeRequest()),
      findById: jest.fn().mockResolvedValue(makeRequest()),
      list: jest.fn(),
      updateStatus: jest.fn(),
      tryTransitionStatus: jest.fn().mockResolvedValue(true),
    };
    projects = { findById: jest.fn().mockResolvedValue({ id: 'project-1' }) };
    approval = { start: jest.fn(), decide: jest.fn(), getOpenRequestForEntity: jest.fn() };

    service = new MaterialRequestsService(
      repository as unknown as MaterialRequestsRepository,
      projects as unknown as ProjectsRepository,
      { allocate: jest.fn().mockResolvedValue('MR-0001') } as unknown as DocumentNumberingService,
      approval as unknown as ApprovalService,
      { record: jest.fn() } as unknown as AuditService,
    );
  });

  describe('create', () => {
    it('rejects a project that does not belong to the tenant', async () => {
      projects.findById.mockResolvedValue(null);
      await expect(
        service.create(COMPANY_ID, USER_ID, { projectId: 'not-mine', items: [{ description: 'Rebar', unit: 'ton', quantity: 5 }] }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('submitForApproval', () => {
    it('rejects cleanly when it loses the atomic-claim race', async () => {
      repository.tryTransitionStatus.mockResolvedValue(false);
      await expect(service.submitForApproval(COMPANY_ID, REQUEST_ID, USER_ID)).rejects.toThrow(ForbiddenException);
      expect(approval.start).not.toHaveBeenCalled();
    });

    it('auto-approves when no workflow is configured', async () => {
      approval.start.mockResolvedValue({ status: 'approved' } as never);
      await service.submitForApproval(COMPANY_ID, REQUEST_ID, USER_ID);
      expect(repository.updateStatus).toHaveBeenCalledWith(
        COMPANY_ID,
        REQUEST_ID,
        'approved',
        expect.objectContaining({ approvedBy: USER_ID }),
      );
    });

    it('moves to under_review when a workflow keeps the approval pending', async () => {
      approval.start.mockResolvedValue({ status: 'pending' } as never);
      await service.submitForApproval(COMPANY_ID, REQUEST_ID, USER_ID);
      expect(repository.updateStatus).toHaveBeenCalledWith(COMPANY_ID, REQUEST_ID, 'under_review');
    });
  });

  describe('decide', () => {
    it('rejects a request that is not under review', async () => {
      repository.findById.mockResolvedValue(makeRequest({ status: 'draft' }) as never);
      await expect(service.decide(COMPANY_ID, REQUEST_ID, USER_ID, 'approved')).rejects.toThrow(ForbiddenException);
    });

    it('throws when no open approval request exists', async () => {
      repository.findById.mockResolvedValue(makeRequest({ status: 'under_review' }) as never);
      approval.getOpenRequestForEntity.mockResolvedValue(null);
      await expect(service.decide(COMPANY_ID, REQUEST_ID, USER_ID, 'approved')).rejects.toThrow(BadRequestException);
    });

    it('rejects the request when the decision is rejected', async () => {
      repository.findById.mockResolvedValue(makeRequest({ status: 'under_review' }) as never);
      approval.getOpenRequestForEntity.mockResolvedValue({ id: 'req-1' } as never);
      approval.decide.mockResolvedValue({ status: 'rejected' } as never);
      await service.decide(COMPANY_ID, REQUEST_ID, USER_ID, 'rejected');
      expect(repository.updateStatus).toHaveBeenCalledWith(COMPANY_ID, REQUEST_ID, 'rejected');
    });
  });
});
