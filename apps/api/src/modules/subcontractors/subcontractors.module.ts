import { Module } from '@nestjs/common';
import { SubcontractorsController } from './subcontractors.controller';
import { SubcontractorsRepository } from './subcontractors.repository';
import { SubcontractorsService } from './subcontractors.service';

@Module({
  controllers: [SubcontractorsController],
  providers: [SubcontractorsService, SubcontractorsRepository],
  exports: [SubcontractorsRepository],
})
export class SubcontractorsModule {}
