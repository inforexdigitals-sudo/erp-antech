import { IsOptional, IsString, IsUUID } from 'class-validator';

export class AddTeamMemberDto {
  @IsUUID()
  userId!: string;

  @IsOptional()
  @IsString()
  roleOnProject?: string;
}
