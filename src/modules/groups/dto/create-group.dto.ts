import { IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';

export class CreateGroupDto {
  @IsString()
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0.00000001)
  targetAmount: number;

  @IsOptional()
  @IsString()
  creatorAddress?: string;
}
