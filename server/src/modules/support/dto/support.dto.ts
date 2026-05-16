import { IsString, IsEnum, IsOptional, IsNotEmpty } from 'class-validator';
import { TicketCategory, TicketPriority } from '../../../db/schemas/support-ticket.schema';

export class CreateTicketDto {
  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsEnum(TicketCategory)
  category: TicketCategory;

  @IsEnum(TicketPriority)
  priority: TicketPriority;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsOptional()
  @IsString()
  bookingRef?: string;
}

export class ReplyDto {
  @IsString()
  @IsNotEmpty()
  body: string;
}
