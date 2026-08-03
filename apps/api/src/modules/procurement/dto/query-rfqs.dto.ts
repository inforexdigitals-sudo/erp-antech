import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { RFQ_STATUSES, RfqStatus } from '../rfq.types';

export class QueryRfqsDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(RFQ_STATUSES)
  status?: RfqStatus;

  @IsOptional()
  @IsUUID()
  projectId?: string;
}
