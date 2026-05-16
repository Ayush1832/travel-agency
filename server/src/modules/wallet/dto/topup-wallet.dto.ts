import { IsEnum, IsNumber, IsUrl, Min } from 'class-validator';

export class TopUpWalletDto {
  @IsNumber()
  @Min(1)
  amount: number;

  @IsEnum(['AED', 'USD'])
  currency: 'AED' | 'USD';

  @IsUrl()
  callbackUrl: string;
}
