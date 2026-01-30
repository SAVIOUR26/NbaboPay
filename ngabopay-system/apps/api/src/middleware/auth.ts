import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest } from '../types';
import { config } from '../config';
import prisma from '../utils/prisma';
import logger from '../utils/logger';

interface JwtPayload {
  id: string;
  email: string;
  iat: number;
  exp: number;
}

/**
 * JWT Authentication middleware
 * Validates the Bearer token and attaches the merchant to the request
 */
export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'Please provide a valid Bearer token in the Authorization header',
      });
      return;
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Invalid token format',
        message: 'Bearer token is missing',
      });
      return;
    }

    // Verify the token
    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        res.status(401).json({
          success: false,
          error: 'Token expired',
          message: 'Your session has expired. Please log in again.',
        });
        return;
      }
      if (error instanceof jwt.JsonWebTokenError) {
        res.status(401).json({
          success: false,
          error: 'Invalid token',
          message: 'The provided token is invalid',
        });
        return;
      }
      throw error;
    }

    // Fetch the merchant from database
    const merchant = await prisma.merchant.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        businessName: true,
        country: true,
        isActive: true,
      },
    });

    if (!merchant) {
      res.status(401).json({
        success: false,
        error: 'Merchant not found',
        message: 'The merchant associated with this token no longer exists',
      });
      return;
    }

    if (!merchant.isActive) {
      res.status(403).json({
        success: false,
        error: 'Account deactivated',
        message: 'Your account has been deactivated. Please contact support.',
      });
      return;
    }

    // Attach merchant to request
    req.user = merchant;

    // Update last login timestamp (non-blocking)
    prisma.merchant.update({
      where: { id: merchant.id },
      data: { lastLoginAt: new Date() },
    }).catch((err) => {
      logger.warn('Failed to update last login timestamp', { error: err.message });
    });

    next();
  } catch (error) {
    logger.error('Authentication error', { error });
    res.status(500).json({
      success: false,
      error: 'Authentication failed',
      message: 'An error occurred during authentication',
    });
  }
};

/**
 * Optional authentication middleware
 * Does not fail if no token is provided, but validates it if present
 */
export const optionalAuthenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  await authenticate(req, res, next);
};

/**
 * Generate JWT token for a merchant
 */
export const generateToken = (merchantId: string, email: string): string => {
  return jwt.sign(
    { id: merchantId, email },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
};

/**
 * Verify and decode a JWT token
 */
export const verifyToken = (token: string): JwtPayload | null => {
  try {
    return jwt.verify(token, config.jwtSecret) as JwtPayload;
  } catch {
    return null;
  }
};

export default authenticate;
