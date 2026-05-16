export interface RevenueReportItem {
  date: string;
  bookingsCount: number;
  grossAmount: number;
  markupAmount: number;
  netAmount: number;
}

export interface RevenueReport {
  from: string;
  to: string;
  totalGross: number;
  totalMarkup: number;
  totalNet: number;
  items: RevenueReportItem[];
}

export interface BookingsReportItem {
  status: string;
  count: number;
  percentage: number;
}

export interface BookingsByCompany {
  companyId: string;
  companyName: string;
  bookingsCount: number;
  totalAmount: number;
}

export interface BookingsReport {
  from: string;
  to: string;
  totalBookings: number;
  byStatus: BookingsReportItem[];
  byCompany: BookingsByCompany[];
}

export interface CreditReportItem {
  date: string;
  topUps: number;
  creditUsed: number;
  settlements: number;
}

export interface CreditReport {
  from: string;
  to: string;
  totalTopUps: number;
  totalCreditUsed: number;
  totalSettlements: number;
  items: CreditReportItem[];
}
