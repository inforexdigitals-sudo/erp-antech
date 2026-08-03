import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/constants/permissions';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AuthenticatedUser } from '../../common/types/auth.types';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

/**
 * `/me` and the bare `GET /users` list are unrestricted picker routes —
 * see their own comments below. The admin CRUD (`/admin`, `POST /`,
 * `GET /:id`, `PATCH /:id`) is the real User Management surface, gated
 * by `user_management.*`.
 *
 * Route order matters within this controller: `GET /users/admin` and
 * `GET /users/me` are literal paths and MUST be declared before
 * `GET /users/:id` — Nest registers a controller's routes in
 * declaration order, and Express matches the first pattern that fits,
 * so a `:id` route declared earlier would swallow `/admin` and `/me`
 * as if `"admin"`/`"me"` were an id (see project-import.controller.ts
 * for the cross-controller version of this same hazard).
 */
@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /** No @RequirePermission — every authenticated user in the company can see colleagues' names for picking purposes (project manager, task assignee, ...). Returns only id/fullName/jobTitle, nothing sensitive. */
  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.users.list(user.companyId);
  }

  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.users.getMe(user.companyId, user.userId);
  }

  @Get('admin')
  @RequirePermission(PERMISSIONS.USER_MANAGEMENT_VIEW)
  adminList(@CurrentUser() user: AuthenticatedUser) {
    return this.users.adminList(user.companyId);
  }

  @Post()
  @RequirePermission(PERMISSIONS.USER_MANAGEMENT_CREATE)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateUserDto) {
    return this.users.create(user.companyId, user.userId, dto);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.USER_MANAGEMENT_VIEW)
  adminGet(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.adminGet(user.companyId, id);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.USER_MANAGEMENT_EDIT)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.users.update(user.companyId, user.userId, id, dto);
  }
}
