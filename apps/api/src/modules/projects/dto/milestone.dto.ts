import { Type } from 'class-transformer';
import { IsIn, IsISO8601, IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { MILESTONE_STATUSES, MilestoneStatus } from '../project.types';

export class CreateMilestoneDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsISO8601()
  dueDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

export class UpdateMilestoneDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsISO8601()
  dueDate?: string;

  @IsOptional()
  @IsIn(MILESTONE_STATUSES)
  status?: MilestoneStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}
