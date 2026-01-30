/**
 * Binance P2P Observer Types
 * TypeScript interfaces for the Binance P2P monitoring service
 */

/**
 * Supported cryptocurrencies for P2P trading
 */
export type CryptoCurrency = 'USDT' | 'BTC' | 'ETH' | 'BNB' | 'BUSD';

/**
 * Supported fiat currencies for P2P trading
 */
export type FiatCurrency = 'UGX' | 'KES' | 'TZS' | 'RWF' | 'NGN' | 'GHS' | 'ZAR' | 'USD';

/**
 * Trade type - buy or sell
 */
export type TradeType = 'BUY' | 'SELL';

/**
 * Order status
 */
export type OrderStatus = 'PENDING' | 'TRADING' | 'COMPLETED' | 'CANCELLED' | 'APPEALING';

/**
 * Payment method information
 */
export interface PaymentMethod {
  id: string;
  name: string;
  identifier?: string;
}

/**
 * Merchant/Advertiser information
 */
export interface Merchant {
  nickname: string;
  userId?: string;
  userType: 'merchant' | 'user';
  monthOrderCount: number;
  monthFinishRate: number;
  positiveRate: number;
  isOnline: boolean;
  lastActiveTime?: Date;
}

/**
 * P2P Advertisement/Order listing
 */
export interface P2POrder {
  adNumber: string;
  tradeType: TradeType;
  asset: CryptoCurrency;
  fiatUnit: FiatCurrency;
  price: number;
  surplusAmount: number;
  minSingleTransAmount: number;
  maxSingleTransAmount: number;
  paymentMethods: PaymentMethod[];
  merchant: Merchant;
  tradableQuantity: number;
  commissionRate?: number;
  createTime?: Date;
  advStatus?: OrderStatus;
}

/**
 * Exchange rate information
 */
export interface ExchangeRate {
  crypto: CryptoCurrency;
  fiat: FiatCurrency;
  buyRate: number;
  sellRate: number;
  avgRate: number;
  spread: number;
  timestamp: Date;
  source: 'binance_p2p';
  orderCount: number;
}

/**
 * P2P order query filters
 */
export interface P2PQueryFilters {
  asset?: CryptoCurrency;
  fiat?: FiatCurrency;
  tradeType?: TradeType;
  paymentMethod?: string;
  transAmount?: number;
  publisherType?: 'merchant' | 'user';
  page?: number;
  rows?: number;
}

/**
 * Browser session data for persistence
 */
export interface BrowserSession {
  id: string;
  cookies: Cookie[];
  localStorage: Record<string, string>;
  createdAt: Date;
  lastUsed: Date;
  expiresAt: Date;
  userAgent: string;
  isValid: boolean;
}

/**
 * Cookie structure for session management
 */
export interface Cookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

/**
 * Configuration options for the Binance client
 */
export interface BinanceClientConfig {
  headless?: boolean;
  userAgent?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  proxyServer?: string;
  sessionStoragePath?: string;
  rateLimitDelay?: number;
  screenshotOnError?: boolean;
  screenshotPath?: string;
}

/**
 * Session manager configuration
 */
export interface SessionManagerConfig {
  storagePath: string;
  sessionTimeout: number;
  maxSessions: number;
  autoRefresh: boolean;
  refreshThreshold: number;
}

/**
 * Rate limiter state
 */
export interface RateLimiterState {
  requestCount: number;
  windowStart: Date;
  isLimited: boolean;
  nextAllowedRequest?: Date;
}

/**
 * Observer event types
 */
export type ObserverEventType =
  | 'rate_update'
  | 'order_found'
  | 'session_expired'
  | 'error'
  | 'rate_limited'
  | 'connected'
  | 'disconnected';

/**
 * Observer event payload
 */
export interface ObserverEvent<T = unknown> {
  type: ObserverEventType;
  timestamp: Date;
  data: T;
}

/**
 * Error response from observer
 */
export interface ObserverError {
  code: string;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
}

/**
 * Health check response
 */
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  browserConnected: boolean;
  sessionValid: boolean;
  lastSuccessfulRequest?: Date;
  errorCount: number;
  uptime: number;
}

/**
 * Monitoring statistics
 */
export interface MonitoringStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastRequestTime?: Date;
  rateLimitHits: number;
  sessionRefreshes: number;
}
