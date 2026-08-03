import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateLeaveTypeDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsBoolean()
  isPaid: boolean = true;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  annualEntitlementDays: number = 0;
}
