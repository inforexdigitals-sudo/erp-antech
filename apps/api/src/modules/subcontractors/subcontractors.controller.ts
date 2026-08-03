import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/constants/permissions';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AuthenticatedUser } from '../../common/types/auth.types';
import { CreateSubcontractorDto } from './dto/create-subcontractor.dto';
import { QuerySubcontractorsDto } from './dto/query-subcontractors.dto';
import { UpdateSubcontractorDto } from './dto/update-subcontractor.dto';
import { SubcontractorsService } from './subcontractors.service';

@ApiTags('subcontractors')
@Controller('subcontractors')
export class SubcontractorsController {
  constructor(private readonly subcontractors: SubcontractorsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.PURCHASE_ORDER_VIEW)
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: QuerySubcontractorsDto) {
    return this.subcontractors.list(user.companyId, query);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.PURCHASE_ORDER_VIEW)
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.subcontractors.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermission(PERMISSIONS.PURCHASE_ORDER_CREATE)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSubcontractorDto) {
    return this.subcontractors.create(user.companyId, user.userId, dto);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.PURCHASE_ORDER_EDIT)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSubcontractorDto,
  ) {
    return this.subcontractors.update(user.companyId, id, user.userId, dto);
  }

  @Delete(':id')
  @RequirePermission(PERMISSIONS.PURCHASE_ORDER_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.subcontractors.remove(user.companyId, id, user.userId);
  }
}
