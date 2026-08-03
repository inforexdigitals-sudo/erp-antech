import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Permission } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolesRepository } from './roles.repository';

type RoleWithPermissions = Awaited<ReturnType<RolesRepository['listWithPermissions']>>[number];

@Injectable()
export class RolesService {
  constructor(
    private readonly repository: RolesRepository,
    private readonly audit: AuditService,
  ) {}

  private toSummary(role: RoleWithPermissions) {
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      isSystemRole: role.isSystemRole,
      permissionIds: role.rolePermissions.map((rp) => rp.permission.id),
      permissionCodes: role.rolePermissions.map((rp) => rp.permission.code),
      userCount: role._count.userRoles,
    };
  }

  async list(companyId: string) {
    const roles = await this.repository.listWithPermissions(companyId);
    return roles.map((r) => this.toSummary(r));
  }

  async listPermissionCatalog(): Promise<Permission[]> {
    return this.repository.listAllPermissions();
  }

  async getOne(companyId: string, id: string) {
    const role = await this.repository.findByIdWithPermissions(companyId, id);
    if (!role) {
      throw new NotFoundException('Role not found.');
    }
    return this.toSummary(role);
  }

  async create(companyId: string, actorUserId: string, dto: CreateRoleDto) {
    const existing = await this.repository.findByName(companyId, dto.name);
    if (existing) {
      throw new BadRequestException('A role with this name already exists.');
    }
    const role = await this.repository.createWithPermissions(companyId, dto);
    await this.audit.record({
      companyId,
      actorUserId,
      action: 'create',
      entityType: 'role',
      entityId: role.id,
      after: { name: role.name, permissionIds: dto.permissionIds },
    });
    return this.getOne(companyId, role.id);
  }

  async update(companyId: string, actorUserId: string, id: string, dto: UpdateRoleDto) {
    const existing = await this.repository.findById(companyId, id);
    if (!existing) {
      throw new NotFoundException('Role not found.');
    }
    // The seeded "Owner" role must always retain full access — editing it
    // (renaming it or, worse, unchecking permissions) risks locking every
    // admin in the company out of their own settings with no way back in,
    // since there's no "recover access" flow. Custom roles have no such
    // restriction.
    if (existing.isSystemRole) {
      throw new ForbiddenException('The Owner role cannot be edited.');
    }

    const before = await this.getOne(companyId, id);
    const { permissionIds, ...fields } = dto;
    if (Object.keys(fields).length > 0) {
      await this.repository.updateFields(companyId, id, fields);
    }
    if (permissionIds) {
      await this.repository.setPermissions(id, permissionIds);
    }
    const after = await this.getOne(companyId, id);
    await this.audit.record({
      companyId,
      actorUserId,
      action: 'update',
      entityType: 'role',
      entityId: id,
      before,
      after,
    });
    return after;
  }
}
