import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authMiddleware } from '../middleware/auth';
import { logger } from '../utils/logger';
import crypto from 'crypto';

const router = Router();

router.use(authMiddleware);

// Encryption key from environment (32 bytes for AES-256)
const ENCRYPTION_KEY = process.env.CONFIG_ENCRYPTION_KEY || 'ngabopay-default-key-change-me!!';

// Encrypt sensitive values
function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

// Decrypt sensitive values
function decrypt(text: string): string {
  try {
    const parts = text.split(':');
    const iv = Buffer.from(parts.shift()!, 'hex');
    const encryptedText = Buffer.from(parts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch {
    return text; // Return as-is if decryption fails
  }
}

// Config keys that should be encrypted
const SENSITIVE_KEYS = [
  'telegram_bot_token',
  'binance_session_data',
  'mobile_money_pin',
  'api_secret',
];

// GET /api/config - Get all config for merchant
router.get('/', async (req, res, next) => {
  try {
    const merchantId = req.user!.id;

    const configs = await prisma.systemConfig.findMany({
      where: { merchantId, isActive: true },
      select: {
        id: true,
        configKey: true,
        configValue: true,
        isEncrypted: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Decrypt values for response but mask sensitive ones
    const result = configs.map(config => ({
      ...config,
      configValue: config.isEncrypted
        ? '********' // Never expose encrypted values in full
        : config.configValue,
    }));

    res.json({ configs: result });
  } catch (error) {
    next(error);
  }
});

// GET /api/config/:key - Get specific config
router.get('/:key', async (req, res, next) => {
  try {
    const merchantId = req.user!.id;
    const { key } = req.params;

    const config = await prisma.systemConfig.findUnique({
      where: {
        merchantId_configKey: {
          merchantId,
          configKey: key,
        },
      },
    });

    if (!config) {
      return res.status(404).json({ error: 'Config not found' });
    }

    res.json({
      key: config.configKey,
      value: config.isEncrypted ? '********' : config.configValue,
      isEncrypted: config.isEncrypted,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/config/:key - Set config value
router.put('/:key', async (req, res, next) => {
  try {
    const merchantId = req.user!.id;
    const { key } = req.params;
    const { value } = req.body;

    if (value === undefined || value === null) {
      return res.status(400).json({ error: 'Value is required' });
    }

    const shouldEncrypt = SENSITIVE_KEYS.includes(key);
    const storedValue = shouldEncrypt ? encrypt(String(value)) : String(value);

    const config = await prisma.systemConfig.upsert({
      where: {
        merchantId_configKey: {
          merchantId,
          configKey: key,
        },
      },
      update: {
        configValue: storedValue,
        isEncrypted: shouldEncrypt,
        updatedAt: new Date(),
      },
      create: {
        merchantId,
        configKey: key,
        configValue: storedValue,
        isEncrypted: shouldEncrypt,
      },
    });

    logger.info(`Config updated: ${key}`, { merchantId, encrypted: shouldEncrypt });

    res.json({
      message: 'Config saved successfully',
      key: config.configKey,
      isEncrypted: config.isEncrypted,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/config/batch - Set multiple config values
router.post('/batch', async (req, res, next) => {
  try {
    const merchantId = req.user!.id;
    const { configs } = req.body;

    if (!configs || !Array.isArray(configs)) {
      return res.status(400).json({ error: 'Configs array is required' });
    }

    const results = await Promise.all(
      configs.map(async ({ key, value }: { key: string; value: string }) => {
        const shouldEncrypt = SENSITIVE_KEYS.includes(key);
        const storedValue = shouldEncrypt ? encrypt(String(value)) : String(value);

        return prisma.systemConfig.upsert({
          where: {
            merchantId_configKey: {
              merchantId,
              configKey: key,
            },
          },
          update: {
            configValue: storedValue,
            isEncrypted: shouldEncrypt,
            updatedAt: new Date(),
          },
          create: {
            merchantId,
            configKey: key,
            configValue: storedValue,
            isEncrypted: shouldEncrypt,
          },
        });
      })
    );

    logger.info(`Batch config update: ${configs.length} items`, { merchantId });

    res.json({
      message: 'Configs saved successfully',
      count: results.length,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/config/:key - Delete config
router.delete('/:key', async (req, res, next) => {
  try {
    const merchantId = req.user!.id;
    const { key } = req.params;

    const config = await prisma.systemConfig.findUnique({
      where: {
        merchantId_configKey: {
          merchantId,
          configKey: key,
        },
      },
    });

    if (!config) {
      return res.status(404).json({ error: 'Config not found' });
    }

    await prisma.systemConfig.delete({
      where: {
        merchantId_configKey: {
          merchantId,
          configKey: key,
        },
      },
    });

    logger.info(`Config deleted: ${key}`, { merchantId });

    res.json({ message: 'Config deleted' });
  } catch (error) {
    next(error);
  }
});

// ============================================
// TELEGRAM SETTINGS
// ============================================

// GET /api/config/telegram/status - Check Telegram connection
router.get('/telegram/status', async (req, res, next) => {
  try {
    const merchantId = req.user!.id;

    const botToken = await prisma.systemConfig.findUnique({
      where: {
        merchantId_configKey: {
          merchantId,
          configKey: 'telegram_bot_token',
        },
      },
    });

    const chatId = await prisma.systemConfig.findUnique({
      where: {
        merchantId_configKey: {
          merchantId,
          configKey: 'telegram_chat_id',
        },
      },
    });

    res.json({
      configured: !!(botToken && chatId),
      botToken: botToken ? '********' : null,
      chatId: chatId?.configValue || null,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/config/telegram/test - Send test message
router.post('/telegram/test', async (req, res, next) => {
  try {
    const merchantId = req.user!.id;

    const botTokenConfig = await prisma.systemConfig.findUnique({
      where: {
        merchantId_configKey: {
          merchantId,
          configKey: 'telegram_bot_token',
        },
      },
    });

    const chatIdConfig = await prisma.systemConfig.findUnique({
      where: {
        merchantId_configKey: {
          merchantId,
          configKey: 'telegram_chat_id',
        },
      },
    });

    if (!botTokenConfig || !chatIdConfig) {
      return res.status(400).json({ error: 'Telegram not configured' });
    }

    const botToken = decrypt(botTokenConfig.configValue);
    const chatId = chatIdConfig.configValue;

    // Send test message via Telegram API
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: '✅ NgaboPay Test Message\n\nYour Telegram notifications are working correctly!',
        parse_mode: 'HTML',
      }),
    });

    const data = await response.json();

    if (data.ok) {
      res.json({ success: true, message: 'Test message sent successfully' });
    } else {
      res.status(400).json({ success: false, error: data.description });
    }
  } catch (error) {
    next(error);
  }
});

// ============================================
// ANDROID DEVICE MANAGEMENT
// ============================================

// GET /api/config/devices - List connected Android devices
router.get('/devices', async (req, res, next) => {
  try {
    const merchantId = req.user!.id;

    const devices = await prisma.androidDevice.findMany({
      where: { merchantId },
      orderBy: { lastSeenAt: 'desc' },
    });

    res.json({ devices });
  } catch (error) {
    next(error);
  }
});

// POST /api/config/devices/register - Register new Android device
router.post('/devices/register', async (req, res, next) => {
  try {
    const merchantId = req.user!.id;
    const { deviceId, deviceName, fcmToken } = req.body;

    if (!deviceId) {
      return res.status(400).json({ error: 'Device ID is required' });
    }

    const device = await prisma.androidDevice.upsert({
      where: { deviceId },
      update: {
        deviceName,
        fcmToken,
        isConnected: true,
        lastSeenAt: new Date(),
      },
      create: {
        merchantId,
        deviceId,
        deviceName,
        fcmToken,
        isConnected: true,
        lastSeenAt: new Date(),
      },
    });

    logger.info(`Android device registered: ${deviceId}`, { merchantId });

    res.json({
      message: 'Device registered',
      device,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/config/devices/:id/heartbeat - Device heartbeat
router.post('/devices/:id/heartbeat', async (req, res, next) => {
  try {
    const merchantId = req.user!.id;
    const { id } = req.params;

    const device = await prisma.androidDevice.findFirst({
      where: { id, merchantId },
    });

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    await prisma.androidDevice.update({
      where: { id },
      data: {
        isConnected: true,
        lastSeenAt: new Date(),
      },
    });

    res.json({ status: 'ok' });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/config/devices/:id - Remove device
router.delete('/devices/:id', async (req, res, next) => {
  try {
    const merchantId = req.user!.id;
    const { id } = req.params;

    const device = await prisma.androidDevice.findFirst({
      where: { id, merchantId },
    });

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    await prisma.androidDevice.delete({ where: { id } });

    logger.info(`Android device removed: ${device.deviceId}`, { merchantId });

    res.json({ message: 'Device removed' });
  } catch (error) {
    next(error);
  }
});

// ============================================
// BINANCE SESSION MANAGEMENT
// ============================================

// GET /api/config/binance/status - Check Binance session status
router.get('/binance/status', async (req, res, next) => {
  try {
    const merchantId = req.user!.id;

    const session = await prisma.binanceSession.findUnique({
      where: { merchantId },
    });

    res.json({
      connected: session?.isValid || false,
      lastChecked: session?.lastChecked || null,
      expiresAt: session?.expiresAt || null,
      invalidReason: session?.invalidReason || null,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/config/binance/session - Save Binance session
router.post('/binance/session', async (req, res, next) => {
  try {
    const merchantId = req.user!.id;
    const { sessionData, expiresAt } = req.body;

    if (!sessionData) {
      return res.status(400).json({ error: 'Session data is required' });
    }

    const session = await prisma.binanceSession.upsert({
      where: { merchantId },
      update: {
        sessionData,
        isValid: true,
        invalidReason: null,
        lastChecked: new Date(),
        expiresAt: expiresAt ? new Date(expiresAt) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days default
      },
      create: {
        merchantId,
        sessionData,
        isValid: true,
        lastChecked: new Date(),
        expiresAt: expiresAt ? new Date(expiresAt) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    logger.info('Binance session saved', { merchantId });

    res.json({
      message: 'Binance session saved',
      expiresAt: session.expiresAt,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/config/binance/session - Clear Binance session
router.delete('/binance/session', async (req, res, next) => {
  try {
    const merchantId = req.user!.id;

    await prisma.binanceSession.deleteMany({
      where: { merchantId },
    });

    logger.info('Binance session cleared', { merchantId });

    res.json({ message: 'Binance session cleared' });
  } catch (error) {
    next(error);
  }
});

export default router;
