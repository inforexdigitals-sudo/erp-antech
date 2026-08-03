import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * Offset/limit pagination for standard list endpoints — see
 * docs/phase-3-system-architecture/api-architecture.md §2. Ledger-style
 * endpoints (none in this batch) use cursor pagination instead and
 * define their own query DTO.
 */
export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 25;

  @IsOptional()
  @IsString()
  sort?: string;

  get skip(): number {
    return (this.page - 1) * this.pageSize;
  }

  get take(): number {
    return this.pageSize;
  }
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
  };
}

export function paginate<T>(data: T[], total: number, query: PaginationQueryDto): PaginatedResult<T> {
  return {
    data,
    meta: { total, page: query.page, pageSize: query.pageSize },
  };
}
