import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/constants/permissions';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AuthenticatedUser } from '../../common/types/auth.types';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolesService } from './roles.service';

/** The "RBAC" half of "Settings & RBAC" — reuses user_management.* (already seeded, covers "users/roles" per 0016's own description) rather than a new permissions migration. */
@ApiTags('roles')
@Controller('roles')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  @RequirePermission(PERMISSIONS.USER_MANAGEMENT_VIEW)
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.roles.list(user.companyId);
  }

  /** The full catalog of grantable permissions, for the create/edit-role checklist UI — not tenant-scoped (see RolesRepository.listAllPermissions). */
  @Get('permissions')
  @RequirePermission(PERMISSIONS.USER_MANAGEMENT_VIEW)
  listPermissions() {
    return this.roles.listPermissionCatalog();
  }

  @Post()
  @RequirePermission(PERMISSIONS.USER_MANAGEMENT_CREATE)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateRoleDto) {
    return this.roles.create(user.companyId, user.userId, dto);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.USER_MANAGEMENT_EDIT)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.roles.update(user.companyId, user.userId, id, dto);
  }
}
