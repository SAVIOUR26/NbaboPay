import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from root .env file
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../../.env.production') });

export const config = {
  // Server
  port: parseInt(process.env.API_PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database
  databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/ngabopay',

  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
  jwtExpiresIn: parseInt(process.env.JWT_EXPIRES_IN || '86400', 10), // 24 hours default

  // Security
  apiSecret: process.env.API_SECRET || 'api-secret-key',
  encryptionKey: process.env.ENCRYPTION_KEY || 'encryption-key',

  // CORS
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3001'],

  // Rate limiting
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),

  // Business logic
  transactionFeePercent: parseFloat(process.env.TRANSACTION_FEE_PERCENT || '2.0'),
  minOrderAmountUgx: parseInt(process.env.MIN_ORDER_AMOUNT_UGX || '10000', 10),
  maxOrderAmountUgx: parseInt(process.env.MAX_ORDER_AMOUNT_UGX || '5000000', 10),

  // Risk scoring
  riskScoreLowThreshold: parseInt(process.env.RISK_SCORE_LOW_THRESHOLD || '30', 10),
  riskScoreHighThreshold: parseInt(process.env.RISK_SCORE_HIGH_THRESHOLD || '70', 10),

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',

  // Public URL
  publicUrl: process.env.PUBLIC_URL || 'http://localhost:3000',
} as const;

// Validate required configuration
export function validateConfig(): void {
  const required = [
    'jwtSecret',
    'databaseUrl',
  ];

  const missing: string[] = [];

  for (const key of required) {
    const value = config[key as keyof typeof config];
    if (!value || (typeof value === 'string' && value.includes('change-in-production'))) {
      if (config.nodeEnv === 'production') {
        missing.push(key);
      }
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required configuration: ${missing.join(', ')}`);
  }
}

export default config;
