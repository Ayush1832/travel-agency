import { IsNumber, Min } from 'class-validator';

export class RedeemLoyaltyDto {
  @IsNumber()
  @Min(1)
  points: number;
}
