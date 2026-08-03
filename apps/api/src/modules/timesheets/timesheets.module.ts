import { Module } from '@nestjs/common';
import { LeaveController } from './leave.controller';
import { LeaveRepository } from './leave.repository';
import { LeaveService } from './leave.service';
import { TimesheetsController } from './timesheets.controller';
import { TimesheetsRepository } from './timesheets.repository';
import { TimesheetsService } from './timesheets.service';

@Module({
  controllers: [TimesheetsController, LeaveController],
  providers: [TimesheetsService, TimesheetsRepository, LeaveService, LeaveRepository],
  exports: [TimesheetsService, TimesheetsRepository, LeaveService],
})
export class TimesheetsModule {}
