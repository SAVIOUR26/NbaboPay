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
    const merchantId = req.merchantId!;

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
 * POST /api/binance/launch-browser
 * Launch browser placeholder - returns instructions
 */
router.post('/launch-browser', async (req, res, next) => {
  try {
    const merchantId = req.merchantId!;

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
      message: 'Browser control coming soon. For now, monitor Binance manually.',
      instructions: [
        'Open Binance P2P in your browser',
        'Go to Orders > P2P Orders',
        'When you see "Buyer Paid", process the payout manually',
        'Full browser automation coming in next update',
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
    const merchantId = req.merchantId!;

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
 * Start monitoring placeholder
 */
router.post('/start-monitoring', async (req, res, next) => {
  try {
    const merchantId = req.merchantId!;

    logger.info(`Monitoring start requested for merchant ${merchantId}`);

    res.json({
      success: true,
      message: 'Monitoring mode enabled',
      status: 'active',
    });

  } catch (error) {
    logger.error('Error starting monitoring:', error);
    next(error);
  }
});

/**
 * POST /api/binance/stop-monitoring
 * Stop monitoring placeholder
 */
router.post('/stop-monitoring', async (req, res, next) => {
  try {
    const merchantId = req.merchantId!;

    logger.info(`Monitoring stopped for merchant ${merchantId}`);

    res.json({
      success: true,
      message: 'Monitoring stopped',
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
