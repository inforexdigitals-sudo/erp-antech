import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuditService } from '../../common/audit/audit.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(
    private readonly repository: UsersRepository,
    private readonly audit: AuditService,
  ) {}

  async list(companyId: string) {
    return this.repository.findAllForCompany(companyId);
  }

  async getMe(companyId: string, userId: string) {
    const user = await this.repository.findMeWithRoles(companyId, userId);
    if (!user) {
      throw new NotFoundException('User not found.');
    }
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      jobTitle: user.jobTitle,
      avatarUrl: user.avatarUrl,
      roles: user.userRoles.map((ur) => ur.role.name),
    };
  }

  // ---- Admin CRUD (User Management batch) ----

  async adminList(companyId: string) {
    const users = await this.repository.findAdminList(companyId);
    return users.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      jobTitle: u.jobTitle,
      isActive: u.isActive,
      lastLoginAt: u.lastLoginAt,
      roles: u.userRoles.map((ur) => ur.role),
    }));
  }

  async adminGet(companyId: string, id: string) {
    const user = await this.repository.findAdminById(companyId, id);
    if (!user) {
      throw new NotFoundException('User not found.');
    }
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      jobTitle: user.jobTitle,
      phone: user.phone,
      isActive: user.isActive,
      roleIds: user.userRoles.map((ur) => ur.role.id),
      roles: user.userRoles.map((ur) => ur.role),
    };
  }

  async create(companyId: string, actorUserId: string, dto: CreateUserDto) {
    const existing = await this.repository.findByEmailInCompany(companyId, dto.email);
    if (existing) {
      throw new BadRequestException('A user with this email already exists.');
    }

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.repository.createWithRoles(companyId, {
      fullName: dto.fullName,
      email: dto.email,
      passwordHash,
      jobTitle: dto.jobTitle,
      phone: dto.phone,
      roleIds: dto.roleIds,
    });

    await this.audit.record({
      companyId,
      actorUserId,
      action: 'create',
      entityType: 'user',
      entityId: user.id,
      after: { fullName: user.fullName, email: user.email },
    });

    return this.adminGet(companyId, user.id);
  }

  async update(companyId: string, actorUserId: string, id: string, dto: UpdateUserDto) {
    const before = await this.adminGet(companyId, id);

    // Two hard self-lockout cases guarded against — anything softer (e.g.
    // reassigning yourself to a role that lacks user_management.edit) is
    // still possible; an Owner account managing its own access is assumed
    // to know what it's doing beyond these two unambiguous cases.
    if (id === actorUserId) {
      if (dto.isActive === false) {
        throw new ForbiddenException("You can't deactivate your own account.");
      }
      if (dto.roleIds && dto.roleIds.length === 0) {
        throw new ForbiddenException("You can't remove all of your own roles.");
      }
    }

    const { roleIds, ...fields } = dto;
    if (Object.keys(fields).length > 0) {
      await this.repository.updateFields(companyId, id, fields);
    }
    if (roleIds) {
      await this.repository.setRoles(id, roleIds);
    }

    const after = await this.adminGet(companyId, id);
    await this.audit.record({
      companyId,
      actorUserId,
      action: 'update',
      entityType: 'user',
      entityId: id,
      before,
      after,
    });
    return after;
  }
}
