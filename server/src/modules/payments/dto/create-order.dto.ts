import { IsEnum, IsNumber, IsOptional, IsString, IsUrl, Min } from 'class-validator';
import { PaymentType } from '../../../db/schemas/payment.schema';

export class CreateOrderDto {
  @IsNumber()
  @Min(1)
  amount: number;

  @IsEnum(['AED', 'USD'])
  currency: 'AED' | 'USD';

  @IsEnum([PaymentType.BOOKING_ONLINE, PaymentType.WALLET_TOPUP])
  type: PaymentType.BOOKING_ONLINE | PaymentType.WALLET_TOPUP;

  @IsOptional()
  @IsString()
  bookingId?: string;

  @IsUrl()
  callbackUrl: string;
}
