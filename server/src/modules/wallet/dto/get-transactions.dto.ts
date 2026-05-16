import { IsOptional, IsEnum, IsDateString, IsNumberString } from 'class-validator';
import { WalletTransactionType } from '../../../db/schemas/wallet-transaction.schema';

export class GetTransactionsDto {
  @IsOptional()
  @IsNumberString()
  page?: string;

  @IsOptional()
  @IsNumberString()
  limit?: string;

  @IsOptional()
  @IsEnum(WalletTransactionType)
  type?: WalletTransactionType;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
