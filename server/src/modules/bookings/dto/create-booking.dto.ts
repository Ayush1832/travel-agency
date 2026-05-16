import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  ValidateNested,
  IsInt,
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

  @IsInt()
  @Min(1)
  adults: number;

  @IsInt()
  @Min(0)
  children: number;
}

export class CreateBookingDto {
  @IsString()
  @IsNotEmpty()
  prebookToken: string;

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

  @IsEnum(['AED', 'USD'])
  currency: 'AED' | 'USD';
}
