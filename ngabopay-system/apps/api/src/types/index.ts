import { Request } from 'express';

// Extend Express Request to include authenticated user
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    businessName: string;
    country: string;
    isActive: boolean;
  };
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

// Pagination params
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Auth types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  businessName: string;
  phone: string;
  country: 'UG' | 'KE' | 'TZ';
}

export interface AuthResponse {
  token: string;
  expiresIn: number;
  merchant: {
    id: string;
    email: string;
    businessName: string;
    country: string;
  };
}

// Order types
export interface CreateOrderRequest {
  cryptoAmount: number;
  cryptoCurrency: 'USDT' | 'USDC';
  cryptoNetwork: 'TRC20' | 'BSC' | 'ETH';
  fiatCurrency: 'UGX' | 'KES' | 'TZS';
  customerPhone: string;
  customerEmail?: string;
  customerName?: string;
}

export interface UpdateOrderStatusRequest {
  status: 'pending' | 'verified' | 'approved' | 'paid' | 'completed' | 'failed' | 'cancelled';
  reason?: string;
}

export interface OrderFilters {
  status?: string;
  fiatCurrency?: string;
  startDate?: string;
  endDate?: string;
}

// Wallet types
export interface CreateWalletRequest {
  network: 'TRC20' | 'BSC' | 'ETH';
  address: string;
  label?: string;
}

// Exchange rate types
export interface ExchangeRateResponse {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  source: string;
  validUntil: Date;
}

// Order status enum
export const OrderStatus = {
  PENDING: 'pending',
  VERIFIED: 'verified',
  APPROVED: 'approved',
  PAID: 'paid',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

export type OrderStatusType = typeof OrderStatus[keyof typeof OrderStatus];

// Supported currencies
export const FiatCurrencies = ['UGX', 'KES', 'TZS'] as const;
export const CryptoCurrencies = ['USDT', 'USDC'] as const;
export const CryptoNetworks = ['TRC20', 'BSC', 'ETH'] as const;
export const Countries = ['UG', 'KE', 'TZ'] as const;

export type FiatCurrency = typeof FiatCurrencies[number];
export type CryptoCurrency = typeof CryptoCurrencies[number];
export type CryptoNetwork = typeof CryptoNetworks[number];
export type Country = typeof Countries[number];
