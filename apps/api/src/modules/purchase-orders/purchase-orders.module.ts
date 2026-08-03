import { Module } from '@nestjs/common';
import { CompanyModule } from '../company/company.module';
import { ProcurementModule } from '../procurement/procurement.module';
import { ProjectCostingModule } from '../project-costing/project-costing.module';
import { ProjectsModule } from '../projects/projects.module';
import { SuppliersModule } from '../suppliers/suppliers.module';
import { PurchaseOrderPdfService } from './purchase-order-pdf.service';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrdersRepository } from './purchase-orders.repository';
import { PurchaseOrdersService } from './purchase-orders.service';
import { SupplierNotificationService } from './supplier-notification.service';

@Module({
  imports: [SuppliersModule, ProjectsModule, ProjectCostingModule, ProcurementModule, CompanyModule],
  controllers: [PurchaseOrdersController],
  providers: [PurchaseOrdersService, PurchaseOrdersRepository, SupplierNotificationService, PurchaseOrderPdfService],
  exports: [PurchaseOrdersService],
})
export class PurchaseOrdersModule {}
