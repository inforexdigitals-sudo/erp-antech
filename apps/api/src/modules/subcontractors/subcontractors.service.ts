import { Injectable, NotFoundException } from '@nestjs/common';
import { Subcontractor } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { PaginatedResult, PaginationQueryDto, paginate } from '../../common/dto/pagination.dto';
import { CreateSubcontractorDto } from './dto/create-subcontractor.dto';
import { UpdateSubcontractorDto } from './dto/update-subcontractor.dto';
import { SubcontractorsRepository } from './subcontractors.repository';

@Injectable()
export class SubcontractorsService {
  constructor(
    private readonly repository: SubcontractorsRepository,
    private readonly audit: AuditService,
  ) {}

  async create(companyId: string, actorUserId: string, dto: CreateSubcontractorDto): Promise<Subcontractor> {
    const subcontractor = await this.repository.create(companyId, {
      name: dto.name,
      registrationNumber: dto.registrationNumber,
      trade: dto.trade,
      status: dto.status ?? 'active',
      paymentTerms: dto.paymentTerms,
    });
    await this.audit.record({
      companyId,
      actorUserId,
      action: 'create',
      entityType: 'subcontractor',
      entityId: subcontractor.id,
      after: subcontractor,
    });
    return subcontractor;
  }

  async findOne(companyId: string, id: string): Promise<Subcontractor> {
    const subcontractor = await this.repository.findById(companyId, id);
    if (!subcontractor) {
      throw new NotFoundException('Subcontractor not found.');
    }
    return subcontractor;
  }

  async list(
    companyId: string,
    query: PaginationQueryDto & { status?: string; search?: string },
  ): Promise<PaginatedResult<Subcontractor>> {
    const { data, total } = await this.repository.list(companyId, query);
    return paginate(data, total, query);
  }

  async update(companyId: string, id: string, actorUserId: string, dto: UpdateSubcontractorDto): Promise<Subcontractor> {
    const before = await this.findOne(companyId, id);
    const updated = await this.repository.update(companyId, id, dto);
    await this.audit.record({
      companyId,
      actorUserId,
      action: 'update',
      entityType: 'subcontractor',
      entityId: id,
      before,
      after: updated,
    });
    return updated;
  }

  async remove(companyId: string, id: string, actorUserId: string): Promise<void> {
    await this.findOne(companyId, id);
    await this.repository.softDelete(companyId, id);
    await this.audit.record({
      companyId,
      actorUserId,
      action: 'delete',
      entityType: 'subcontractor',
      entityId: id,
    });
  }
}
