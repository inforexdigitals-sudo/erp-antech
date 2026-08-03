import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { VARIATION_ORDER_STATUSES, VariationOrderStatus } from '../variation-order.types';

export class QueryVariationOrdersDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(VARIATION_ORDER_STATUSES)
  status?: VariationOrderStatus;

  @IsOptional()
  @IsUUID()
  projectId?: string;
}
