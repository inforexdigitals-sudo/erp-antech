import { Injectable } from '@nestjs/common';
import { ImportedFile } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';

@Injectable()
export class ProjectImportRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    companyId: string;
    fileName: string;
    mimeType: string;
    fileData: Buffer;
    extractedText: string | null;
    uploadedBy: string;
  }): Promise<ImportedFile> {
    return this.prisma.importedFile.create({ data });
  }

  async findById(companyId: string, id: string): Promise<ImportedFile | null> {
    return this.prisma.importedFile.findFirst({ where: { id, companyId } });
  }

  async list(companyId: string): Promise<ImportedFile[]> {
    return this.prisma.importedFile.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' } });
  }

  async markCompleted(companyId: string, id: string, projectId: string): Promise<ImportedFile> {
    return this.prisma.importedFile.update({
      where: { id, companyId },
      data: { status: 'completed', projectId },
    });
  }

  async markDiscarded(companyId: string, id: string): Promise<void> {
    await this.prisma.importedFile.update({ where: { id, companyId }, data: { status: 'discarded' } });
  }
}
