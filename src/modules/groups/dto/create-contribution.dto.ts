import { IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';

export class CreateContributionDto {
  @IsString()
  @MaxLength(120)
  contributor: string;

  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0.00000001)
  amount: number;

  @IsOptional()
  @IsString()
  transactionId?: string;
}
