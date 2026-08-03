import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { SUPPLIER_STATUSES } from '../supplier.types';

export class QuerySuppliersDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(SUPPLIER_STATUSES)
  status?: (typeof SUPPLIER_STATUSES)[number];

  @IsOptional()
  @IsString()
  search?: string;
}
