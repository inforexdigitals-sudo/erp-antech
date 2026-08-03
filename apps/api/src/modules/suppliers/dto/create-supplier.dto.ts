import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { SUPPLIER_STATUSES } from '../supplier.types';

export class CreateSupplierDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsIn(SUPPLIER_STATUSES)
  status?: (typeof SUPPLIER_STATUSES)[number];

  @IsOptional()
  @IsString()
  paymentTerms?: string;
}
