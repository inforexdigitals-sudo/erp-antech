import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

/**
 * Stubbed — same tier as QuotationDeliveryService/SupplierNotificationService
 * (see apps/api/README.md). The endpoint contracts (`POST /documents`,
 * `GET /documents/:id/download-url`) are real and frontend-integrable
 * now; actual S3/MinIO wiring (presigned PUT for upload, presigned GET
 * for download) is deferred to the jobs/integrations infrastructure
 * batch already flagged in docs/phase-3-system-architecture/architecture-overview.md §3,
 * even though infra/docker/docker-compose.yml already provisions a
 * MinIO container for it. Building a real presigned-URL flow here
 * would mean adding an S3 SDK dependency and credentials this session
 * can't verify end-to-end against a running instance — flagged rather
 * than half-wired.
 */
@Injectable()
export class DocumentStorageService {
  private readonly logger = new Logger(DocumentStorageService.name);

  generateStorageKey(companyId: string, fileName: string): string {
    this.logger.warn(`Stub storage: no real object-storage upload occurred for "${fileName}" (company ${companyId}).`);
    return `companies/${companyId}/${randomUUID()}-${fileName}`;
  }

  getDownloadUrl(storageKey: string): string {
    this.logger.warn(`Stub storage: returning a fake download reference for "${storageKey}".`);
    return `stub://object-storage-not-configured/${storageKey}`;
  }
}
