import { Injectable } from '@nestjs/common';
import { Prisma, Subcontractor } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../database/prisma/prisma.service';

@Injectable()
export class SubcontractorsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, data: Prisma.SubcontractorCreateWithoutCompanyInput): Promise<Subcontractor> {
    return this.prisma.subcontractor.create({ data: { ...data, company: { connect: { id: companyId } } } });
  }

  async findById(companyId: string, id: string): Promise<Subcontractor | null> {
    return this.prisma.subcontractor.findFirst({ where: { id, companyId, deletedAt: null } });
  }

  async list(
    companyId: string,
    query: PaginationQueryDto & { status?: string; search?: string },
  ): Promise<{ data: Subcontractor[]; total: number }> {
    const where: Prisma.SubcontractorWhereInput = {
      companyId,
      deletedAt: null,
      status: query.status,
      name: query.search ? { contains: query.search, mode: 'insensitive' } : undefined,
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.subcontractor.findMany({ where, skip: query.skip, take: query.take, orderBy: { name: 'asc' } }),
      this.prisma.subcontractor.count({ where }),
    ]);
    return { data, total };
  }

  async update(companyId: string, id: string, data: Prisma.SubcontractorUpdateInput): Promise<Subcontractor> {
    return this.prisma.subcontractor.update({ where: { id, companyId }, data });
  }

  async softDelete(companyId: string, id: string): Promise<void> {
    await this.prisma.subcontractor.update({ where: { id, companyId }, data: { deletedAt: new Date() } });
  }
}
