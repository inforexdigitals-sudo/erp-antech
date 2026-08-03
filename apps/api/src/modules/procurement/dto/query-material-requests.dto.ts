import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { MATERIAL_REQUEST_STATUSES, MaterialRequestStatus } from '../material-request.types';

export class QueryMaterialRequestsDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(MATERIAL_REQUEST_STATUSES)
  status?: MaterialRequestStatus;

  @IsOptional()
  @IsUUID()
  projectId?: string;
}
