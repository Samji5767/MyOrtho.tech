import { api } from './client';

export interface CreditBalance { balance: number }

export interface CreditTransaction {
  id: string;
  orgId: string;
  amount: number;
  type: string;
  referenceId: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  maxCasesPerMonth: number;
  priceUsdCents: number;
  creditsIncluded: number;
  features: string[];
}

export interface ActiveSubscription {
  id: string;
  planId: string;
  planName: string;
  planSlug: string;
  status: string;
  maxCasesPerMonth: number;
  priceUsdCents: number;
  creditsIncluded: number;
  casesThisPeriod: number;
  currentPeriodStart: string;
  currentPeriodEnd: string;
}

export const getBalance = () => api.get<CreditBalance>('/api/credits/balance');
export const listTransactions = () => api.get<CreditTransaction[]>('/api/credits/transactions');

export const listPlans = () => api.get<SubscriptionPlan[]>('/api/subscriptions/plans');
export const getActiveSubscription = () => api.get<ActiveSubscription | null>('/api/subscriptions/active');
export const activateSubscription = (planSlug: string) =>
  api.post<ActiveSubscription>('/api/subscriptions/activate', { planSlug });
