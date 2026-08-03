import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { SuppliersModule } from '../suppliers/suppliers.module';
import { MaterialRequestsController } from './material-requests.controller';
import { MaterialRequestsRepository } from './material-requests.repository';
import { MaterialRequestsService } from './material-requests.service';
import { RfqsController } from './rfqs.controller';
import { RfqsRepository } from './rfqs.repository';
import { RfqsService } from './rfqs.service';

@Module({
  imports: [ProjectsModule, SuppliersModule],
  controllers: [MaterialRequestsController, RfqsController],
  providers: [MaterialRequestsService, MaterialRequestsRepository, RfqsService, RfqsRepository],
  exports: [MaterialRequestsRepository, MaterialRequestsService],
})
export class ProcurementModule {}
