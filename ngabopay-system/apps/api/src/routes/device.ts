import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import crypto from 'crypto';

const router = Router();

// Encryption for reading sensitive config values
const ENCRYPTION_KEY = process.env.CONFIG_ENCRYPTION_KEY || 'ngabopay-default-key-change-me!!';

function decrypt(text: string): string {
  try {
    const parts = text.split(':');
    const iv = Buffer.from(parts.shift()!, 'hex');
    const encryptedText = Buffer.from(parts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)),
      iv
    );
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch {
    return text;
  }
}

/**
 * Device authentication middleware
 * Android devices authenticate with Bearer token (API token set in app settings)
 * The token is the merchant's JWT or a device-specific API key
 */
async function deviceAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Device token required' });
    }

    const token = authHeader.split(' ')[1];
    const deviceId = req.headers['x-device-id'] as string;

    if (!deviceId) {
      return res.status(400).json({ error: 'X-Device-Id header required' });
    }

    // Find the device by deviceId
    const device = await prisma.androidDevice.findUnique({
      where: { deviceId },
    });

    if (!device) {
      return res.status(401).json({ error: 'Device not registered' });
    }

    // Verify the token matches the stored device token or merchant API key
    // For simplicity, we check if the token matches a stored API key for this merchant
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        merchantId: device.merchantId,
        isActive: true,
      },
    });

    // Also accept if token matches a system config device_api_token
    const deviceToken = await prisma.systemConfig.findUnique({
      where: {
        merchantId_configKey: {
          merchantId: device.merchantId,
          configKey: 'device_api_token',
        },
      },
    });

    const storedToken = deviceToken?.configValue
      ? (deviceToken.isEncrypted ? decrypt(deviceToken.configValue) : deviceToken.configValue)
      : null;

    // Accept if token matches stored device token OR if the API key hash matches
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const isValidToken = storedToken === token || apiKey?.keyHash === tokenHash;

    if (!isValidToken) {
      return res.status(401).json({ error: 'Invalid device token' });
    }

    // Update device heartbeat
    await prisma.androidDevice.update({
      where: { deviceId },
      data: { isConnected: true, lastSeenAt: new Date() },
    });

    // Attach device info to request
    (req as any).device = device;
    (req as any).merchantId = device.merchantId;

    next();
  } catch (error) {
    logger.error('Device auth error', { error });
    res.status(500).json({ error: 'Authentication failed' });
  }
}

// Apply device auth to all routes
router.use(deviceAuth);

// POST /api/device/register - Register or update device
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const merchantId = (req as any).merchantId;
    const { deviceName, appVersion } = req.body;
    const deviceId = req.headers['x-device-id'] as string;

    const device = await prisma.androidDevice.upsert({
      where: { deviceId },
      update: {
        deviceName,
        isConnected: true,
        lastSeenAt: new Date(),
      },
      create: {
        merchantId,
        deviceId,
        deviceName,
        isConnected: true,
        lastSeenAt: new Date(),
      },
    });

    logger.info(`Device registered: ${deviceId}`, { merchantId, deviceName });

    res.json({ message: 'Device registered', device });
  } catch (error) {
    next(error);
  }
});

// POST /api/device/heartbeat - Device heartbeat
router.post('/heartbeat', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deviceId = req.headers['x-device-id'] as string;

    await prisma.androidDevice.update({
      where: { deviceId },
      data: { isConnected: true, lastSeenAt: new Date() },
    });

    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

// GET /api/device/pending-payouts - Get pending payouts for this device to process
router.get('/pending-payouts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const merchantId = (req as any).merchantId;

    // Find payouts that are queued and ready for USSD processing
    const payouts = await prisma.payout.findMany({
      where: {
        merchantId,
        status: { in: ['queued', 'processing'] },
        recipientPhone: { not: '' },
      },
      include: {
        order: {
          select: {
            id: true,
            orderReference: true,
            fiatAmount: true,
            fiatCurrency: true,
            customerPhone: true,
            cryptoReceived: true,
            cryptoCurrency: true,
          },
        },
      },
      orderBy: { queuedAt: 'asc' },
      take: 5,
    });

    // Get USSD config for the device
    const configs = await prisma.systemConfig.findMany({
      where: {
        merchantId,
        configKey: { in: ['ussd_format', 'mobile_money_pin', 'mobile_provider'] },
      },
    });

    const configMap: Record<string, string> = {};
    for (const c of configs) {
      configMap[c.configKey] = c.isEncrypted ? decrypt(c.configValue) : c.configValue;
    }

    // Build payout instructions for the device
    const instructions = payouts.map((p) => {
      const phone = p.recipientPhone || p.order.customerPhone;
      const amount = Math.round(Number(p.amount));

      // Build USSD code from template
      const ussdCode = (configMap.ussd_format || '*185*9*{phone}*{amount}*{pin}#')
        .replace('{phone}', phone)
        .replace('{amount}', String(amount))
        .replace('{pin}', configMap.mobile_money_pin || '')
        .replace('{reference}', p.reference);

      return {
        payoutId: p.id,
        orderId: p.orderId,
        orderReference: p.order.orderReference,
        amount,
        currency: p.currency,
        recipientPhone: phone,
        ussdCode,
        provider: configMap.mobile_provider || 'airtel',
        retryCount: p.retryCount,
      };
    });

    res.json({ payouts: instructions, count: instructions.length });
  } catch (error) {
    next(error);
  }
});

// POST /api/device/payout/:id/start - Mark payout as started (processing)
router.post('/payout/:id/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const merchantId = (req as any).merchantId;
    const { id } = req.params;

    const payout = await prisma.payout.findFirst({
      where: { id, merchantId, status: { in: ['queued', 'processing'] } },
    });

    if (!payout) {
      return res.status(404).json({ error: 'Payout not found or already processed' });
    }

    await prisma.payout.update({
      where: { id },
      data: { status: 'processing', startedAt: new Date() },
    });

    await prisma.order.update({
      where: { id: payout.orderId },
      data: { status: 'processing' },
    });

    await prisma.orderLog.create({
      data: {
        orderId: payout.orderId,
        level: 'info',
        message: 'USSD payout started by Android device',
        metadata: { payoutId: id, deviceId: req.headers['x-device-id'] },
      },
    });

    logger.info(`Payout started: ${payout.reference}`, { payoutId: id });

    res.json({ message: 'Payout marked as processing' });
  } catch (error) {
    next(error);
  }
});

// POST /api/device/payout/:id/complete - Mark payout as completed
router.post('/payout/:id/complete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const merchantId = (req as any).merchantId;
    const { id } = req.params;
    const { transactionId, confirmationMessage, ussdResponse } = req.body;

    const payout = await prisma.payout.findFirst({
      where: { id, merchantId },
    });

    if (!payout) {
      return res.status(404).json({ error: 'Payout not found' });
    }

    if (payout.status === 'completed') {
      return res.status(400).json({ error: 'Payout already completed' });
    }

    // Update payout
    await prisma.payout.update({
      where: { id },
      data: {
        status: 'completed',
        transactionId: transactionId || null,
        confirmationSms: confirmationMessage || ussdResponse || null,
        completedAt: new Date(),
      },
    });

    // Update order
    await prisma.order.update({
      where: { id: payout.orderId },
      data: { status: 'completed', completedAt: new Date() },
    });

    // Log
    await prisma.orderLog.create({
      data: {
        orderId: payout.orderId,
        level: 'info',
        message: 'USSD payout completed successfully',
        metadata: { payoutId: id, transactionId, ussdResponse },
      },
    });

    // Record mobile money transaction
    await prisma.transaction.create({
      data: {
        merchantId,
        orderId: payout.orderId,
        type: 'payout',
        amount: Number(payout.amount),
        currency: payout.currency,
        customerPhone: payout.recipientPhone,
        status: 'completed',
        provider: payout.provider,
        providerTxId: transactionId,
        ussdResponse: ussdResponse || confirmationMessage,
        completedAt: new Date(),
      },
    });

    logger.info(`Payout completed: ${payout.reference}`, { payoutId: id, transactionId });

    // Send Telegram notification for completed payout
    const order = await prisma.order.findUnique({ where: { id: payout.orderId } });
    if (order) {
      const fmtAmount = new Intl.NumberFormat('en-UG', { maximumFractionDigits: 0 }).format(Number(payout.amount));

      // Get Telegram config
      const botTokenConfig = await prisma.systemConfig.findUnique({
        where: { merchantId_configKey: { merchantId, configKey: 'telegram_bot_token' } },
      });
      const chatIdConfig = await prisma.systemConfig.findUnique({
        where: { merchantId_configKey: { merchantId, configKey: 'telegram_chat_id' } },
      });

      if (botTokenConfig && chatIdConfig) {
        const botToken = decrypt(botTokenConfig.configValue);
        const chatId = chatIdConfig.configValue;

        const message =
          `<b>Payout Completed</b>\n\n` +
          `Order: <code>${order.orderReference}</code>\n` +
          `Amount: <b>${fmtAmount} ${payout.currency}</b>\n` +
          `Phone: <code>${payout.recipientPhone}</code>\n` +
          `Crypto: ${order.cryptoReceived} ${order.cryptoCurrency}\n` +
          (transactionId ? `TX ID: <code>${transactionId}</code>\n` : '') +
          `\nStatus: COMPLETED`;

        try {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
          });
        } catch (err) {
          logger.error('Failed to send Telegram notification', { error: err });
        }
      }
    }

    res.json({ message: 'Payout completed successfully' });
  } catch (error) {
    next(error);
  }
});

// POST /api/device/payout/:id/fail - Mark payout as failed
router.post('/payout/:id/fail', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const merchantId = (req as any).merchantId;
    const { id } = req.params;
    const { errorMessage, errorCode, ussdResponse } = req.body;

    const payout = await prisma.payout.findFirst({
      where: { id, merchantId },
    });

    if (!payout) {
      return res.status(404).json({ error: 'Payout not found' });
    }

    const shouldRetry = payout.retryCount < payout.maxRetries;
    const newStatus = shouldRetry ? 'queued' : 'failed';

    await prisma.payout.update({
      where: { id },
      data: {
        status: newStatus,
        errorMessage,
        errorCode,
        retryCount: payout.retryCount + 1,
        lastRetryAt: new Date(),
        ...(newStatus === 'failed' ? { failedAt: new Date() } : {}),
      },
    });

    if (newStatus === 'failed') {
      await prisma.order.update({
        where: { id: payout.orderId },
        data: { status: 'failed', failedAt: new Date() },
      });
    }

    await prisma.orderLog.create({
      data: {
        orderId: payout.orderId,
        level: 'error',
        message: `USSD payout failed: ${errorMessage || 'Unknown error'}`,
        metadata: { payoutId: id, errorCode, ussdResponse, retryCount: payout.retryCount + 1, willRetry: shouldRetry },
      },
    });

    // Record failed transaction
    await prisma.transaction.create({
      data: {
        merchantId,
        orderId: payout.orderId,
        type: 'payout',
        amount: Number(payout.amount),
        currency: payout.currency,
        customerPhone: payout.recipientPhone,
        status: 'failed',
        provider: payout.provider,
        ussdResponse,
        errorMessage,
      },
    });

    logger.error(`Payout failed: ${payout.reference}`, { payoutId: id, errorMessage, willRetry: shouldRetry });

    // Send Telegram notification for failure
    const order = await prisma.order.findUnique({ where: { id: payout.orderId } });
    if (order) {
      const botTokenConfig = await prisma.systemConfig.findUnique({
        where: { merchantId_configKey: { merchantId, configKey: 'telegram_bot_token' } },
      });
      const chatIdConfig = await prisma.systemConfig.findUnique({
        where: { merchantId_configKey: { merchantId, configKey: 'telegram_chat_id' } },
      });

      if (botTokenConfig && chatIdConfig) {
        const botToken = decrypt(botTokenConfig.configValue);
        const chatId = chatIdConfig.configValue;

        const fmtAmount = new Intl.NumberFormat('en-UG', { maximumFractionDigits: 0 }).format(Number(payout.amount));
        const message =
          `<b>Payout Failed</b>\n\n` +
          `Order: <code>${order.orderReference}</code>\n` +
          `Amount: <b>${fmtAmount} ${payout.currency}</b>\n` +
          `Phone: <code>${payout.recipientPhone}</code>\n` +
          `Error: ${errorMessage || 'Unknown'}\n` +
          `Retry: ${shouldRetry ? `Yes (attempt ${payout.retryCount + 1}/${payout.maxRetries})` : 'No - max retries reached'}\n` +
          `\nStatus: FAILED`;

        try {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
          });
        } catch (err) {
          logger.error('Failed to send Telegram failure notification', { error: err });
        }
      }
    }

    res.json({
      message: shouldRetry ? 'Payout will be retried' : 'Payout failed permanently',
      willRetry: shouldRetry,
      retryCount: payout.retryCount + 1,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/device/config - Get device config (USSD format, provider, etc.)
router.get('/config', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const merchantId = (req as any).merchantId;

    const configs = await prisma.systemConfig.findMany({
      where: {
        merchantId,
        configKey: {
          in: ['ussd_format', 'mobile_provider', 'mobile_money_pin', 'default_currency', 'fee_percent'],
        },
      },
    });

    const result: Record<string, string> = {};
    for (const c of configs) {
      result[c.configKey] = c.isEncrypted ? decrypt(c.configValue) : c.configValue;
    }

    res.json({ configs: result });
  } catch (error) {
    next(error);
  }
});

export default router;
