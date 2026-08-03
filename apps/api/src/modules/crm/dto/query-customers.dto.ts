import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { CUSTOMER_STATUSES } from '../customer.types';

export class QueryCustomersDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(CUSTOMER_STATUSES)
  status?: (typeof CUSTOMER_STATUSES)[number];

  @IsOptional()
  @IsString()
  search?: string;
}
