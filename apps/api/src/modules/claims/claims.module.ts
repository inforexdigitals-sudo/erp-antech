import { forwardRef, Module } from '@nestjs/common';
import { CompanyModule } from '../company/company.module';
import { CrmModule } from '../crm/crm.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { ProjectCostingModule } from '../project-costing/project-costing.module';
import { ProjectsModule } from '../projects/projects.module';
import { SubcontractorsModule } from '../subcontractors/subcontractors.module';
import { ClaimsController } from './claims.controller';
import { ClaimsRepository } from './claims.repository';
import { ClaimsService } from './claims.service';
import { PaymentCertificatePdfService } from './payment-certificate-pdf.service';

/**
 * forwardRef with InvoicesModule: InvoicesModule already imports
 * ClaimsModule (InvoicesService.createFromClaim needs ClaimsService),
 * and ClaimsService.remove() now needs InvoicesService too — to delete a
 * certified client claim's invoice so it doesn't dangle when the claim
 * that created it is deleted. A straight import either direction would
 * be circular.
 */
@Module({
  imports: [ProjectsModule, ProjectCostingModule, CrmModule, SubcontractorsModule, CompanyModule, forwardRef(() => InvoicesModule)],
  controllers: [ClaimsController],
  providers: [ClaimsService, ClaimsRepository, PaymentCertificatePdfService],
  exports: [ClaimsService],
})
export class ClaimsModule {}
