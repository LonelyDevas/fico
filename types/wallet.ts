export type WalletType = 'bank' | 'savings' | 'cash' | 'ewallet' | 'credit_card' | 'other';
export type InterestPayout = 'monthly' | 'quarterly' | 'annually' | 'maturity';
export type WalletStatus = 'active' | 'archived';

export type CreateWalletData = {
  name: string;
  type: WalletType;
  balance?: number;
  currency?: string;
  icon?: string;
  color?: string;
  description?: string;
  accountNumber?: string;
  /** Catalog id from lib/ph-institutions.ts. */
  institution?: string;
  /** Credit cards only: the spending limit. `balance` is the amount used. */
  creditLimit?: number;
  /** Credit cards only: day of month the statement closes and the payment is due (1-28). */
  statementDay?: number;
  dueDay?: number;
  /** Savings only. Annual interest %, payout schedule, tax withheld %, and end of term. */
  interestRate?: number;
  interestPayout?: InterestPayout;
  interestTaxRate?: number;
  maturityDate?: string;
};

export type UpdateWalletData = {
  id: string;
  name?: string;
  type?: WalletType;
  icon?: string;
  color?: string;
  description?: string;
  accountNumber?: string;
  institution?: string;
  /** Credit cards only: the spending limit. `balance` is the amount used. */
  creditLimit?: number;
  /** Credit cards only: day of month the statement closes and the payment is due (1-28). */
  statementDay?: number;
  dueDay?: number;
  /** Savings only. Annual interest %, payout schedule, tax withheld %, and end of term. */
  interestRate?: number;
  interestPayout?: InterestPayout;
  interestTaxRate?: number;
  maturityDate?: string;
  status?: WalletStatus;
};

export type AdjustBalanceData = {
  id: string;
  amount: number;
  description?: string;
};

export type SetBalanceData = {
  id: string;
  balance: number;
};

export type ArchiveWalletData = {
  id: string;
};

export type ListWalletsParams = {
  page?: string;
  limit?: string;
  type?: WalletType;
  currency?: string;
  status?: WalletStatus;
};

export type GetWalletParams = {
  id: string;
};
