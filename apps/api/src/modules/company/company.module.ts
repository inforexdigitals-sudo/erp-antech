import { Module } from '@nestjs/common';
import { CompanyController } from './company.controller';
import { CompanyRepository } from './company.repository';
import { CompanyService } from './company.service';

@Module({
  controllers: [CompanyController],
  providers: [CompanyRepository, CompanyService],
  exports: [CompanyRepository],
})
export class CompanyModule {}
