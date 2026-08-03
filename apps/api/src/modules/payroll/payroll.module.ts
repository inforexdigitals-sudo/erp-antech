import { Module } from '@nestjs/common';
import { TimesheetsModule } from '../timesheets/timesheets.module';
import { UsersModule } from '../users/users.module';
import { PayrollController } from './payroll.controller';
import { PayrollRepository } from './payroll.repository';
import { PayrollService } from './payroll.service';

@Module({
  imports: [TimesheetsModule, UsersModule],
  controllers: [PayrollController],
  providers: [PayrollService, PayrollRepository],
  exports: [PayrollService],
})
export class PayrollModule {}
