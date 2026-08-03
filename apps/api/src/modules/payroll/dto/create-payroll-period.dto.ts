import { IsDateString } from 'class-validator';

export class CreatePayrollPeriodDto {
  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;
}
