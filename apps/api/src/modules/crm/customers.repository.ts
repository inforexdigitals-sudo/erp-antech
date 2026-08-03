import { Injectable } from '@nestjs/common';
import { Customer, Prisma } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../database/prisma/prisma.service';

/**
 * A read-focused stand-in has grown a real create/update/delete surface
 * (by explicit request — see customers.controller.ts) without becoming
 * full CRM: still no contacts, leads, opportunities, or communications.
 */
@Injectable()
export class CustomersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, data: Prisma.CustomerCreateWithoutCompanyInput): Promise<Customer> {
    return this.prisma.customer.create({ data: { ...data, company: { connect: { id: companyId } } } });
  }

  async findById(companyId: string, id: string): Promise<Customer | null> {
    return this.prisma.customer.findFirst({
      where: { id, companyId, deletedAt: null },
    });
  }

  /** Backs both the paginated Customers management page and the `?pageSize=100` picker call used by Quotations/Projects/Claims — see apps/web/src/features/shared/api.ts. */
  async list(
    companyId: string,
    query: PaginationQueryDto & { status?: string; search?: string },
  ): Promise<{ data: Customer[]; total: number }> {
    const where: Prisma.CustomerWhereInput = {
      companyId,
      deletedAt: null,
      status: query.status,
      name: query.search ? { contains: query.search, mode: 'insensitive' } : undefined,
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({ where, skip: query.skip, take: query.take, orderBy: { name: 'asc' } }),
      this.prisma.customer.count({ where }),
    ]);
    return { data, total };
  }

  /** Just id+name, for project-import's fuzzy-match-against-extracted-text heuristic — see modules/project-import/extract-suggestions.util.ts. */
  async findNamesForCompany(companyId: string): Promise<{ id: string; name: string }[]> {
    return this.prisma.customer.findMany({
      where: { companyId, deletedAt: null },
      select: { id: true, name: true },
    });
  }

  async update(companyId: string, id: string, data: Prisma.CustomerUpdateInput): Promise<Customer> {
    return this.prisma.customer.update({ where: { id, companyId }, data });
  }

  async softDelete(companyId: string, id: string): Promise<void> {
    await this.prisma.customer.update({ where: { id, companyId }, data: { deletedAt: new Date() } });
  }
}
