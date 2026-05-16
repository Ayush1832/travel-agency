export interface CreditBalance {
  creditLimit: number;
  walletBalance: number;
  availableCredit: number;
  usedCredit: number;
  currency: string;
}

export interface LoyaltyBalance {
  points: number;
  value: number;
}

export interface WalletTransaction {
  _id: string;
  type: 'topup' | 'credit_use' | 'credit_refund' | 'loyalty_earn' | 'loyalty_redeem' | 'adjustment';
  amount: number;
  currency: string;
  balanceAfter: number;
  description: string;
  createdAt: string;
  bookingRef?: string;
}
