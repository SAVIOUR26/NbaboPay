import { chromium, BrowserContext, Page } from 'playwright';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env.production') });

const prisma = new PrismaClient();

// Configuration
const POLL_INTERVAL = 15_000; // Check every 15 seconds
const USER_DATA_DIR = process.env.BROWSER_DATA_DIR || path.resolve(__dirname, '../../../.browser-data');
const BINANCE_P2P_URL = 'https://p2p.binance.com/en/myorders?tab=processing';
const MERCHANT_ID = process.env.MERCHANT_ID || '';

// Encryption helpers (match the API config.ts)
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

// Track processed order IDs to avoid duplicates
const processedOrders = new Set<string>();

let context: BrowserContext | null = null;
let page: Page | null = null;
let isMonitoring = false;

/**
 * Send Telegram notification using merchant's configured bot
 */
async function sendTelegramNotification(message: string): Promise<void> {
  if (!MERCHANT_ID) return;

  try {
    const botTokenConfig = await prisma.systemConfig.findUnique({
      where: { merchantId_configKey: { merchantId: MERCHANT_ID, configKey: 'telegram_bot_token' } },
    });
    const chatIdConfig = await prisma.systemConfig.findUnique({
      where: { merchantId_configKey: { merchantId: MERCHANT_ID, configKey: 'telegram_chat_id' } },
    });

    if (!botTokenConfig || !chatIdConfig) return;

    const botToken = decrypt(botTokenConfig.configValue);
    const chatId = chatIdConfig.configValue;

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
    });
  } catch (err) {
    console.error('[Telegram] Failed to send notification:', err);
  }
}

/**
 * Check if monitoring is enabled via the dashboard config
 */
async function isMonitoringEnabled(): Promise<boolean> {
  if (!MERCHANT_ID) return false;

  try {
    const config = await prisma.systemConfig.findUnique({
      where: {
        merchantId_configKey: {
          merchantId: MERCHANT_ID,
          configKey: 'binance_monitor_active',
        },
      },
    });
    return config?.configValue === 'true';
  } catch {
    return false;
  }
}

/**
 * Get the merchant's configured mobile money PIN (decrypted)
 */
async function getMobileMoneyConfig(): Promise<{ pin: string; ussdFormat: string; provider: string } | null> {
  if (!MERCHANT_ID) return null;

  try {
    const configs = await prisma.systemConfig.findMany({
      where: {
        merchantId: MERCHANT_ID,
        configKey: { in: ['mobile_money_pin', 'ussd_format', 'mobile_provider'] },
      },
    });

    const map: Record<string, string> = {};
    for (const c of configs) {
      map[c.configKey] = c.isEncrypted ? decrypt(c.configValue) : c.configValue;
    }

    if (!map.mobile_money_pin || !map.ussd_format) return null;

    return {
      pin: map.mobile_money_pin,
      ussdFormat: map.ussd_format,
      provider: map.mobile_provider || 'airtel',
    };
  } catch {
    return null;
  }
}

/**
 * Launch persistent Chromium browser
 */
async function launchBrowser(): Promise<void> {
  console.log('[Browser] Launching Chromium with persistent session...');
  console.log('[Browser] User data dir:', USER_DATA_DIR);

  context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: process.env.HEADLESS === 'true',
    viewport: { width: 1280, height: 800 },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
    ignoreDefaultArgs: ['--enable-automation'],
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  page = context.pages()[0] || (await context.newPage());

  // Navigate to Binance P2P
  console.log('[Browser] Navigating to Binance P2P...');
  await page.goto('https://p2p.binance.com/en', { waitUntil: 'domcontentloaded', timeout: 30000 });

  console.log('[Browser] Browser ready. Log into Binance if needed.');
  console.log('[Browser] The monitor will start checking for orders once you enable it from the dashboard.');
}

/**
 * Parse P2P orders from the current page
 * Returns orders that have "Buyer Paid" / "Payment received" status
 */
async function scanForNewOrders(): Promise<Array<{
  binanceOrderId: string;
  amount: number;
  currency: string;
  cryptoAmount: number;
  cryptoCurrency: string;
  price: number;
  buyerName: string;
}>> {
  if (!page) return [];

  const orders: Array<{
    binanceOrderId: string;
    amount: number;
    currency: string;
    cryptoAmount: number;
    cryptoCurrency: string;
    price: number;
    buyerName: string;
  }> = [];

  try {
    // Navigate to processing orders if not already there
    const currentUrl = page.url();
    if (!currentUrl.includes('myorders')) {
      await page.goto(BINANCE_P2P_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(3000);
    }

    // Look for order cards on the page
    // Binance P2P order page structure varies, but generally has order rows
    // We look for orders with status "Buyer paid" or similar indicators
    const orderElements = await page.$$('[class*="OrderList"] > div, [class*="order-item"], table tbody tr, [data-testid*="order"]');

    if (orderElements.length === 0) {
      // Try alternative selectors for different Binance UI versions
      const altElements = await page.$$('.css-1m1f8hn, .css-vurnku, [class*="myorder"]');
      if (altElements.length > 0) {
        // Process alternative layout
        for (const el of altElements) {
          const text = await el.textContent() || '';

          // Look for "Paid" or "Payment received" indicators
          const hasPaidStatus = /buyer.*paid|payment\s*received|待放行|已付款/i.test(text);
          if (!hasPaidStatus) continue;

          // Try to extract order number
          const orderMatch = text.match(/(\d{18,20})/);
          if (!orderMatch) continue;

          const orderId = orderMatch[1];
          if (processedOrders.has(orderId)) continue;

          // Extract amounts - look for patterns like "1,000 UGX" or "10.5 USDT"
          const fiatMatch = text.match(/([\d,]+(?:\.\d+)?)\s*(UGX|KES|TZS|RWF|NGN)/i);
          const cryptoMatch = text.match(/([\d,]+(?:\.\d+)?)\s*(USDT|USDC|BTC|ETH)/i);

          if (fiatMatch && cryptoMatch) {
            orders.push({
              binanceOrderId: orderId,
              amount: parseFloat(fiatMatch[1].replace(/,/g, '')),
              currency: fiatMatch[2].toUpperCase(),
              cryptoAmount: parseFloat(cryptoMatch[1].replace(/,/g, '')),
              cryptoCurrency: cryptoMatch[2].toUpperCase(),
              price: 0, // Will be calculated from amount/crypto
              buyerName: '',
            });
          }
        }
      }
    } else {
      // Process standard layout
      for (const el of orderElements) {
        const text = await el.textContent() || '';

        const hasPaidStatus = /buyer.*paid|payment\s*received|待放行|已付款/i.test(text);
        if (!hasPaidStatus) continue;

        const orderMatch = text.match(/(\d{18,20})/);
        if (!orderMatch) continue;

        const orderId = orderMatch[1];
        if (processedOrders.has(orderId)) continue;

        const fiatMatch = text.match(/([\d,]+(?:\.\d+)?)\s*(UGX|KES|TZS|RWF|NGN)/i);
        const cryptoMatch = text.match(/([\d,]+(?:\.\d+)?)\s*(USDT|USDC|BTC|ETH)/i);

        if (fiatMatch && cryptoMatch) {
          orders.push({
            binanceOrderId: orderId,
            amount: parseFloat(fiatMatch[1].replace(/,/g, '')),
            currency: fiatMatch[2].toUpperCase(),
            cryptoAmount: parseFloat(cryptoMatch[1].replace(/,/g, '')),
            cryptoCurrency: cryptoMatch[2].toUpperCase(),
            price: 0,
            buyerName: '',
          });
        }
      }
    }

    // Also try extracting from page content directly as fallback
    if (orders.length === 0) {
      const pageContent = await page.content();

      // Look for order patterns in the full page HTML
      const orderIdRegex = /order[_-]?(?:id|number|no)['":\s]*['"]?(\d{18,20})/gi;
      let match;
      while ((match = orderIdRegex.exec(pageContent)) !== null) {
        const orderId = match[1];
        if (!processedOrders.has(orderId)) {
          console.log(`[Monitor] Found order ID in page: ${orderId} (needs manual verification)`);
        }
      }
    }
  } catch (err) {
    console.error('[Monitor] Error scanning orders:', err);
  }

  return orders;
}

/**
 * Process a detected P2P order - create it in the database
 */
async function processOrder(order: {
  binanceOrderId: string;
  amount: number;
  currency: string;
  cryptoAmount: number;
  cryptoCurrency: string;
  price: number;
  buyerName: string;
}): Promise<void> {
  if (!MERCHANT_ID) return;

  console.log(`[Monitor] Processing new order: ${order.binanceOrderId}`);
  console.log(`[Monitor] Amount: ${order.amount} ${order.currency}, Crypto: ${order.cryptoAmount} ${order.cryptoCurrency}`);

  try {
    // Check if order already exists
    const existing = await prisma.order.findUnique({
      where: { binanceOrderId: order.binanceOrderId },
    });

    if (existing) {
      processedOrders.add(order.binanceOrderId);
      console.log(`[Monitor] Order ${order.binanceOrderId} already exists, skipping.`);
      return;
    }

    // Get fee configuration
    const feeConfig = await prisma.systemConfig.findUnique({
      where: { merchantId_configKey: { merchantId: MERCHANT_ID, configKey: 'fee_percent' } },
    });
    const feePercent = parseFloat(feeConfig?.configValue || '2.0');

    const feeAmount = order.amount * (feePercent / 100);
    const netPayout = order.amount - feeAmount;
    const exchangeRate = order.cryptoAmount > 0 ? order.amount / order.cryptoAmount : 0;

    // Generate reference
    const reference = `NGP-${Date.now().toString(36).toUpperCase()}`;

    // Create the order
    const newOrder = await prisma.order.create({
      data: {
        merchantId: MERCHANT_ID,
        binanceOrderId: order.binanceOrderId,
        orderReference: reference,
        cryptoReceived: order.cryptoAmount,
        cryptoCurrency: order.cryptoCurrency,
        cryptoNetwork: 'TRC20',
        exchangeRate,
        fiatAmount: order.amount,
        fiatCurrency: order.currency,
        feeAmount,
        feePercent,
        netPayout,
        customerPhone: '', // Will be filled from Binance order details or manually
        status: 'verified',
        verifiedAt: new Date(),
      },
    });

    // Create payout record
    const payout = await prisma.payout.create({
      data: {
        merchantId: MERCHANT_ID,
        orderId: newOrder.id,
        amount: netPayout,
        currency: order.currency,
        provider: 'ussd',
        recipientPhone: '', // Will be set when phone is known
        reference: `PAY-${reference}`,
        status: 'queued',
      },
    });

    // Log the event
    await prisma.orderLog.create({
      data: {
        orderId: newOrder.id,
        level: 'info',
        message: `Order detected from Binance P2P: ${order.binanceOrderId}`,
        metadata: {
          binanceOrderId: order.binanceOrderId,
          cryptoAmount: order.cryptoAmount,
          cryptoCurrency: order.cryptoCurrency,
          fiatAmount: order.amount,
          fiatCurrency: order.currency,
        },
      },
    });

    processedOrders.add(order.binanceOrderId);

    const fmtAmount = new Intl.NumberFormat('en-UG', { maximumFractionDigits: 0 }).format(netPayout);

    console.log(`[Monitor] Order created: ${reference} | Payout: ${fmtAmount} ${order.currency}`);

    // Send Telegram notification
    await sendTelegramNotification(
      `<b>New P2P Order Detected</b>\n\n` +
      `Order: <code>${reference}</code>\n` +
      `Binance: <code>${order.binanceOrderId}</code>\n` +
      `Crypto: ${order.cryptoAmount} ${order.cryptoCurrency}\n` +
      `Payout: ${fmtAmount} ${order.currency}\n\n` +
      `Waiting for Android device to process USSD payout...`
    );
  } catch (err) {
    console.error(`[Monitor] Failed to process order ${order.binanceOrderId}:`, err);
  }
}

/**
 * Main monitoring loop
 */
async function monitorLoop(): Promise<void> {
  while (true) {
    try {
      const enabled = await isMonitoringEnabled();

      if (enabled && !isMonitoring) {
        isMonitoring = true;
        console.log('[Monitor] Monitoring ENABLED. Scanning for orders...');

        // Navigate to orders page
        if (page) {
          await page.goto(BINANCE_P2P_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
          await page.waitForTimeout(2000);
        }
      } else if (!enabled && isMonitoring) {
        isMonitoring = false;
        console.log('[Monitor] Monitoring DISABLED.');
      }

      if (isMonitoring && page) {
        // Refresh the orders page
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(2000);

        // Scan for new orders
        const newOrders = await scanForNewOrders();

        if (newOrders.length > 0) {
          console.log(`[Monitor] Found ${newOrders.length} new order(s)`);
          for (const order of newOrders) {
            await processOrder(order);
          }
        }
      }
    } catch (err) {
      console.error('[Monitor] Loop error:', err);
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
  }
}

/**
 * Load already-processed orders from DB to avoid reprocessing
 */
async function loadProcessedOrders(): Promise<void> {
  if (!MERCHANT_ID) return;

  try {
    const orders = await prisma.order.findMany({
      where: { merchantId: MERCHANT_ID, binanceOrderId: { not: null } },
      select: { binanceOrderId: true },
    });

    for (const order of orders) {
      if (order.binanceOrderId) {
        processedOrders.add(order.binanceOrderId);
      }
    }

    console.log(`[Monitor] Loaded ${processedOrders.size} previously processed orders.`);
  } catch (err) {
    console.error('[Monitor] Failed to load processed orders:', err);
  }
}

/**
 * Graceful shutdown
 */
async function shutdown(): Promise<void> {
  console.log('[Monitor] Shutting down...');
  if (context) await context.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

/**
 * Main entry point
 */
async function main(): Promise<void> {
  console.log('=== NgaboPay Binance P2P Monitor ===');
  console.log(`Merchant ID: ${MERCHANT_ID || '(not set - set MERCHANT_ID env var)'}`);

  if (!MERCHANT_ID) {
    console.error('[Monitor] MERCHANT_ID is required. Set it in .env file.');
    process.exit(1);
  }

  await loadProcessedOrders();
  await launchBrowser();
  await monitorLoop();
}

main().catch((err) => {
  console.error('[Monitor] Fatal error:', err);
  process.exit(1);
});
