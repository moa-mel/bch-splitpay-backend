import {
  IsNumber,
  IsString,
  Min,
  MaxLength,
  Matches,
} from 'class-validator';

export class CreateContributionDto {
  @IsString()
  @MaxLength(120)
  contributor: string;

  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0.00000001)
  amount: number;

  @IsString()
  @Matches(/^[a-fA-F0-9]{64}$/)
  transactionId: string;
}