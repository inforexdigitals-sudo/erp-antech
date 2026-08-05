import { Type } from 'class-transformer';
import { IsISO8601, IsNumber, IsOptional, Min } from 'class-validator';

/**
 * Only dueDate and taxAmount — an invoice has no line items of its own to
 * revise (its subtotal is pulled straight from the certified claim it was
 * created from, see InvoicesService.createFromClaim); the amount itself
 * can only change by adjusting the claim.
 */
export class UpdateInvoiceDto {
  @IsOptional()
  @IsISO8601()
  dueDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  taxAmount?: number;
}
