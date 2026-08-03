import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';

/**
 * `contractQuantity` is descriptive only (matches claims schema's own
 * `contract_quantity` column, which has no unit-rate column beside it)
 * — it is not used to derive `amount`. The preparer supplies `amount`
 * directly: the dollar value being claimed this period for this BOQ
 * line, computed off whatever BOQ they're working from (the linked
 * quotation item's contract value for client claims, or the
 * subcontract BOQ for subcontractor claims — the latter isn't modeled
 * as a table in this schema, so there's nothing to derive from even if
 * we wanted to).
 */
export class ClaimItemInputDto {
  @IsOptional()
  @IsUUID()
  quotationItemId?: string;

  @IsString()
  @MinLength(1)
  description!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  contractQuantity?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  currentPercent!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;
}
