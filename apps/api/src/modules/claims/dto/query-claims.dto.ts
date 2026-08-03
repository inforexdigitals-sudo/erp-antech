import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { CLAIM_STATUSES, ClaimStatus } from '../claim.types';

export class QueryClaimsDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(CLAIM_STATUSES)
  status?: ClaimStatus;

  @IsOptional()
  @IsUUID()
  projectId?: string;
}
