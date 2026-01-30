import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authMiddleware } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

router.use(authMiddleware);

// GET /api/payouts - List payouts for merchant
router.get('/', async (req, res, next) => {
  try {
    const merchantId = req.merchantId!;
    const { status, page = '1', limit = '20' } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: any = { merchantId };
    if (status) {
      where.status = status;
    }

    const [payouts, total] = await Promise.all([
      prisma.payout.findMany({
        where,
        orderBy: { queuedAt: 'desc' },
        skip,
        take,
        include: {
          order: {
            select: {
              id: true,
              orderReference: true,
              customerPhone: true,
              cryptoReceived: true,
              cryptoCurrency: true,
            },
          },
        },
      }),
      prisma.payout.count({ where }),
    ]);

    res.json({
      payouts,
      pagination: {
        page: parseInt(page as string),
        limit: take,
        total,
        pages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/payouts/:id - Get payout details
router.get('/:id', async (req, res, next) => {
  try {
    const merchantId = req.merchantId!;
    const { id } = req.params;

    const payout = await prisma.payout.findFirst({
      where: { id, merchantId },
      include: {
        order: true,
      },
    });

    if (!payout) {
      return res.status(404).json({ error: 'Payout not found' });
    }

    res.json({ payout });
  } catch (error) {
    next(error);
  }
});

// POST /api/payouts/:id/confirm - Confirm payout was completed manually
router.post('/:id/confirm', async (req, res, next) => {
  try {
    const merchantId = req.merchantId!;
    const { id } = req.params;
    const { transactionId, confirmationSms } = req.body;

    const payout = await prisma.payout.findFirst({
      where: { id, merchantId },
    });

    if (!payout) {
      return res.status(404).json({ error: 'Payout not found' });
    }

    if (payout.status === 'completed') {
      return res.status(400).json({ error: 'Payout already completed' });
    }

    // Update payout as completed
    const updatedPayout = await prisma.payout.update({
      where: { id },
      data: {
        status: 'completed',
        transactionId,
        confirmationSms,
        completedAt: new Date(),
      },
    });

    // Update order status
    await prisma.order.update({
      where: { id: payout.orderId },
      data: {
        status: 'completed',
        completedAt: new Date(),
      },
    });

    // Log the completion
    await prisma.orderLog.create({
      data: {
        orderId: payout.orderId,
        level: 'info',
        message: 'Payout confirmed manually',
        metadata: { payoutId: id, transactionId },
      },
    });

    logger.info(`Payout confirmed: ${payout.reference}`, { payoutId: id, merchantId });

    res.json({
      message: 'Payout confirmed successfully',
      payout: updatedPayout,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/payouts/:id/retry - Retry failed payout
router.post('/:id/retry', async (req, res, next) => {
  try {
    const merchantId = req.merchantId!;
    const { id } = req.params;

    const payout = await prisma.payout.findFirst({
      where: { id, merchantId, status: 'failed' },
    });

    if (!payout) {
      return res.status(404).json({
        error: 'Failed payout not found',
      });
    }

    if (payout.retryCount >= payout.maxRetries) {
      return res.status(400).json({
        error: 'Maximum retries exceeded',
      });
    }

    // Reset payout status to queued for retry
    const updatedPayout = await prisma.payout.update({
      where: { id },
      data: {
        status: 'queued',
        retryCount: payout.retryCount + 1,
        lastRetryAt: new Date(),
        errorMessage: null,
        errorCode: null,
      },
    });

    await prisma.orderLog.create({
      data: {
        orderId: payout.orderId,
        level: 'info',
        message: `Payout retry queued (attempt ${updatedPayout.retryCount})`,
        metadata: { payoutId: id },
      },
    });

    logger.info(`Payout retry queued: ${payout.reference}`, { payoutId: id, attempt: updatedPayout.retryCount });

    res.json({
      message: 'Payout queued for retry',
      payout: updatedPayout,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/payouts/:id/fail - Mark payout as failed
router.post('/:id/fail', async (req, res, next) => {
  try {
    const merchantId = req.merchantId!;
    const { id } = req.params;
    const { errorMessage, errorCode } = req.body;

    const payout = await prisma.payout.findFirst({
      where: { id, merchantId },
    });

    if (!payout) {
      return res.status(404).json({ error: 'Payout not found' });
    }

    const updatedPayout = await prisma.payout.update({
      where: { id },
      data: {
        status: 'failed',
        failedAt: new Date(),
        errorMessage,
        errorCode,
      },
    });

    await prisma.order.update({
      where: { id: payout.orderId },
      data: { status: 'failed', failedAt: new Date() },
    });

    await prisma.orderLog.create({
      data: {
        orderId: payout.orderId,
        level: 'error',
        message: 'Payout failed',
        metadata: { payoutId: id, errorMessage, errorCode },
      },
    });

    logger.error(`Payout failed: ${payout.reference}`, { payoutId: id, errorMessage });

    res.json({
      message: 'Payout marked as failed',
      payout: updatedPayout,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
