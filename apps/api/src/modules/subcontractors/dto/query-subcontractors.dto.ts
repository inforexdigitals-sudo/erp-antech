import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { SUBCONTRACTOR_STATUSES } from '../subcontractor.types';

export class QuerySubcontractorsDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(SUBCONTRACTOR_STATUSES)
  status?: (typeof SUBCONTRACTOR_STATUSES)[number];

  @IsOptional()
  @IsString()
  search?: string;
}
