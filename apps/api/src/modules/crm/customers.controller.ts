import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/constants/permissions';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AuthenticatedUser } from '../../common/types/auth.types';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { QueryCustomersDto } from './dto/query-customers.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

/**
 * A minimal Customers surface — create/edit/list/delete a customer
 * record (name, registration number, industry, billing address,
 * status). Added by explicit request once the app had real modules
 * (Quotations, Projects, Claims) that needed real customers to pick
 * from, not the 3 seeded demo ones. Still not full CRM (module 2): no
 * contacts, leads, opportunities, or communications — see
 * apps/api/README.md.
 */
@ApiTags('crm')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @RequirePermission(PERMISSIONS.CRM_VIEW)
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryCustomersDto) {
    return this.customers.list(user.companyId, query);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.CRM_VIEW)
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.customers.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermission(PERMISSIONS.CRM_CREATE)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCustomerDto) {
    return this.customers.create(user.companyId, user.userId, dto);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.CRM_EDIT)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customers.update(user.companyId, id, user.userId, dto);
  }

  @Delete(':id')
  @RequirePermission(PERMISSIONS.CRM_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.customers.remove(user.companyId, id, user.userId);
  }
}
