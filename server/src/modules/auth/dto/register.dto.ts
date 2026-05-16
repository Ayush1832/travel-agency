import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
  IsEnum,
} from 'class-validator';
import { SupportedCurrency } from '../../../db/schemas/company.schema';

export class RegisterDto {
  @IsString() @IsNotEmpty() @MaxLength(200) companyName: string;

  @IsString() @IsNotEmpty() @MaxLength(100) contactPerson: string;

  @IsEmail() email: string;

  @IsString() @IsNotEmpty() phone: string;

  @IsString() @IsNotEmpty() addressLine1: string;

  @IsString() @IsOptional() addressLine2?: string;

  @IsString() @IsNotEmpty() city: string;

  @IsString() @IsOptional() state?: string;

  @IsString() @IsNotEmpty() country: string;

  @IsString() @IsNotEmpty() postalCode: string;

  @IsString() @IsOptional() taxId?: string;

  @IsString() @IsOptional() businessRegistrationNo?: string;

  @IsEnum(SupportedCurrency) @IsOptional() currency?: SupportedCurrency;

  @IsString() @MinLength(8) @MaxLength(72) password: string;
}
