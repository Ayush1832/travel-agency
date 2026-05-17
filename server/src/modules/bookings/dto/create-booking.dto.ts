import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  ValidateNested,
  IsInt,
  IsBoolean,
  Min,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export class GuestDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  adults?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  children?: number;

  @IsOptional()
  @IsBoolean()
  isLead?: boolean;
}

export class CreateBookingDto {
  /** Room booking code from hotel search (TBO BookingCode / roomToken) */
  @IsString()
  @IsNotEmpty()
  roomToken: string;

  @IsEnum(['online', 'credit'])
  paymentMethod: 'online' | 'credit';

  @IsOptional()
  @IsString()
  paymentId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GuestDto)
  guests: GuestDto[];

  @IsOptional()
  @IsString()
  specialRequests?: string;

  @IsOptional()
  @IsEnum(['AED', 'USD'])
  currency?: 'AED' | 'USD';
}
