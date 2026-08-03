import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { LEAVE_REQUEST_STATUSES, LeaveRequestStatus } from '../timesheet.types';

export class QueryLeaveRequestsDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(LEAVE_REQUEST_STATUSES)
  status?: LeaveRequestStatus;

  @IsOptional()
  @IsUUID()
  userId?: string;
}
