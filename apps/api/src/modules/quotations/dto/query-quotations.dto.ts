import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { QUOTATION_STATUSES } from '../quotation.types';

export class QueryQuotationsDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(QUOTATION_STATUSES)
  status?: (typeof QUOTATION_STATUSES)[number];

  @IsOptional()
  @IsUUID()
  customerId?: string;
}
