import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';
import authRoutes from './routes/auth';
import orderRoutes from './routes/orders';
import walletRoutes from './routes/wallets';
import payoutRoutes from './routes/payouts';
import exchangeRateRoutes from './routes/exchange-rates';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.corsOrigins,
  credentials: true,
}));
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'ngabopay-api',
    version: '1.0.0',
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/wallets', walletRoutes);
app.use('/api/payouts', payoutRoutes);
app.use('/api/exchange-rates', exchangeRateRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Error handler
app.use(errorHandler);

// Start server
const PORT = config.apiPort || 3000;

app.listen(PORT, () => {
  logger.info(`NgaboPay API server running on port ${PORT}`);
  logger.info(`Environment: ${config.nodeEnv}`);
  logger.info(`Health check: http://localhost:${PORT}/api/health`);
});

export default app;
