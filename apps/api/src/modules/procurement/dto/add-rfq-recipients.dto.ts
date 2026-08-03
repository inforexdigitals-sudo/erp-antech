import { ArrayMinSize, ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class AddRfqRecipientsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  supplierIds!: string[];
}
