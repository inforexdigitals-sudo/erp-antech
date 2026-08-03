import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { MaterialRequestStatus } from './material-request.types';

const materialRequestDetailInclude = {
  items: true,
  project: { select: { id: true, name: true, projectNumber: true } },
  requester: { select: { id: true, fullName: true } },
  approver: { select: { id: true, fullName: true } },
} satisfies Prisma.MaterialRequestInclude;

export type MaterialRequestWithDetail = Prisma.MaterialRequestGetPayload<{ include: typeof materialRequestDetailInclude }>;

export interface MaterialRequestItemInput {
  itemLibraryId?: string;
  description: string;
  unit: string;
  quantity: number;
  estimatedUnitCost?: number;
  notes?: string;
}

export interface CreateMaterialRequestParams {
  companyId: string;
  projectId: string;
  requestNumber: string;
  requestedBy: string;
  neededByDate?: Date;
  notes?: string;
  items: MaterialRequestItemInput[];
}

@Injectable()
export class MaterialRequestsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(params: CreateMaterialRequestParams): Promise<MaterialRequestWithDetail> {
    return this.prisma.materialRequest.create({
      data: {
        companyId: params.companyId,
        projectId: params.projectId,
        requestNumber: params.requestNumber,
        requestedBy: params.requestedBy,
        status: 'draft',
        neededByDate: params.neededByDate,
        notes: params.notes,
        items: { create: params.items },
      },
      include: materialRequestDetailInclude,
    });
  }

  async findById(companyId: string, id: string): Promise<MaterialRequestWithDetail | null> {
    return this.prisma.materialRequest.findFirst({ where: { id, companyId }, include: materialRequestDetailInclude });
  }

  async list(
    companyId: string,
    query: PaginationQueryDto & { status?: string; projectId?: string },
  ): Promise<{ data: MaterialRequestWithDetail[]; total: number }> {
    const where: Prisma.MaterialRequestWhereInput = { companyId, status: query.status, projectId: query.projectId };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.materialRequest.findMany({
        where,
        include: materialRequestDetailInclude,
        skip: query.skip,
        take: query.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.materialRequest.count({ where }),
    ]);
    return { data, total };
  }

  async updateStatus(
    companyId: string,
    id: string,
    status: MaterialRequestStatus,
    extra: Partial<{ approvedBy: string; approvedAt: Date }> = {},
  ) {
    return this.prisma.materialRequest.update({ where: { id, companyId }, data: { status, ...extra } });
  }

  /** See VariationOrdersRepository.tryTransitionStatus for why this exists. */
  async tryTransitionStatus(
    companyId: string,
    id: string,
    fromStatus: MaterialRequestStatus,
    toStatus: MaterialRequestStatus,
  ): Promise<boolean> {
    const result = await this.prisma.materialRequest.updateMany({
      where: { id, companyId, status: fromStatus },
      data: { status: toStatus },
    });
    return result.count === 1;
  }
}
