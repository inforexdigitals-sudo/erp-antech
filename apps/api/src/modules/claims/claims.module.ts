import { Module } from '@nestjs/common';
import { CompanyModule } from '../company/company.module';
import { CrmModule } from '../crm/crm.module';
import { ProjectCostingModule } from '../project-costing/project-costing.module';
import { ProjectsModule } from '../projects/projects.module';
import { SubcontractorsModule } from '../subcontractors/subcontractors.module';
import { ClaimsController } from './claims.controller';
import { ClaimsRepository } from './claims.repository';
import { ClaimsService } from './claims.service';
import { PaymentCertificatePdfService } from './payment-certificate-pdf.service';

@Module({
  imports: [ProjectsModule, ProjectCostingModule, CrmModule, SubcontractorsModule, CompanyModule],
  controllers: [ClaimsController],
  providers: [ClaimsService, ClaimsRepository, PaymentCertificatePdfService],
  exports: [ClaimsService],
})
export class ClaimsModule {}
