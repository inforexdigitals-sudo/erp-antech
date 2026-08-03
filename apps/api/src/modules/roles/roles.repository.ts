import { Injectable } from '@nestjs/common';
import { Permission, Role } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';

@Injectable()
export class RolesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listWithPermissions(companyId: string) {
    return this.prisma.role.findMany({
      where: { companyId },
      select: {
        id: true,
        name: true,
        description: true,
        isSystemRole: true,
        rolePermissions: { select: { permission: { select: { id: true, code: true } } } },
        _count: { select: { userRoles: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findById(companyId: string, id: string): Promise<Role | null> {
    return this.prisma.role.findFirst({ where: { id, companyId } });
  }

  async findByIdWithPermissions(companyId: string, id: string) {
    return this.prisma.role.findFirst({
      where: { id, companyId },
      select: {
        id: true,
        name: true,
        description: true,
        isSystemRole: true,
        rolePermissions: { select: { permission: { select: { id: true, code: true } } } },
        _count: { select: { userRoles: true } },
      },
    });
  }

  async findByName(companyId: string, name: string): Promise<Role | null> {
    return this.prisma.role.findFirst({ where: { companyId, name } });
  }

  /** The global permission catalog (not tenant-scoped — `permissions` seeds once for the whole deployment, see db/migrations/0016). */
  async listAllPermissions(): Promise<Permission[]> {
    return this.prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { action: 'asc' }] });
  }

  async createWithPermissions(
    companyId: string,
    data: { name: string; description?: string; permissionIds: string[] },
  ): Promise<Role> {
    return this.prisma.role.create({
      data: {
        companyId,
        name: data.name,
        description: data.description,
        rolePermissions: { create: data.permissionIds.map((permissionId) => ({ permissionId })) },
      },
    });
  }

  async updateFields(companyId: string, id: string, data: { name?: string; description?: string }): Promise<Role> {
    return this.prisma.role.update({ where: { id, companyId }, data });
  }

  async setPermissions(roleId: string, permissionIds: string[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId } }),
      this.prisma.rolePermission.createMany({ data: permissionIds.map((permissionId) => ({ roleId, permissionId })) }),
    ]);
  }
}
