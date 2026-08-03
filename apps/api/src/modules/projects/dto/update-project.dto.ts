import { IsIn, IsISO8601, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { PROJECT_STATUSES, ProjectStatus } from '../project.types';

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsUUID()
  projectManagerId?: string;

  @IsOptional()
  @IsIn(PROJECT_STATUSES)
  status?: ProjectStatus;

  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  plannedEndDate?: string;

  @IsOptional()
  @IsISO8601()
  actualEndDate?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
