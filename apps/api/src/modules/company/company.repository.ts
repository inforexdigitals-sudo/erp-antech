import { Injectable } from '@nestjs/common';
import { Company } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { UpdateCompanyProfileDto } from './dto/update-company-profile.dto';

@Injectable()
export class CompanyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Company | null> {
    return this.prisma.company.findUnique({ where: { id } });
  }

  async updateProfile(id: string, data: UpdateCompanyProfileDto): Promise<Company> {
    return this.prisma.company.update({ where: { id }, data });
  }

  async updateLogo(id: string, logoData: Buffer, logoMimeType: string): Promise<Company> {
    return this.prisma.company.update({ where: { id }, data: { logoData, logoMimeType } });
  }
}
