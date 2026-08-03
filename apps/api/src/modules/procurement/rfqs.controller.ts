import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/constants/permissions';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AuthenticatedUser } from '../../common/types/auth.types';
import { AddRfqRecipientsDto } from './dto/add-rfq-recipients.dto';
import { CreateRfqDto } from './dto/create-rfq.dto';
import { QueryRfqsDto } from './dto/query-rfqs.dto';
import { RecordRfqResponseDto } from './dto/record-rfq-response.dto';
import { RfqsService } from './rfqs.service';

@ApiTags('rfqs')
@Controller('rfqs')
export class RfqsController {
  constructor(private readonly rfqs: RfqsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.PROCUREMENT_VIEW)
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryRfqsDto) {
    return this.rfqs.list(user.companyId, query);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.PROCUREMENT_VIEW)
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.rfqs.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermission(PERMISSIONS.PROCUREMENT_CREATE)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateRfqDto) {
    return this.rfqs.create(user.companyId, user.userId, dto);
  }

  @Post(':id/recipients')
  @RequirePermission(PERMISSIONS.PROCUREMENT_EDIT)
  addRecipients(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AddRfqRecipientsDto) {
    return this.rfqs.addRecipients(user.companyId, id, user.userId, dto);
  }

  @Post(':id/send')
  @RequirePermission(PERMISSIONS.PROCUREMENT_EDIT)
  send(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.rfqs.send(user.companyId, id, user.userId);
  }

  @Post(':id/responses')
  @RequirePermission(PERMISSIONS.PROCUREMENT_EDIT)
  recordResponse(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RecordRfqResponseDto) {
    return this.rfqs.recordResponse(user.companyId, id, user.userId, dto);
  }

  @Post(':id/responses/:responseId/select')
  @RequirePermission(PERMISSIONS.PROCUREMENT_APPROVE)
  selectResponse(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('responseId', ParseUUIDPipe) responseId: string,
  ) {
    return this.rfqs.selectResponse(user.companyId, id, user.userId, responseId);
  }
}
