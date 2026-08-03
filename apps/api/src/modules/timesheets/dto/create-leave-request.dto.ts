import { Type } from 'class-transformer';
import { IsISO8601, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

/**
 * `days` is supplied by the caller rather than computed from the date
 * range — a correct business-day calculator needs a public-holiday
 * calendar this schema doesn't have yet, and getting that wrong
 * silently (e.g. always counting weekends) would be worse than asking
 * for the number directly, matching how leave_requests.days
 * (db/migrations/0010) is just a plain column, not a generated one.
 */
export class CreateLeaveRequestDto {
  @IsUUID()
  leaveTypeId!: string;

  @IsISO8601()
  startDate!: string;

  @IsISO8601()
  endDate!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.5)
  days!: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
