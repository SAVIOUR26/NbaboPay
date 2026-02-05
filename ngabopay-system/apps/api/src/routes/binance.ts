/**
 * Binance P2P Browser Control Routes
 * Manages browser sessions, login, and monitoring
 */

import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authMiddleware } from '../middleware/auth';
import { logger } from '../utils/logger';
import { BinanceClient } from '@ngabopay/binance-observer';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const router = Router();

// Store active browser instances
const activeBrowsers = new Map<string, BinanceClient>();

router.use(authMiddleware);

/**
 * GET /api/binance/launch-browser
 * Launch Chromium browser for client login via VNC
 */
router.post('/launch-browser', async (req, res, next) => {
  try {
    const merchantId = req.merchantId!;

    // Check if browser already running
    const existingSession = await prisma.binanceSession.findUnique({
      where: { merchantId },
    });

    let sessionId = existingSession?.id || merchantId;

    // Close existing browser if any
    if (activeBrowsers.has(sessionId)) {
      logger.info(`Closing existing browser for merchant ${merchantId}`);
      await activeBrowsers.get(sessionId)?.close();
      activeBrowsers.delete(sessionId);
    }

    // Create new browser instance
    const client = new BinanceClient(sessionId, {
      headless: false,
      displayNumber: ':99',
      remoteDebuggingPort: 9222,
    });

    // Launch browser
    await client.launch();
    await client.navigateToP2P('UGX');

    // Store instance
    activeBrowsers.set(sessionId, client);

    // Get server IP for VNC URL
    const { stdout } = await execAsync("hostname -I | awk '{print $1}'");
    const serverIp = stdout.trim();

    // Save or update session in database
    await prisma.binanceSession.upsert({
      where: { merchantId },
      create: {
        id: sessionId,
        merchantId,
        sessionData: {
          launched: new Date(),
          displayNumber: ':99',
          vncPort: 6080,
        },
        isValid: false, // Not logged in yet
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      update: {
        sessionData: {
          launched: new Date(),
          displayNumber: ':99',
          vncPort: 6080,
        },
        isValid: false,
        lastUsed: new Date(),
      },
    });

    logger.info(`Browser launched for merchant ${merchantId}`, { sessionId });

    res.json({
      success: true,
      message: 'Browser launched successfully',
      sessionId,
      browserUrl: `http://${serverIp}:6080/vnc.html`,
      remoteDebugUrl: `http://${serverIp}:9222`,
      instructions: [
        'Open the browser URL in a new tab',
        'Click "Connect" in the noVNC interface',
        'Log into your Binance account',
        'Once logged in, click "Save Session" in the dashboard',
      ],
    });

  } catch (error) {
    logger.error('Error launching browser:', error);
    next(error);
  }
});

/**
 * POST /api/binance/check-login
 * Check if user has logged in and save session
 */
router.post('/check-login', async (req, res, next) => {
  try {
    const merchantId = req.merchantId!;

    const session = await prisma.binanceSession.findUnique({
      where: { merchantId },
    });

    if (!session) {
      return res.status(404).json({
        error: 'No browser session found. Launch browser first.',
      });
    }

    const client = activeBrowsers.get(session.id);
    if (!client) {
      return res.status(400).json({
        error: 'Browser not active. Launch browser first.',
      });
    }

    // Check if logged in
    const isLoggedIn = await client.isLoggedIn();

    if (isLoggedIn) {
      // Save session to disk and database
      await client.saveSession();

      await prisma.binanceSession.update({
        where: { merchantId },
        data: {
          isValid: true,
          lastChecked: new Date(),
          lastUsed: new Date(),
          invalidReason: null,
        },
      });

      logger.info(`Binance session saved for merchant ${merchantId}`);

      res.json({
        success: true,
        loggedIn: true,
        message: 'Session saved successfully',
      });
    } else {
      res.json({
        success: true,
        loggedIn: false,
        message: 'User not logged in yet',
      });
    }

  } catch (error) {
    logger.error('Error checking login:', error);
    next(error);
  }
});

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
        hasSession: false,
        isValid: false,
        isActive: false,
      });
    }

    const client = activeBrowsers.get(session.id);
    const isActive = !!client;

    res.json({
      hasSession: true,
      isValid: session.isValid,
      isActive,
      lastChecked: session.lastChecked,
      lastUsed: session.lastUsed,
      expiresAt: session.expiresAt,
      browserInfo: client ? client.getBrowserInfo() : null,
    });

  } catch (error) {
    logger.error('Error getting session status:', error);
    next(error);
  }
});

/**
 * POST /api/binance/start-monitoring
 * Start monitoring Binance P2P rates
 */
router.post('/start-monitoring', async (req, res, next) => {
  try {
    const merchantId = req.merchantId!;
    const { fiatCurrency = 'UGX' } = req.body;

    const session = await prisma.binanceSession.findUnique({
      where: { merchantId },
    });

    if (!session || !session.isValid) {
      return res.status(400).json({
        error: 'No valid session. Please log in first.',
      });
    }

    const client = activeBrowsers.get(session.id);
    if (!client) {
      // Try to restore from saved session
      const newClient = new BinanceClient(session.id);
      await newClient.launch();
      await newClient.navigateToP2P(fiatCurrency);
      activeBrowsers.set(session.id, newClient);
    }

    logger.info(`Started monitoring for merchant ${merchantId}, currency: ${fiatCurrency}`);

    res.json({
      success: true,
      message: 'Monitoring started',
      fiatCurrency,
    });

  } catch (error) {
    logger.error('Error starting monitoring:', error);
    next(error);
  }
});

/**
 * POST /api/binance/stop-monitoring
 * Stop monitoring and close browser
 */
router.post('/stop-monitoring', async (req, res, next) => {
  try {
    const merchantId = req.merchantId!;

    const session = await prisma.binanceSession.findUnique({
      where: { merchantId },
    });

    if (!session) {
      return res.json({
        success: true,
        message: 'No active session to stop',
      });
    }

    const client = activeBrowsers.get(session.id);
    if (client) {
      await client.close();
      activeBrowsers.delete(session.id);
    }

    logger.info(`Stopped monitoring for merchant ${merchantId}`);

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
 * Get current exchange rates (requires active session)
 */
router.get('/rates', async (req, res, next) => {
  try {
    const merchantId = req.merchantId!;
    const { fiatCurrency = 'UGX' } = req.query;

    const session = await prisma.binanceSession.findUnique({
      where: { merchantId },
    });

    if (!session || !session.isValid) {
      return res.status(400).json({
        error: 'No valid session. Please log in first.',
      });
    }

    const client = activeBrowsers.get(session.id);
    if (!client) {
      return res.status(400).json({
        error: 'Browser not active. Start monitoring first.',
      });
    }

    // Scrape rates
    const rates = await client.scrapeExchangeRates(fiatCurrency as string);

    if (!rates) {
      return res.status(500).json({
        error: 'Failed to fetch rates',
      });
    }

    // Save to database
    await prisma.exchangeRate.create({
      data: {
        fromCurrency: rates.crypto,
        toCurrency: rates.fiat,
        rate: rates.avgRate,
        source: 'binance_p2p',
        validUntil: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      },
    });

    logger.info(`Fetched rates for ${rates.crypto}/${rates.fiat}: ${rates.avgRate}`);

    res.json({
      success: true,
      rates,
    });

  } catch (error) {
    logger.error('Error fetching rates:', error);
    next(error);
  }
});

/**
 * POST /api/binance/close-browser
 * Close the browser session
 */
router.post('/close-browser', async (req, res, next) => {
  try {
    const merchantId = req.merchantId!;

    const session = await prisma.binanceSession.findUnique({
      where: { merchantId },
    });

    if (session) {
      const client = activeBrowsers.get(session.id);
      if (client) {
        await client.close();
        activeBrowsers.delete(session.id);
      }
    }

    logger.info(`Browser closed for merchant ${merchantId}`);

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
