import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { PURCHASE_ORDER_STATUSES } from '../purchase-order.types';

export class QueryPurchaseOrdersDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(PURCHASE_ORDER_STATUSES)
  status?: (typeof PURCHASE_ORDER_STATUSES)[number];

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;
}
