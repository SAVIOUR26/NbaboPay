import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import logger from '../utils/logger';
import { ApiResponse } from '../types';
import { config } from '../config';

/**
 * Custom API Error class
 */
export class ApiError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(statusCode: number, message: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Not Found Error
 */
export class NotFoundError extends ApiError {
  constructor(resource = 'Resource') {
    super(404, `${resource} not found`);
  }
}

/**
 * Validation Error
 */
export class ValidationError extends ApiError {
  constructor(message: string) {
    super(400, message);
  }
}

/**
 * Unauthorized Error
 */
export class UnauthorizedError extends ApiError {
  constructor(message = 'Unauthorized access') {
    super(401, message);
  }
}

/**
 * Forbidden Error
 */
export class ForbiddenError extends ApiError {
  constructor(message = 'Access forbidden') {
    super(403, message);
  }
}

/**
 * Conflict Error (e.g., duplicate resource)
 */
export class ConflictError extends ApiError {
  constructor(message: string) {
    super(409, message);
  }
}

/**
 * Handle Prisma errors
 */
function handlePrismaError(error: Prisma.PrismaClientKnownRequestError): ApiError {
  switch (error.code) {
    case 'P2002': {
      // Unique constraint violation
      const field = (error.meta?.target as string[])?.join(', ') || 'field';
      return new ConflictError(`A record with this ${field} already exists`);
    }
    case 'P2003': {
      // Foreign key constraint violation
      return new ValidationError('Related record not found');
    }
    case 'P2025': {
      // Record not found
      return new NotFoundError('Record');
    }
    default:
      logger.error('Unhandled Prisma error', { code: error.code, meta: error.meta });
      return new ApiError(500, 'Database operation failed');
  }
}

/**
 * Global error handling middleware
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void => {
  // Log the error
  logger.error('Error occurred', {
    error: err.message,
    stack: config.nodeEnv === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  // Handle Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    err = handlePrismaError(err);
  }

  // Handle Prisma validation errors
  if (err instanceof Prisma.PrismaClientValidationError) {
    err = new ValidationError('Invalid data provided');
  }

  // Default to ApiError handling
  if (err instanceof ApiError) {
    const response: ApiResponse = {
      success: false,
      error: err.message,
    };

    // Include stack trace in development
    if (config.nodeEnv === 'development') {
      (response as Record<string, unknown>).stack = err.stack;
    }

    res.status(err.statusCode).json(response);
    return;
  }

  // Handle syntax errors (malformed JSON)
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      success: false,
      error: 'Invalid JSON',
      message: 'The request body contains invalid JSON',
    });
    return;
  }

  // Handle unknown errors
  const response: ApiResponse = {
    success: false,
    error: config.nodeEnv === 'production'
      ? 'Internal server error'
      : err.message,
  };

  // Include stack trace in development
  if (config.nodeEnv === 'development') {
    (response as Record<string, unknown>).stack = err.stack;
  }

  res.status(500).json(response);
};

/**
 * 404 Not Found handler for undefined routes
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`,
  });
};

/**
 * Async handler wrapper to catch promise rejections
 */
export const asyncHandler = <T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export default errorHandler;
