import { Worker, Queue } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { sendWhatsAppNotification, sendTelegramAlert } from './notifications';
import { logger } from './logger';
import dotenv from 'dotenv';

dotenv.config({ path: '../../.env.production' });

const prisma = new PrismaClient();

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// Define queues
export const payoutQueue = new Queue('payout-notifications', { connection });
export const blockchainQueue = new Queue('blockchain-monitor', { connection });
export const binanceQueue = new Queue('binance-monitor', { connection });

// Payout notification worker - sends WhatsApp messages
const payoutWorker = new Worker(
  'payout-notifications',
  async (job) => {
    const { payoutId, orderId, amount, currency, customerPhone, orderReference } = job.data;

    logger.info(`Processing payout notification: ${orderReference}`, { payoutId });

    try {
      // Format amount with commas
      const formattedAmount = new Intl.NumberFormat('en-UG').format(amount);

      // Send WhatsApp notification
      const message = `💰 *PAYOUT REQUEST*

Amount: *${formattedAmount} ${currency}*
Phone: *${customerPhone}*
Order: *#${orderReference}*

Please send the mobile money payment and confirm in the dashboard.`;

      await sendWhatsAppNotification(message);

      // Update payout status
      await prisma.payout.update({
        where: { id: payoutId },
        data: {
          status: 'processing',
          startedAt: new Date(),
        },
      });

      // Log success
      await prisma.orderLog.create({
        data: {
          orderId,
          level: 'info',
          message: 'WhatsApp notification sent successfully',
          metadata: { payoutId, customerPhone },
        },
      });

      logger.info(`WhatsApp notification sent for order ${orderReference}`);

      return { success: true, message: 'Notification sent' };
    } catch (error: any) {
      logger.error(`Failed to send notification for ${orderReference}`, { error: error.message });

      // Update payout with error
      await prisma.payout.update({
        where: { id: payoutId },
        data: {
          errorMessage: error.message,
          lastRetryAt: new Date(),
        },
      });

      // Send Telegram alert for failures
      await sendTelegramAlert(`⚠️ Payout notification failed for order ${orderReference}: ${error.message}`);

      throw error;
    }
  },
  {
    connection,
    concurrency: 1,
    limiter: {
      max: 10,
      duration: 60000, // Max 10 messages per minute
    },
  }
);

// Blockchain monitoring worker
const blockchainWorker = new Worker(
  'blockchain-monitor',
  async (job) => {
    const { walletId, network } = job.data;

    logger.info(`Checking blockchain deposits for wallet ${walletId} on ${network}`);

    // TODO: Implement blockchain monitoring logic
    // This would use TronGrid API for TRC20 or BSCScan API for BSC

    return { checked: true };
  },
  { connection }
);

// Binance rate monitoring worker
const binanceWorker = new Worker(
  'binance-monitor',
  async (job) => {
    logger.info('Updating exchange rates from Binance P2P');

    // TODO: Implement Binance P2P rate fetching
    // This would use Playwright to scrape rates

    return { updated: true };
  },
  { connection }
);

// Event handlers
payoutWorker.on('completed', (job) => {
  logger.info(`Payout job ${job.id} completed`);
});

payoutWorker.on('failed', (job, err) => {
  logger.error(`Payout job ${job?.id} failed`, { error: err.message });
});

blockchainWorker.on('completed', (job) => {
  logger.debug(`Blockchain job ${job.id} completed`);
});

binanceWorker.on('completed', (job) => {
  logger.debug(`Binance job ${job.id} completed`);
});

// Schedule recurring jobs
async function scheduleRecurringJobs() {
  // Check blockchain every 30 seconds
  const wallets = await prisma.wallet.findMany({
    where: { isActive: true },
  });

  for (const wallet of wallets) {
    await blockchainQueue.add(
      'check-deposits',
      { walletId: wallet.id, network: wallet.network },
      {
        repeat: { every: 30000 },
        jobId: `blockchain-${wallet.id}`,
      }
    );
  }

  // Update exchange rates every 5 minutes
  await binanceQueue.add(
    'update-rates',
    {},
    {
      repeat: { every: 300000 },
      jobId: 'binance-rates',
    }
  );

  logger.info('Recurring jobs scheduled');
}

// Graceful shutdown
async function shutdown() {
  logger.info('Shutting down workers...');
  await payoutWorker.close();
  await blockchainWorker.close();
  await binanceWorker.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start workers
async function main() {
  logger.info('Starting NgaboPay workers...');
  logger.info(`Redis: ${process.env.REDIS_URL || 'redis://localhost:6379'}`);

  await scheduleRecurringJobs();

  logger.info('Workers started successfully');
  logger.info('- Payout notification worker: active');
  logger.info('- Blockchain monitoring worker: active');
  logger.info('- Binance rate worker: active');
}

main().catch((error) => {
  logger.error('Failed to start workers', { error: error.message });
  process.exit(1);
});
