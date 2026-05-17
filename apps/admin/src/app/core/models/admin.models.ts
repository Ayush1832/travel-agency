export interface Permission {
  module: string;
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
}

export interface Role {
  _id: string;
  name: string;
  description?: string;
  permissions: Permission[];
  createdAt: string;
  updatedAt: string;
}

export interface SubAdmin {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  roleId: string;
  roleName?: string;
  status: 'active' | 'disabled';
  createdAt: string;
  updatedAt: string;
}

export interface ApiConfig {
  _id: string;
  provider: string;
  type: string;
  isActive: boolean;
  lastTestedAt?: string;
  config: Record<string, any>;
  markupPercent?: number;
}

export interface SupportTicket {
  _id: string;
  ticketNo: string;
  companyId: string;
  companyName?: string;
  subject: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  assigneeId?: string;
  assigneeName?: string;
  messages: TicketMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface TicketMessage {
  _id: string;
  senderId: string;
  senderType: 'client' | 'admin';
  body: string;
  createdAt: string;
}

export interface LoyaltyRule {
  _id: string;
  name: string;
  pointsPerAed: number;
  pointValueFils: number;
  minBookingAmountAed: number;
  expirationPeriodDays: number;
  eligibleHotelIds: string[];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}
