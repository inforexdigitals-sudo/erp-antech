import { Module } from '@nestjs/common';
import { CompanyModule } from '../company/company.module';
import { CrmModule } from '../crm/crm.module';
import { ProjectsModule } from '../projects/projects.module';
import { QuotationDeliveryService } from './quotation-delivery.service';
import { QuotationPdfService } from './quotation-pdf.service';
import { QuotationsController } from './quotations.controller';
import { QuotationsRepository } from './quotations.repository';
import { QuotationsService } from './quotations.service';

@Module({
  imports: [CrmModule, ProjectsModule, CompanyModule],
  controllers: [QuotationsController],
  providers: [QuotationsService, QuotationsRepository, QuotationDeliveryService, QuotationPdfService],
  exports: [QuotationsService, QuotationsRepository],
})
export class QuotationsModule {}
