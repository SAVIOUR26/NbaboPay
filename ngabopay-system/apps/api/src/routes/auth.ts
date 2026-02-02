import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma';
import { config } from '../config';
import { logger } from '../utils/logger';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, businessName, phone, country } = req.body;

    // Validate required fields
    if (!email || !password || !businessName || !phone || !country) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['email', 'password', 'businessName', 'phone', 'country'],
      });
    }

    // Check if merchant already exists
    const existing = await prisma.merchant.findUnique({
      where: { email },
    });

    if (existing) {
      return res.status(409).json({
        error: 'Email already registered',
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create merchant
    const merchant = await prisma.merchant.create({
      data: {
        email,
        passwordHash,
        businessName,
        phone,
        country,
      },
      select: {
        id: true,
        email: true,
        businessName: true,
        phone: true,
        country: true,
        createdAt: true,
      },
    });

    logger.info(`New merchant registered: ${merchant.email}`);

    // Generate JWT
    const token = jwt.sign(
      { merchantId: merchant.id, email: merchant.email },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
    );

    res.status(201).json({
      message: 'Registration successful',
      merchant,
      token,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required',
      });
    }

    // Find merchant
    const merchant = await prisma.merchant.findUnique({
      where: { email },
    });

    if (!merchant) {
      return res.status(401).json({
        error: 'Invalid email or password',
      });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, merchant.passwordHash);

    if (!isValid) {
      return res.status(401).json({
        error: 'Invalid email or password',
      });
    }

    if (!merchant.isActive) {
      return res.status(403).json({
        error: 'Account is disabled',
      });
    }

    // Update last login
    await prisma.merchant.update({
      where: { id: merchant.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate JWT
    const token = jwt.sign(
      { merchantId: merchant.id, email: merchant.email },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
    );

    logger.info(`Merchant logged in: ${merchant.email}`);

    res.json({
      message: 'Login successful',
      merchant: {
        id: merchant.id,
        email: merchant.email,
        businessName: merchant.businessName,
        country: merchant.country,
      },
      token,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  // JWT is stateless, so logout is handled client-side
  // This endpoint exists for audit logging purposes
  res.json({ message: 'Logged out successfully' });
});

export default router;
