import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { TIMESHEET_STATUSES, TimesheetStatus } from '../timesheet.types';

export class QueryTimesheetsDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(TIMESHEET_STATUSES)
  status?: TimesheetStatus;

  @IsOptional()
  @IsUUID()
  userId?: string;
}
