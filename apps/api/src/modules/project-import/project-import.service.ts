import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ImportedFile } from '@prisma/client';
import { PDFParse } from 'pdf-parse';
import { CustomersRepository } from '../crm/customers.repository';
import { ProjectWithDetail } from '../projects/projects.repository';
import { CreateQuotationDto } from '../quotations/dto/create-quotation.dto';
import { QuotationsService } from '../quotations/quotations.service';
import { extractSuggestions, ImportSuggestions } from './extract-suggestions.util';
import { ProjectImportRepository } from './project-import.repository';

/** Generous enough for a scanned multi-page quotation/contract, small enough to keep a Postgres row (bytes stored directly, see db/migrations/0022) reasonable. */
const MAX_IMPORT_BYTES = 15 * 1024 * 1024;

export type ImportedFileSummary = Omit<ImportedFile, 'fileData'>;

/**
 * Digitizing historical Excel/PDF records — by explicit request. Upload
 * an old quotation/project PDF, extract its text, guess a few fields
 * (extract-suggestions.util.ts), and let the caller review/correct
 * before a real Project is created. Nothing is written to `projects`
 * until /confirm is called with the (possibly corrected) final values —
 * see ProjectImportController.
 */
@Injectable()
export class ProjectImportService {
  constructor(
    private readonly repository: ProjectImportRepository,
    private readonly customers: CustomersRepository,
    private readonly quotations: QuotationsService,
  ) {}

  private toSummary(row: ImportedFile): ImportedFileSummary {
    const { fileData, ...summary } = row;
    void fileData; // excluded from every response — binary bytes have no business in a JSON body; see getFile() for the real download route
    return summary;
  }

  async extract(
    companyId: string,
    uploadedBy: string,
    file: Express.Multer.File | undefined,
  ): Promise<{ import: ImportedFileSummary; suggestions: ImportSuggestions }> {
    if (!file) {
      throw new BadRequestException('No file uploaded.');
    }
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Only PDF files are supported right now.');
    }
    if (file.size > MAX_IMPORT_BYTES) {
      throw new BadRequestException('File must be 15MB or smaller.');
    }

    const parser = new PDFParse({ data: file.buffer });
    const text = await parser
      .getText()
      .then((result) => result.text ?? '')
      .catch(() => '')
      .finally(() => parser.destroy());
    const trimmedText = text.trim();

    const row = await this.repository.create({
      companyId,
      fileName: file.originalname,
      mimeType: file.mimetype,
      fileData: file.buffer,
      extractedText: trimmedText || null,
      uploadedBy,
    });

    const customerList = await this.customers.findNamesForCompany(companyId);
    const suggestions = extractSuggestions(file.originalname, trimmedText, customerList);

    return { import: this.toSummary(row), suggestions };
  }

  async list(companyId: string): Promise<ImportedFileSummary[]> {
    const rows = await this.repository.list(companyId);
    return rows.map((r) => this.toSummary(r));
  }

  async getFile(companyId: string, id: string): Promise<{ data: Buffer; mimeType: string; fileName: string }> {
    const row = await this.repository.findById(companyId, id);
    if (!row) {
      throw new NotFoundException('Imported file not found.');
    }
    return { data: Buffer.from(row.fileData), mimeType: row.mimeType, fileName: row.fileName };
  }

  async confirm(
    companyId: string,
    actorUserId: string,
    importId: string,
    dto: CreateQuotationDto,
  ): Promise<ProjectWithDetail> {
    const row = await this.repository.findById(companyId, importId);
    if (!row) {
      throw new NotFoundException('Imported file not found.');
    }
    if (row.status !== 'pending_review') {
      throw new BadRequestException('This import has already been processed.');
    }

    // Reuses the real, validated quotation+project-creation path (tenant-owned
    // customer check, pricing, numbering, audit log, etc.) rather than inserting
    // rows directly — an imported project has a real itemized quotation behind
    // it afterward, same as one created by hand. See
    // QuotationsService.createHistoricalProject for why this skips the normal
    // draft→sent→accepted lifecycle.
    const project = await this.quotations.createHistoricalProject(companyId, actorUserId, dto);
    await this.repository.markCompleted(companyId, importId, project.id);
    return project;
  }

  async discard(companyId: string, id: string): Promise<void> {
    const row = await this.repository.findById(companyId, id);
    if (!row) {
      throw new NotFoundException('Imported file not found.');
    }
    await this.repository.markDiscarded(companyId, id);
  }
}
