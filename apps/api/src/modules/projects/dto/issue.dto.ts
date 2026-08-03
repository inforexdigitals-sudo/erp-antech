import { IsIn, IsISO8601, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { ISSUE_SEVERITIES, ISSUE_STATUSES, IssueSeverity, IssueStatus } from '../project.types';

export class CreateIssueDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(ISSUE_SEVERITIES)
  severity: IssueSeverity = 'medium';

  @IsOptional()
  @IsUUID()
  assignedTo?: string;

  @IsOptional()
  @IsISO8601()
  dueDate?: string;
}

export class UpdateIssueDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(ISSUE_SEVERITIES)
  severity?: IssueSeverity;

  @IsOptional()
  @IsIn(ISSUE_STATUSES)
  status?: IssueStatus;

  @IsOptional()
  @IsUUID()
  assignedTo?: string;

  @IsOptional()
  @IsISO8601()
  dueDate?: string;
}
