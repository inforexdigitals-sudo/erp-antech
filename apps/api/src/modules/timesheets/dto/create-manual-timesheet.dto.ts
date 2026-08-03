import { Type } from 'class-transformer';
import { IsISO8601, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

/** For office/admin entry of a day already worked — the mobile flow instead uses ClockDto via /clock-in and /clock-out. */
export class CreateManualTimesheetDto {
  @IsISO8601()
  workDate!: string;

  @IsOptional()
  @IsUUID()
  userId?: string; // defaults to the caller — an admin entering on someone else's behalf must specify it

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalHours!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  overtimeHours?: number;
}
