import { IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class QueryDocumentsDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  relatedEntityType?: string;

  @IsOptional()
  @IsUUID()
  relatedEntityId?: string;

  @IsOptional()
  @IsUUID()
  folderId?: string;
}
