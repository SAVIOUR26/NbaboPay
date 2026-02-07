import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authMiddleware } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

router.use(authMiddleware);

// GET /api/wallets - List wallets for merchant
router.get('/', async (req, res, next) => {
  try {
    const merchantId = req.user!.id;

    const wallets = await prisma.wallet.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { deposits: true },
        },
      },
    });

    res.json({ wallets });
  } catch (error) {
    next(error);
  }
});

// POST /api/wallets - Create new wallet
router.post('/', async (req, res, next) => {
  try {
    const merchantId = req.user!.id;
    const { network, address, label } = req.body;

    if (!network || !address) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['network', 'address'],
      });
    }

    const validNetworks = ['TRC20', 'BSC', 'ETH'];
    if (!validNetworks.includes(network)) {
      return res.status(400).json({
        error: 'Invalid network',
        validNetworks,
      });
    }

    // Check if address already exists
    const existing = await prisma.wallet.findUnique({
      where: { address },
    });

    if (existing) {
      return res.status(409).json({
        error: 'Wallet address already registered',
      });
    }

    const wallet = await prisma.wallet.create({
      data: {
        merchantId,
        network,
        address,
        label,
      },
    });

    logger.info(`New wallet added: ${address} (${network})`, { merchantId });

    res.status(201).json({
      message: 'Wallet created successfully',
      wallet,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/wallets/:id - Get wallet details
router.get('/:id', async (req, res, next) => {
  try {
    const merchantId = req.user!.id;
    const { id } = req.params;

    const wallet = await prisma.wallet.findFirst({
      where: { id, merchantId },
      include: {
        deposits: {
          orderBy: { detectedAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    res.json({ wallet });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/wallets/:id - Update wallet
router.patch('/:id', async (req, res, next) => {
  try {
    const merchantId = req.user!.id;
    const { id } = req.params;
    const { label, isActive } = req.body;

    const wallet = await prisma.wallet.findFirst({
      where: { id, merchantId },
    });

    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    const updatedWallet = await prisma.wallet.update({
      where: { id },
      data: {
        ...(label !== undefined && { label }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    res.json({
      message: 'Wallet updated',
      wallet: updatedWallet,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/wallets/:id - Delete wallet
router.delete('/:id', async (req, res, next) => {
  try {
    const merchantId = req.user!.id;
    const { id } = req.params;

    const wallet = await prisma.wallet.findFirst({
      where: { id, merchantId },
    });

    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    // Soft delete by deactivating
    await prisma.wallet.update({
      where: { id },
      data: { isActive: false },
    });

    logger.info(`Wallet deactivated: ${wallet.address}`, { merchantId });

    res.json({ message: 'Wallet deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;
