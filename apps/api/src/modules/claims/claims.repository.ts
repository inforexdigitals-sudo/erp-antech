import { Injectable } from '@nestjs/common';
import { Claim, Prisma } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { ClaimStatus } from './claim.types';

const claimDetailInclude = {
  items: true,
  project: { select: { id: true, name: true, projectNumber: true } },
  customer: { select: { id: true, name: true } },
  subcontractor: { select: { id: true, name: true } },
  submitter: { select: { id: true, fullName: true } },
  certifier: { select: { id: true, fullName: true } },
  paymentCertificate: true,
  retentionRecords: true,
} satisfies Prisma.ClaimInclude;

export type ClaimWithDetail = Prisma.ClaimGetPayload<{ include: typeof claimDetailInclude }>;

export interface ClaimItemInput {
  quotationItemId?: string;
  description: string;
  contractQuantity?: number;
  previousPercent: number;
  currentPercent: number;
  cumulativePercent: number;
  amount: number;
}

export interface CreateClaimParams {
  companyId: string;
  projectId: string;
  claimNumber: string;
  claimType: string;
  customerId?: string;
  subcontractorId?: string;
  claimPeriodStart: Date;
  claimPeriodEnd: Date;
  cumulativePercentComplete?: number;
  claimAmount: number;
  retentionPercent: number;
  retentionAmount: number;
  netClaimAmount: number;
  submittedBy?: string;
  items: ClaimItemInput[];
}

@Injectable()
export class ClaimsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(params: CreateClaimParams): Promise<ClaimWithDetail> {
    const claim = await this.prisma.claim.create({
      data: {
        companyId: params.companyId,
        projectId: params.projectId,
        claimNumber: params.claimNumber,
        claimType: params.claimType,
        customerId: params.customerId,
        subcontractorId: params.subcontractorId,
        claimPeriodStart: params.claimPeriodStart,
        claimPeriodEnd: params.claimPeriodEnd,
        cumulativePercentComplete: params.cumulativePercentComplete,
        status: 'draft',
        claimAmount: params.claimAmount,
        retentionPercent: params.retentionPercent,
        retentionAmount: params.retentionAmount,
        netClaimAmount: params.netClaimAmount,
        items: { create: params.items },
      },
      include: claimDetailInclude,
    });
    return claim;
  }

  async findById(companyId: string, id: string): Promise<ClaimWithDetail | null> {
    return this.prisma.claim.findFirst({ where: { id, companyId }, include: claimDetailInclude });
  }

  async list(
    companyId: string,
    query: PaginationQueryDto & { status?: string; projectId?: string },
  ): Promise<{ data: ClaimWithDetail[]; total: number }> {
    const where: Prisma.ClaimWhereInput = { companyId, status: query.status, projectId: query.projectId };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.claim.findMany({
        where,
        include: claimDetailInclude,
        skip: query.skip,
        take: query.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.claim.count({ where }),
    ]);
    return { data, total };
  }

  /**
   * FR-8.3's "running claimed-to-date totals" per BOQ line: the
   * cumulative percent already certified for each quotationItemId, as
   * of this project's most recent certified/paid claim. Item-level, not
   * SQL-aggregated, because "most recent per quotationItemId" needs a
   * per-group max that's simpler to reduce client-side than to express
   * as a single Prisma query — acceptable at the claim-history volumes
   * a single project accumulates.
   */
  async getPreviousCumulativePercents(
    companyId: string,
    projectId: string,
    quotationItemIds: string[],
  ): Promise<Map<string, number>> {
    if (quotationItemIds.length === 0) return new Map();

    const items = await this.prisma.claimItem.findMany({
      where: {
        quotationItemId: { in: quotationItemIds },
        claim: { companyId, projectId, status: { in: ['certified', 'paid'] } },
      },
      include: { claim: { select: { certifiedAt: true } } },
    });

    const latest = new Map<string, { certifiedAt: Date; cumulativePercent: number }>();
    for (const item of items) {
      if (!item.quotationItemId || !item.claim.certifiedAt) continue;
      const existing = latest.get(item.quotationItemId);
      if (!existing || item.claim.certifiedAt > existing.certifiedAt) {
        latest.set(item.quotationItemId, {
          certifiedAt: item.claim.certifiedAt,
          cumulativePercent: Number(item.cumulativePercent),
        });
      }
    }
    return new Map([...latest.entries()].map(([id, v]) => [id, v.cumulativePercent]));
  }

  async updateStatus(
    companyId: string,
    id: string,
    status: ClaimStatus,
    extra: Partial<{ certifiedBy: string; certifiedAt: Date }> = {},
  ): Promise<Claim> {
    return this.prisma.claim.update({ where: { id, companyId }, data: { status, ...extra } });
  }

  /** See VariationOrdersRepository.tryTransitionStatus for why this exists. */
  async tryTransitionStatus(companyId: string, id: string, fromStatus: ClaimStatus, toStatus: ClaimStatus): Promise<boolean> {
    const result = await this.prisma.claim.updateMany({ where: { id, companyId, status: fromStatus }, data: { status: toStatus } });
    return result.count === 1;
  }

  async createPaymentCertificate(claimId: string, certificateNumber: string, amount: number): Promise<void> {
    await this.prisma.paymentCertificate.create({
      data: { claimId, certificateNumber, issuedDate: new Date(), amount },
    });
  }

  async createRetentionRecord(projectId: string, claimId: string, amountWithheld: number): Promise<void> {
    await this.prisma.retentionRecord.create({
      data: { projectId, claimId, amountWithheld, status: 'held' },
    });
  }
}
