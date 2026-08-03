import { Injectable } from '@nestjs/common';
import { Prisma, Supplier } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../database/prisma/prisma.service';

@Injectable()
export class SuppliersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, data: Prisma.SupplierCreateWithoutCompanyInput): Promise<Supplier> {
    return this.prisma.supplier.create({ data: { ...data, company: { connect: { id: companyId } } } });
  }

  async findById(companyId: string, id: string): Promise<Supplier | null> {
    return this.prisma.supplier.findFirst({ where: { id, companyId, deletedAt: null } });
  }

  async list(
    companyId: string,
    query: PaginationQueryDto & { status?: string; search?: string },
  ): Promise<{ data: Supplier[]; total: number }> {
    const where: Prisma.SupplierWhereInput = {
      companyId,
      deletedAt: null,
      status: query.status,
      name: query.search ? { contains: query.search, mode: 'insensitive' } : undefined,
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.supplier.findMany({ where, skip: query.skip, take: query.take, orderBy: { name: 'asc' } }),
      this.prisma.supplier.count({ where }),
    ]);
    return { data, total };
  }

  async update(companyId: string, id: string, data: Prisma.SupplierUpdateInput): Promise<Supplier> {
    return this.prisma.supplier.update({ where: { id, companyId }, data });
  }

  async softDelete(companyId: string, id: string): Promise<void> {
    await this.prisma.supplier.update({ where: { id, companyId }, data: { deletedAt: new Date() } });
  }
}
