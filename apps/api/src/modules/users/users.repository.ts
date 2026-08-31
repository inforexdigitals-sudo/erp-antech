import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';

/**
 * Read-focused for now — just what Auth needs to look up a user and
 * resolve their effective permissions. The admin-facing CRUD (invite,
 * deactivate, assign roles — module 16, User Management) lands with
 * the Settings module batch; see apps/api/README.md for what's built
 * vs. pending in this phase.
 */
@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Users are unique per (companyId, email), not globally — the same
   * email could exist at two different companies. For V1 (single
   * tenant) that's moot; a true multi-tenant login flow will need a
   * company-disambiguation step ahead of this lookup. Flagged here
   * rather than silently assuming email is globally unique.
   */
  async findActiveByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { email, isActive: true, deletedAt: null },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
  }

  /** Tenant-scoped variant of findById — for modules (e.g. Payroll) validating a referenced userId belongs to the calling company before writing anything keyed on it. */
  async findByIdForCompany(companyId: string, id: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { id, companyId, deletedAt: null },
    });
  }

  async getEffectivePermissionCodes(userId: string): Promise<string[]> {
    const rolePermissions = await this.prisma.rolePermission.findMany({
      where: { role: { userRoles: { some: { userId } } } },
      select: { permission: { select: { code: true } } },
    });
    return [...new Set(rolePermissions.map((rp) => rp.permission.code))];
  }

  async updateLastLoginAt(userId: string, when: Date): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { lastLoginAt: when } });
  }

  async updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  }

  /** Backs `GET /users` — a picker list (project manager, task assignee, ...) for every other module's forms, not User Management (module 16, still not built). */
  async findAllForCompany(companyId: string): Promise<Array<Pick<User, 'id' | 'fullName' | 'jobTitle'>>> {
    return this.prisma.user.findMany({
      where: { companyId, isActive: true, deletedAt: null },
      select: { id: true, fullName: true, jobTitle: true },
      orderBy: { fullName: 'asc' },
    });
  }

  /** Backs `GET /users/me` — self-lookup only, still tenant-scoped for defense in depth even though the caller can only ever pass their own token-derived id/companyId. */
  async findMeWithRoles(companyId: string, userId: string) {
    return this.prisma.user.findFirst({
      where: { id: userId, companyId, deletedAt: null },
      select: {
        id: true,
        fullName: true,
        email: true,
        jobTitle: true,
        avatarUrl: true,
        userRoles: { select: { role: { select: { name: true } } } },
      },
    });
  }

  // ---- Admin CRUD (User Management batch) ----

  async findByEmailInCompany(companyId: string, email: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { companyId, email, deletedAt: null } });
  }

  async createWithRoles(
    companyId: string,
    data: { fullName: string; email: string; passwordHash: string; jobTitle?: string; phone?: string; roleIds: string[] },
  ): Promise<User> {
    return this.prisma.user.create({
      data: {
        companyId,
        fullName: data.fullName,
        email: data.email,
        passwordHash: data.passwordHash,
        jobTitle: data.jobTitle,
        phone: data.phone,
        userRoles: { create: data.roleIds.map((roleId) => ({ roleId })) },
      },
    });
  }

  async findAdminList(companyId: string) {
    return this.prisma.user.findMany({
      where: { companyId, deletedAt: null },
      select: {
        id: true,
        fullName: true,
        email: true,
        jobTitle: true,
        isActive: true,
        lastLoginAt: true,
        userRoles: { select: { role: { select: { id: true, name: true } } } },
      },
      orderBy: { fullName: 'asc' },
    });
  }

  async findAdminById(companyId: string, id: string) {
    return this.prisma.user.findFirst({
      where: { id, companyId, deletedAt: null },
      select: {
        id: true,
        fullName: true,
        email: true,
        jobTitle: true,
        phone: true,
        isActive: true,
        userRoles: { select: { role: { select: { id: true, name: true } } } },
      },
    });
  }

  async updateFields(
    companyId: string,
    id: string,
    data: { fullName?: string; jobTitle?: string; phone?: string; isActive?: boolean },
  ): Promise<User> {
    return this.prisma.user.update({ where: { id, companyId }, data });
  }

  /** Replaces a user's role assignments wholesale — simpler and safer than diffing add/remove sets for what's an infrequent admin action. */
  async setRoles(userId: string, roleIds: string[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId } }),
      this.prisma.userRole.createMany({ data: roleIds.map((roleId) => ({ userId, roleId })) }),
    ]);
  }
}
