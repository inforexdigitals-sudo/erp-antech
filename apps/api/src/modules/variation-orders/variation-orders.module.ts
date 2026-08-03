import { Module } from '@nestjs/common';
import { ProjectCostingModule } from '../project-costing/project-costing.module';
import { ProjectsModule } from '../projects/projects.module';
import { VariationOrdersController } from './variation-orders.controller';
import { VariationOrdersRepository } from './variation-orders.repository';
import { VariationOrdersService } from './variation-orders.service';

@Module({
  imports: [ProjectsModule, ProjectCostingModule],
  controllers: [VariationOrdersController],
  providers: [VariationOrdersService, VariationOrdersRepository],
  exports: [VariationOrdersService],
})
export class VariationOrdersModule {}
