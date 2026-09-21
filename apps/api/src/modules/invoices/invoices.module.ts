import { forwardRef, Module } from '@nestjs/common';
import { ClaimsModule } from '../claims/claims.module';
import { CompanyModule } from '../company/company.module';
import { InvoicePdfService } from './invoice-pdf.service';
import { InvoicesController } from './invoices.controller';
import { InvoicesRepository } from './invoices.repository';
import { InvoicesService } from './invoices.service';

/** forwardRef — see ClaimsModule's own comment on this same cycle. */
@Module({
  imports: [forwardRef(() => ClaimsModule), CompanyModule],
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoicesRepository, InvoicePdfService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
