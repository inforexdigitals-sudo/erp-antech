import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { PROJECT_STATUSES, ProjectStatus } from '../project.types';

export class QueryProjectsDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(PROJECT_STATUSES)
  status?: ProjectStatus;

  @IsOptional()
  @IsUUID()
  customerId?: string;
}
