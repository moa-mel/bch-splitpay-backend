import { ArrayMaxSize, ArrayMinSize, IsArray, IsNumber, IsString, Matches, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class RecipientDto {
  @IsString()
  name: string;

  @IsString()
  @Matches(/^[a-zA-Z0-9:_-]{10,120}$/)
  address: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  percentage: number;
}

export class PreviewSplitDto {
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0.00000001)
  totalAmount: number;

  @IsArray()
  @ArrayMaxSize(2)
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => RecipientDto)
  recipients: RecipientDto[];
}
