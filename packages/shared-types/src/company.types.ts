import { SupportedCurrency } from './common.types';

export type CompanyStatus = 'pending' | 'active' | 'suspended' | 'rejected';

export interface CompanyAddress {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  country: string;
  postalCode: string;
}

export interface Company {
  _id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: CompanyAddress;
  taxId?: string;
  businessRegistrationNo?: string;
  status: CompanyStatus;
  creditLimit: number;
  walletBalance: number;
  loyaltyPoints: number;
  currency: SupportedCurrency;
  approvedBy?: string;
  approvedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreditBalance {
  creditLimit: number;
  walletBalance: number;
  /** availableCredit = creditLimit + walletBalance */
  availableCredit: number;
  currency: SupportedCurrency;
}
