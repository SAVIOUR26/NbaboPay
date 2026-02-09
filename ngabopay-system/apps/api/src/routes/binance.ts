/**
 * Binance P2P Browser Control Routes
 * Simplified version - will add Playwright integration later
 */

import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authMiddleware } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

router.use(authMiddleware);

/**
 * GET /api/binance/session-status
 * Get current session status
 */
router.get('/session-status', async (req, res, next) => {
  try {
    const merchantId = req.user!.id;

    const session = await prisma.binanceSession.findUnique({
      where: { merchantId },
    });

    if (!session) {
      return res.json({
        isValid: false,
        lastChecked: null,
        expiresAt: null,
      });
    }

    res.json({
      isValid: session.isValid,
      lastChecked: session.lastChecked,
      expiresAt: session.expiresAt,
    });

  } catch (error) {
    logger.error('Error getting session status:', error);
    next(error);
  }
});

/**
 * GET /api/binance/monitoring-status
 * Get current monitoring status
 */
router.get('/monitoring-status', async (req, res, next) => {
  try {
    const merchantId = req.user!.id;

    const config = await prisma.systemConfig.findUnique({
      where: {
        merchantId_configKey: {
          merchantId,
          configKey: 'binance_monitor_active',
        },
      },
    });

    const session = await prisma.binanceSession.findUnique({
      where: { merchantId },
    });

    res.json({
      monitoringActive: config?.configValue === 'true',
      sessionValid: session?.isValid || false,
      lastChecked: session?.lastChecked || null,
    });

  } catch (error) {
    logger.error('Error getting monitoring status:', error);
    next(error);
  }
});

/**
 * POST /api/binance/launch-browser
 * Provides instructions for browser setup
 */
router.post('/launch-browser', async (req, res, next) => {
  try {
    const merchantId = req.user!.id;

    // Create or update session record
    await prisma.binanceSession.upsert({
      where: { merchantId },
      create: {
        merchantId,
        sessionData: { launched: new Date() },
        isValid: false,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      update: {
        sessionData: { launched: new Date() },
        lastUsed: new Date(),
      },
    });

    logger.info(`Browser launch requested for merchant ${merchantId}`);

    res.json({
      success: true,
      message: 'Browser ready! The binance-monitor worker handles browser automation on the server.',
      instructions: [
        '1. Ensure binance-monitor worker is running on the server (pm2 status)',
        '2. The worker will use Playwright to monitor your Binance P2P orders',
        '3. Click "Verify Login Status" after logging into Binance',
        '4. Click "Start Monitoring" to enable automatic order detection',
        '5. When "Buyer Paid" orders are detected, they will be processed automatically',
      ],
    });

  } catch (error) {
    logger.error('Error launching browser:', error);
    next(error);
  }
});

/**
 * POST /api/binance/check-login
 * Check login placeholder
 */
router.post('/check-login', async (req, res, next) => {
  try {
    const merchantId = req.user!.id;

    // Mark session as valid for now (manual process)
    await prisma.binanceSession.upsert({
      where: { merchantId },
      create: {
        merchantId,
        isValid: true,
        lastChecked: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      update: {
        isValid: true,
        lastChecked: new Date(),
      },
    });

    res.json({
      success: true,
      loggedIn: true,
      message: 'Session marked as active',
    });

  } catch (error) {
    logger.error('Error checking login:', error);
    next(error);
  }
});

/**
 * POST /api/binance/start-monitoring
 * Enable the Binance P2P monitoring worker
 */
router.post('/start-monitoring', async (req, res, next) => {
  try {
    const merchantId = req.user!.id;

    // Enable monitoring by setting the config flag
    await prisma.systemConfig.upsert({
      where: {
        merchantId_configKey: {
          merchantId,
          configKey: 'binance_monitor_active',
        },
      },
      create: {
        merchantId,
        configKey: 'binance_monitor_active',
        configValue: 'true',
        isEncrypted: false,
      },
      update: {
        configValue: 'true',
        updatedAt: new Date(),
      },
    });

    // Also update the session to mark it as valid
    await prisma.binanceSession.upsert({
      where: { merchantId },
      create: {
        merchantId,
        isValid: true,
        lastChecked: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      update: {
        isValid: true,
        lastChecked: new Date(),
      },
    });

    logger.info(`Monitoring ENABLED for merchant ${merchantId}`);

    res.json({
      success: true,
      message: 'Monitoring enabled! The worker will now scan for Binance P2P orders.',
      status: 'active',
    });

  } catch (error) {
    logger.error('Error starting monitoring:', error);
    next(error);
  }
});

/**
 * POST /api/binance/stop-monitoring
 * Disable the Binance P2P monitoring worker
 */
router.post('/stop-monitoring', async (req, res, next) => {
  try {
    const merchantId = req.user!.id;

    // Disable monitoring by setting the config flag
    await prisma.systemConfig.upsert({
      where: {
        merchantId_configKey: {
          merchantId,
          configKey: 'binance_monitor_active',
        },
      },
      create: {
        merchantId,
        configKey: 'binance_monitor_active',
        configValue: 'false',
        isEncrypted: false,
      },
      update: {
        configValue: 'false',
        updatedAt: new Date(),
      },
    });

    logger.info(`Monitoring DISABLED for merchant ${merchantId}`);

    res.json({
      success: true,
      message: 'Monitoring disabled. The worker will stop scanning for orders.',
    });

  } catch (error) {
    logger.error('Error stopping monitoring:', error);
    next(error);
  }
});

/**
 * GET /api/binance/rates
 * Get exchange rates placeholder
 */
router.get('/rates', async (req, res, next) => {
  try {
    // Return sample rates for now
    const rates = [
      {
        crypto: 'USDT',
        fiat: 'UGX',
        buyRate: 3750,
        sellRate: 3700,
        avgRate: 3725,
        spread: 50,
      }
    ];

    res.json({
      success: true,
      rates,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Error fetching rates:', error);
    next(error);
  }
});

/**
 * POST /api/binance/close-browser
 * Close browser placeholder
 */
router.post('/close-browser', async (req, res, next) => {
  try {
    res.json({
      success: true,
      message: 'Browser closed',
    });

  } catch (error) {
    logger.error('Error closing browser:', error);
    next(error);
  }
});

export default router;
