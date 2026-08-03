import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { QuotationsModule } from '../quotations/quotations.module';
import { ProjectCostingController } from './project-costing.controller';
import { ProjectCostingRepository } from './project-costing.repository';
import { CostingService } from './project-costing.service';

@Module({
  imports: [ProjectsModule, QuotationsModule],
  controllers: [ProjectCostingController],
  providers: [CostingService, ProjectCostingRepository],
  exports: [CostingService],
})
export class ProjectCostingModule {}
