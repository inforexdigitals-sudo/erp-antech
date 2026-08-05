import { Module } from '@nestjs/common';
import { CrmModule } from '../crm/crm.module';
import { ProjectsModule } from '../projects/projects.module';
import { QuotationsModule } from '../quotations/quotations.module';
import { ProjectImportController } from './project-import.controller';
import { ProjectImportRepository } from './project-import.repository';
import { ProjectImportService } from './project-import.service';

@Module({
  imports: [CrmModule, ProjectsModule, QuotationsModule],
  controllers: [ProjectImportController],
  providers: [ProjectImportService, ProjectImportRepository],
})
export class ProjectImportModule {}
