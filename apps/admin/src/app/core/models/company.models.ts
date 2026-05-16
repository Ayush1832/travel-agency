export type CompanyStatus = 'pending' | 'active' | 'suspended' | 'rejected';

export interface Company {
  _id: string;
  companyName: string;
  email: string;
  phone: string;
  status: CompanyStatus;
  creditLimit: number;
  walletBalance: number;
  loyaltyPoints: number;
  contactPerson: {
    firstName: string;
    lastName: string;
    email: string;
  };
  address?: {
    street?: string;
    city?: string;
    country?: string;
  };
  taxId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreditBalance {
  creditLimit: number;
  walletBalance: number;
  availableCredit: number;
  loyaltyPoints: number;
}

export interface ClientDetail {
  company: Company;
  creditBalance: CreditBalance;
  recentBookings: any[];
}

export interface WalletTransaction {
  _id: string;
  type: string;
  amount: number;
  description: string;
  referenceNo?: string;
  createdAt: string;
  balance?: number;
}

export interface Settlement {
  _id: string;
  amount: number;
  mode: string;
  referenceNo?: string;
  notes?: string;
  createdAt: string;
}
