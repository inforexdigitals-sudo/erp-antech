import { IsOptional, IsString } from 'class-validator';

/** Shared by every module's approve/reject endpoints (Quotations, Purchase Orders, ...). */
export class DecisionDto {
  @IsOptional()
  @IsString()
  comments?: string;
}
