import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsBoolean,
  IsArray,
  IsEmail,
  IsNotEmpty,
  Min,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BookingStatus } from '../../../db/schemas/booking.schema';
import { SettlementMode, SettlementCurrency } from '../../../db/schemas/settlement.schema';

// ── Client DTOs ──────────────────────────────────────────────────────────────

export class RejectClientDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class SuspendClientDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class UpdateCreditLimitDto {
  @IsNumber()
  @Min(0)
  creditLimit: number;
}

export class TopUpWalletDto {
  @IsNumber()
  @Min(1)
  amount: number;

  @IsString()
  @IsOptional()
  description?: string;
}

export class RecordSettlementDto {
  @IsNumber()
  @Min(1)
  amount: number;

  @IsEnum(SettlementCurrency)
  currency: SettlementCurrency;

  @IsEnum(SettlementMode)
  mode: SettlementMode;

  @IsOptional()
  @IsString()
  referenceNo?: string;

  @IsOptional()
  @IsString()
  attachmentUrl?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

// ── Booking DTOs ─────────────────────────────────────────────────────────────

export class UpdateBookingStatusDto {
  @IsEnum(BookingStatus)
  status: BookingStatus;
}

export class RefundBookingDto {
  @IsNumber()
  @Min(0)
  refundAmount: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

// ── Role DTOs ────────────────────────────────────────────────────────────────

class ModulePermissionDto {
  @IsString()
  @IsNotEmpty()
  module: string;

  @IsArray()
  @IsString({ each: true })
  actions: string[];
}

export class CreateRoleDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModulePermissionDto)
  permissions: ModulePermissionDto[];
}

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModulePermissionDto)
  permissions?: ModulePermissionDto[];
}

// ── Sub-Admin DTOs ───────────────────────────────────────────────────────────

export class CreateSubAdminDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  subRoleId?: string;
}

export class UpdateSubAdminDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  subRoleId?: string;
}

// ── API Config DTOs ──────────────────────────────────────────────────────────

export class UpdateApiConfigDto {
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsNumber()
  @Min(0)
  markupPercent?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ── Loyalty Rule DTOs ────────────────────────────────────────────────────────

export class CreateLoyaltyRuleDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @Min(0)
  pointsPerAed: number;

  @IsNumber()
  @Min(1)
  pointValueFils: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minBookingAmountAed?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  expirationPeriodDays?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  eligibleHotelIds?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateLoyaltyRuleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pointsPerAed?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  pointValueFils?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minBookingAmountAed?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  expirationPeriodDays?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  eligibleHotelIds?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AddEligibleHotelDto {
  @IsString()
  @IsNotEmpty()
  hotelId: string;
}

// ── Admin Support DTOs ───────────────────────────────────────────────────────

export class AdminUpdateTicketDto {
  @IsOptional()
  @IsString()
  assignedTo?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class AdminReplyTicketDto {
  @IsString()
  @IsNotEmpty()
  body: string;
}
