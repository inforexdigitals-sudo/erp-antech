import { ArrayMinSize, IsArray, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Grant at least one permission.' })
  @IsUUID('4', { each: true })
  permissionIds!: string[];
}
