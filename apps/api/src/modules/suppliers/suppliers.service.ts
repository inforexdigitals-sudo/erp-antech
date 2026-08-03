import { Injectable, NotFoundException } from '@nestjs/common';
import { Supplier } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { PaginatedResult, PaginationQueryDto, paginate } from '../../common/dto/pagination.dto';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SuppliersRepository } from './suppliers.repository';

@Injectable()
export class SuppliersService {
  constructor(
    private readonly repository: SuppliersRepository,
    private readonly audit: AuditService,
  ) {}

  async create(companyId: string, actorUserId: string, dto: CreateSupplierDto): Promise<Supplier> {
    const supplier = await this.repository.create(companyId, {
      name: dto.name,
      registrationNumber: dto.registrationNumber,
      category: dto.category,
      status: dto.status ?? 'active',
      paymentTerms: dto.paymentTerms,
    });
    await this.audit.record({
      companyId,
      actorUserId,
      action: 'create',
      entityType: 'supplier',
      entityId: supplier.id,
      after: supplier,
    });
    return supplier;
  }

  async findOne(companyId: string, id: string): Promise<Supplier> {
    const supplier = await this.repository.findById(companyId, id);
    if (!supplier) {
      throw new NotFoundException('Supplier not found.');
    }
    return supplier;
  }

  async list(
    companyId: string,
    query: PaginationQueryDto & { status?: string; search?: string },
  ): Promise<PaginatedResult<Supplier>> {
    const { data, total } = await this.repository.list(companyId, query);
    return paginate(data, total, query);
  }

  async update(companyId: string, id: string, actorUserId: string, dto: UpdateSupplierDto): Promise<Supplier> {
    const before = await this.findOne(companyId, id);
    const updated = await this.repository.update(companyId, id, dto);
    await this.audit.record({
      companyId,
      actorUserId,
      action: 'update',
      entityType: 'supplier',
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
      entityType: 'supplier',
      entityId: id,
    });
  }
}
