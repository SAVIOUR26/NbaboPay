import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// GET /api/exchange-rates - Get current exchange rates (public)
router.get('/', async (req, res, next) => {
  try {
    const { from = 'USDT', to } = req.query;

    const where: any = {
      fromCurrency: from as string,
      isActive: true,
      validUntil: { gte: new Date() },
    };

    if (to) {
      where.toCurrency = to as string;
    }

    const rates = await prisma.exchangeRate.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });

    // Group by currency pair, take most recent
    const latestRates = rates.reduce((acc, rate) => {
      const key = `${rate.fromCurrency}-${rate.toCurrency}`;
      if (!acc[key] || rate.updatedAt > acc[key].updatedAt) {
        acc[key] = rate;
      }
      return acc;
    }, {} as Record<string, typeof rates[0]>);

    res.json({
      rates: Object.values(latestRates),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/exchange-rates - Create/update exchange rate (admin only)
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const { fromCurrency, toCurrency, rate, source = 'manual', validMinutes = 60 } = req.body;

    if (!fromCurrency || !toCurrency || !rate) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['fromCurrency', 'toCurrency', 'rate'],
      });
    }

    const validUntil = new Date(Date.now() + validMinutes * 60 * 1000);

    // Upsert the exchange rate
    const exchangeRate = await prisma.exchangeRate.upsert({
      where: {
        fromCurrency_toCurrency_source: {
          fromCurrency,
          toCurrency,
          source,
        },
      },
      update: {
        rate,
        validUntil,
        isActive: true,
      },
      create: {
        fromCurrency,
        toCurrency,
        rate,
        source,
        validUntil,
      },
    });

    res.json({
      message: 'Exchange rate updated',
      rate: exchangeRate,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/exchange-rates/calculate - Calculate conversion
router.get('/calculate', async (req, res, next) => {
  try {
    const { amount, from = 'USDT', to = 'UGX' } = req.query;

    if (!amount) {
      return res.status(400).json({ error: 'Amount is required' });
    }

    const rate = await prisma.exchangeRate.findFirst({
      where: {
        fromCurrency: from as string,
        toCurrency: to as string,
        isActive: true,
        validUntil: { gte: new Date() },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!rate) {
      return res.status(404).json({
        error: `No active exchange rate found for ${from}/${to}`,
      });
    }

    const inputAmount = parseFloat(amount as string);
    const outputAmount = inputAmount * rate.rate.toNumber();

    res.json({
      from: {
        currency: from,
        amount: inputAmount,
      },
      to: {
        currency: to,
        amount: outputAmount,
      },
      rate: rate.rate.toNumber(),
      source: rate.source,
      validUntil: rate.validUntil,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
