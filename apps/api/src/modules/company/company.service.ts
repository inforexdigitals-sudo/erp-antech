import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Company } from '@prisma/client';
import { CompanyRepository } from './company.repository';
import { UpdateCompanyProfileDto } from './dto/update-company-profile.dto';

export type CompanyProfile = Omit<Company, 'logoData' | 'logoMimeType'> & { hasLogo: boolean };

/** Logo uploads are stored as bytes directly on the company row (see db/migrations/0020) rather than through the
 *  still-stubbed document-storage service — real S3/MinIO wiring is deferred to the jobs/integrations batch, and a
 *  single small image per tenant doesn't need that infrastructure yet. 2MB is comfortably enough for a letterhead
 *  logo and keeps the row from growing unbounded. */
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_MIME_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];

@Injectable()
export class CompanyService {
  constructor(private readonly repository: CompanyRepository) {}

  private toProfile(company: Company): CompanyProfile {
    const { logoData, logoMimeType, ...profile } = company;
    void logoMimeType; // excluded from the profile response — GET /company/logo serves it with the right Content-Type
    return { ...profile, hasLogo: logoData !== null };
  }

  async getProfile(companyId: string): Promise<CompanyProfile> {
    const company = await this.repository.findById(companyId);
    if (!company) {
      throw new NotFoundException('Company not found.');
    }
    return this.toProfile(company);
  }

  async updateProfile(companyId: string, dto: UpdateCompanyProfileDto): Promise<CompanyProfile> {
    await this.getProfile(companyId); // 404s if the company doesn't exist
    const updated = await this.repository.updateProfile(companyId, dto);
    return this.toProfile(updated);
  }

  async updateLogo(companyId: string, file: Express.Multer.File | undefined): Promise<CompanyProfile> {
    if (!file) {
      throw new BadRequestException('No file uploaded.');
    }
    if (!ALLOWED_LOGO_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Logo must be a PNG, JPEG, WebP, or SVG image.');
    }
    if (file.size > MAX_LOGO_BYTES) {
      throw new BadRequestException('Logo must be 2MB or smaller.');
    }
    await this.getProfile(companyId); // 404s if the company doesn't exist
    const updated = await this.repository.updateLogo(companyId, file.buffer, file.mimetype);
    return this.toProfile(updated);
  }

  async getLogo(companyId: string): Promise<{ data: Buffer; mimeType: string } | null> {
    const company = await this.repository.findById(companyId);
    if (!company?.logoData || !company.logoMimeType) {
      return null;
    }
    return { data: Buffer.from(company.logoData), mimeType: company.logoMimeType };
  }
}
