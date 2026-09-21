import { Module } from '@nestjs/common';
import { CompanyModule } from '../company/company.module';
import { ProjectCostingModule } from '../project-costing/project-costing.module';
import { ProjectsModule } from '../projects/projects.module';
import { VariationOrderPdfService } from './variation-order-pdf.service';
import { VariationOrdersController } from './variation-orders.controller';
import { VariationOrdersRepository } from './variation-orders.repository';
import { VariationOrdersService } from './variation-orders.service';

@Module({
  imports: [ProjectsModule, ProjectCostingModule, CompanyModule],
  controllers: [VariationOrdersController],
  providers: [VariationOrdersService, VariationOrdersRepository, VariationOrderPdfService],
  exports: [VariationOrdersService],
})
export class VariationOrdersModule {}
