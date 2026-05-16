import {
  IsString,
  IsDateString,
  IsArray,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RoomOccupancy {
  @IsInt()
  @Min(1)
  @Max(9)
  adults: number;

  @IsInt()
  @Min(0)
  @Max(6)
  children: number;

  @IsArray()
  @IsOptional()
  @IsInt({ each: true })
  childrenAges?: number[];
}

export class HotelSearchDto {
  @IsString()
  destination: string;

  @IsOptional()
  @IsString()
  cityId?: string;

  @IsDateString()
  checkIn: string;

  @IsDateString()
  checkOut: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(9)
  @ValidateNested({ each: true })
  @Type(() => RoomOccupancy)
  rooms: RoomOccupancy[];

  @IsOptional()
  @IsString()
  nationality?: string;

  @IsOptional()
  @IsEnum(['AED', 'USD'])
  currency?: 'AED' | 'USD';
}
