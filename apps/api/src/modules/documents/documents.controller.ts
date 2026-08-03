import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/constants/permissions';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AuthenticatedUser } from '../../common/types/auth.types';
import { AddDocumentVersionDto } from './dto/add-document-version.dto';
import { CreateDocumentDto } from './dto/create-document.dto';
import { CreateDocumentFolderDto } from './dto/create-document-folder.dto';
import { GrantDocumentPermissionDto } from './dto/grant-document-permission.dto';
import { QueryDocumentsDto } from './dto/query-documents.dto';
import { DocumentsService } from './documents.service';

@ApiTags('documents')
@Controller()
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get('document-folders')
  @RequirePermission(PERMISSIONS.DOCUMENT_VIEW)
  listFolders(
    @CurrentUser() user: AuthenticatedUser,
    @Query('relatedEntityType') relatedEntityType?: string,
    @Query('relatedEntityId') relatedEntityId?: string,
  ) {
    return this.documents.listFolders(user.companyId, { relatedEntityType, relatedEntityId });
  }

  @Post('document-folders')
  @RequirePermission(PERMISSIONS.DOCUMENT_CREATE)
  createFolder(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateDocumentFolderDto) {
    return this.documents.createFolder(user.companyId, user.userId, dto);
  }

  @Get('documents')
  @RequirePermission(PERMISSIONS.DOCUMENT_VIEW)
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryDocumentsDto) {
    return this.documents.list(user.companyId, query);
  }

  @Get('documents/:id')
  @RequirePermission(PERMISSIONS.DOCUMENT_VIEW)
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.documents.findOne(user.companyId, id);
  }

  @Post('documents')
  @RequirePermission(PERMISSIONS.DOCUMENT_CREATE)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateDocumentDto) {
    return this.documents.createDocument(user.companyId, user.userId, dto);
  }

  @Post('documents/:id/versions')
  @RequirePermission(PERMISSIONS.DOCUMENT_CREATE)
  addVersion(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AddDocumentVersionDto) {
    return this.documents.addVersion(user.companyId, id, user.userId, dto);
  }

  @Get('documents/:id/download-url')
  @RequirePermission(PERMISSIONS.DOCUMENT_VIEW)
  async getDownloadUrl(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    const document = await this.documents.findOne(user.companyId, id);
    return { url: this.documents.getDownloadUrl(document) };
  }

  @Post('documents/:id/permissions')
  @RequirePermission(PERMISSIONS.DOCUMENT_CREATE)
  grantPermission(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: GrantDocumentPermissionDto) {
    return this.documents.grantPermission(user.companyId, id, user.userId, dto);
  }

  @Delete('documents/:id/permissions/:permissionId')
  @RequirePermission(PERMISSIONS.DOCUMENT_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  revokePermission(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('permissionId', ParseUUIDPipe) permissionId: string,
  ) {
    return this.documents.revokePermission(user.companyId, id, permissionId, user.userId);
  }
}
