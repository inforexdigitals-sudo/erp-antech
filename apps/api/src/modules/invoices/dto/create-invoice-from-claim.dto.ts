import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, Min } from 'class-validator';

/**
 * FR-13.3 — "Invoice export (claim → invoice)": the only invoice
 * creation path in this batch. There is no free-standing "create
 * invoice from scratch" endpoint — every invoice traces back to a
 * certified client claim (see ClaimsService for why subcontractor
 * claims never reach here).
 */
export class CreateInvoiceFromClaimDto {
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  /**
   * Tax isn't derived automatically — the claim's net amount has no
   * linked tax_code (claims/claim_items carry no tax_code_id, unlike
   * quotation_items), so there's nothing to compute a rate from without
   * guessing. The preparer supplies the amount directly.
   */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  taxAmount?: number;
}
