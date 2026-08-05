import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { PERMISSIONS } from '../../common/constants/permissions';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AuthenticatedUser } from '../../common/types/auth.types';
import { CreateQuotationDto } from '../quotations/dto/create-quotation.dto';
import { ProjectImportService } from './project-import.service';

/**
 * Deliberately NOT nested under /projects (e.g. not `/projects/import`) —
 * `ProjectsController` already has `GET /projects/:id`, and Express/Nest
 * route matching is first-match-wins in registration order, not
 * specificity-ranked like React Router. `GET /projects/import` would risk
 * being swallowed by `GET /projects/:id` (id="import") depending on
 * module import order — a real, easy-to-hit bug, not a hypothetical one.
 * `/project-imports` sidesteps it entirely.
 */
@ApiTags('project-import')
@Controller('project-imports')
export class ProjectImportController {
  constructor(private readonly projectImport: ProjectImportService) {}

  @Post('extract')
  @RequirePermission(PERMISSIONS.PROJECT_CREATE)
  @UseInterceptors(FileInterceptor('file'))
  extract(@CurrentUser() user: AuthenticatedUser, @UploadedFile() file?: Express.Multer.File) {
    return this.projectImport.extract(user.companyId, user.userId, file);
  }

  @Get()
  @RequirePermission(PERMISSIONS.PROJECT_VIEW)
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.projectImport.list(user.companyId);
  }

  /** No @RequirePermission override needed beyond PROJECT_VIEW — streams the original file inline so it can preview in a new tab. */
  @Get(':id/file')
  @RequirePermission(PERMISSIONS.PROJECT_VIEW)
  async downloadFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.projectImport.getFile(user.companyId, id);
    res.set({
      'Content-Type': file.mimeType,
      'Content-Disposition': `inline; filename="${file.fileName}"`,
    });
    res.send(file.data);
  }

  @Post(':id/confirm')
  @RequirePermission(PERMISSIONS.PROJECT_CREATE)
  confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateQuotationDto,
  ) {
    return this.projectImport.confirm(user.companyId, user.userId, id, dto);
  }
}
