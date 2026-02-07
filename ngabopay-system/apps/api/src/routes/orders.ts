import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authMiddleware } from '../middleware/auth';
import { logger } from '../utils/logger';
import { Decimal } from '@prisma/client/runtime/library';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// GET /api/orders - List orders for merchant
router.get('/', async (req, res, next) => {
  try {
    const merchantId = req.user!.id;
    const { status, page = '1', limit = '20' } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: any = { merchantId };
    if (status) {
      where.status = status;
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          payout: {
            select: {
              id: true,
              status: true,
              provider: true,
              completedAt: true,
            },
          },
        },
      }),
      prisma.order.count({ where }),
    ]);

    res.json({
      orders,
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

// GET /api/orders/:id - Get order details
router.get('/:id', async (req, res, next) => {
  try {
    const merchantId = req.user!.id;
    const { id } = req.params;

    const order = await prisma.order.findFirst({
      where: { id, merchantId },
      include: {
        payout: true,
        deposit: true,
        logs: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ order });
  } catch (error) {
    next(error);
  }
});

// POST /api/orders - Create new order (usually triggered by deposit detection)
router.post('/', async (req, res, next) => {
  try {
    const merchantId = req.user!.id;
    const {
      cryptoAmount,
      cryptoCurrency = 'USDT',
      cryptoNetwork = 'TRC20',
      customerPhone,
      customerEmail,
      customerName,
      exchangeRate,
      fiatCurrency = 'UGX',
    } = req.body;

    if (!cryptoAmount || !customerPhone || !exchangeRate) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['cryptoAmount', 'customerPhone', 'exchangeRate'],
      });
    }

    // Calculate amounts
    const crypto = new Decimal(cryptoAmount);
    const rate = new Decimal(exchangeRate);
    const feePercent = new Decimal(process.env.TRANSACTION_FEE_PERCENT || '2.0');

    const fiatAmount = crypto.mul(rate);
    const feeAmount = fiatAmount.mul(feePercent).div(100);
    const netPayout = fiatAmount.sub(feeAmount);

    // Generate order reference
    const orderCount = await prisma.order.count({ where: { merchantId } });
    const orderReference = `NGP-${Date.now().toString(36).toUpperCase()}-${(orderCount + 1).toString().padStart(4, '0')}`;

    const order = await prisma.order.create({
      data: {
        merchantId,
        orderReference,
        cryptoReceived: crypto,
        cryptoCurrency,
        cryptoNetwork,
        exchangeRate: rate,
        rateLockedAt: new Date(),
        fiatAmount,
        fiatCurrency,
        feeAmount,
        feePercent,
        netPayout,
        customerPhone,
        customerEmail,
        customerName,
        status: 'pending',
      },
    });

    // Log order creation
    await prisma.orderLog.create({
      data: {
        orderId: order.id,
        level: 'info',
        message: 'Order created',
        metadata: { cryptoAmount, exchangeRate, fiatAmount: fiatAmount.toString() },
      },
    });

    logger.info(`Order created: ${orderReference}`, { orderId: order.id, merchantId });

    res.status(201).json({
      message: 'Order created successfully',
      order,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/orders/:id/status - Update order status
router.patch('/:id/status', async (req, res, next) => {
  try {
    const merchantId = req.user!.id;
    const { id } = req.params;
    const { status, note } = req.body;

    const validStatuses = ['pending', 'verified', 'approved', 'paid', 'completed', 'failed', 'cancelled'];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status',
        validStatuses,
      });
    }

    const order = await prisma.order.findFirst({
      where: { id, merchantId },
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const previousStatus = order.status;

    // Update order
    const updateData: any = { status };

    if (status === 'completed') {
      updateData.completedAt = new Date();
    } else if (status === 'failed') {
      updateData.failedAt = new Date();
    } else if (status === 'verified') {
      updateData.verifiedAt = new Date();
    } else if (status === 'approved') {
      updateData.approvedAt = new Date();
      updateData.approvedBy = merchantId;
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: updateData,
    });

    // Log status change
    await prisma.orderLog.create({
      data: {
        orderId: id,
        level: 'info',
        message: `Status changed from ${previousStatus} to ${status}`,
        metadata: { previousStatus, newStatus: status, note },
      },
    });

    logger.info(`Order ${order.orderReference} status updated: ${previousStatus} -> ${status}`);

    res.json({
      message: 'Order status updated',
      order: updatedOrder,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/orders/:id/approve - Approve order for payout
router.post('/:id/approve', async (req, res, next) => {
  try {
    const merchantId = req.user!.id;
    const { id } = req.params;

    const order = await prisma.order.findFirst({
      where: { id, merchantId, status: 'verified' },
    });

    if (!order) {
      return res.status(404).json({
        error: 'Order not found or not in verified status'
      });
    }

    // Update order to approved
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        status: 'approved',
        approvedAt: new Date(),
        approvedBy: merchantId,
      },
    });

    // Create payout record
    const payoutRef = `PAY-${Date.now().toString(36).toUpperCase()}`;

    await prisma.payout.create({
      data: {
        merchantId,
        orderId: id,
        amount: order.netPayout,
        currency: order.fiatCurrency,
        provider: 'MTN', // Default, can be configured
        recipientPhone: order.customerPhone,
        recipientName: order.customerName,
        reference: payoutRef,
        status: 'queued',
      },
    });

    await prisma.orderLog.create({
      data: {
        orderId: id,
        level: 'info',
        message: 'Order approved and payout queued',
        metadata: { payoutRef },
      },
    });

    logger.info(`Order approved: ${order.orderReference}, payout queued: ${payoutRef}`);

    res.json({
      message: 'Order approved, payout notification will be sent',
      order: updatedOrder,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
