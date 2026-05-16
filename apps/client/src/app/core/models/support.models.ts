export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketCategory = 'booking' | 'payment' | 'credit' | 'technical' | 'other';

export interface TicketMessage {
  _id: string;
  sender: 'client' | 'admin';
  body: string;
  createdAt: string;
}

export interface SupportTicket {
  _id: string;
  ticketNumber: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  bookingRef?: string;
  messages: TicketMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateTicketDto {
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  bookingRef?: string;
  message: string;
}
