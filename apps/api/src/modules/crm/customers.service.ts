import { Injectable, NotFoundException } from '@nestjs/common';
import { Customer } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { PaginatedResult, PaginationQueryDto, paginate } from '../../common/dto/pagination.dto';
import { CustomersRepository } from './customers.repository';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    private readonly repository: CustomersRepository,
    private readonly audit: AuditService,
  ) {}

  async create(companyId: string, actorUserId: string, dto: CreateCustomerDto): Promise<Customer> {
    const customer = await this.repository.create(companyId, {
      name: dto.name,
      registrationNumber: dto.registrationNumber,
      industry: dto.industry,
      billingAddress: dto.billingAddress,
      status: dto.status ?? 'active',
    });
    await this.audit.record({
      companyId,
      actorUserId,
      action: 'create',
      entityType: 'customer',
      entityId: customer.id,
      after: customer,
    });
    return customer;
  }

  async findOne(companyId: string, id: string): Promise<Customer> {
    const customer = await this.repository.findById(companyId, id);
    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }
    return customer;
  }

  async list(
    companyId: string,
    query: PaginationQueryDto & { status?: string; search?: string },
  ): Promise<PaginatedResult<Customer>> {
    const { data, total } = await this.repository.list(companyId, query);
    return paginate(data, total, query);
  }

  async update(companyId: string, id: string, actorUserId: string, dto: UpdateCustomerDto): Promise<Customer> {
    const before = await this.findOne(companyId, id);
    const updated = await this.repository.update(companyId, id, dto);
    await this.audit.record({
      companyId,
      actorUserId,
      action: 'update',
      entityType: 'customer',
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
      entityType: 'customer',
      entityId: id,
    });
  }
}
