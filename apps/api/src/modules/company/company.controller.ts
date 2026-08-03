import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { PERMISSIONS } from '../../common/constants/permissions';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AuthenticatedUser } from '../../common/types/auth.types';
import { CompanyService } from './company.service';
import { UpdateCompanyProfileDto } from './dto/update-company-profile.dto';

/**
 * Company Profile — the address/contact/logo details every generated PDF's
 * letterhead is built from (see common/pdf/). This is not Settings & RBAC
 * (module 17, still not started) — just this one slice, reusing the
 * settings.view/settings.edit permissions 0016 already seeded but nothing
 * used until now.
 */
@ApiTags('company')
@Controller('company')
export class CompanyController {
  constructor(private readonly company: CompanyService) {}

  @Get('profile')
  @RequirePermission(PERMISSIONS.SETTINGS_VIEW)
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.company.getProfile(user.companyId);
  }

  @Patch('profile')
  @RequirePermission(PERMISSIONS.SETTINGS_EDIT)
  updateProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateCompanyProfileDto) {
    return this.company.updateProfile(user.companyId, dto);
  }

  @Post('logo')
  @RequirePermission(PERMISSIONS.SETTINGS_EDIT)
  @UseInterceptors(FileInterceptor('file'))
  uploadLogo(@CurrentUser() user: AuthenticatedUser, @UploadedFile() file?: Express.Multer.File) {
    return this.company.updateLogo(user.companyId, file);
  }

  /**
   * No @RequirePermission — every authenticated user in the company can
   * see its own logo (used for an <img> src, nothing sensitive), the
   * same reasoning as GET /users returning colleagues' names.
   */
  @Get('logo')
  async getLogo(@CurrentUser() user: AuthenticatedUser, @Res() res: Response): Promise<void> {
    const logo = await this.company.getLogo(user.companyId);
    if (!logo) {
      throw new NotFoundException('No logo has been uploaded for this company.');
    }
    res.set('Content-Type', logo.mimeType);
    res.set('Cache-Control', 'private, max-age=300');
    res.send(logo.data);
  }
}
