import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain, body, param, query } from 'express-validator';
import { FiatCurrencies, CryptoCurrencies, CryptoNetworks, Countries, OrderStatus } from '../types';

/**
 * Middleware to validate request and return errors
 */
export const validate = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Run all validations
    await Promise.all(validations.map(validation => validation.run(req)));

    // Check for errors
    const errors = validationResult(req);

    if (errors.isEmpty()) {
      next();
      return;
    }

    // Format errors
    const formattedErrors = errors.array().map(err => ({
      field: 'path' in err ? err.path : 'unknown',
      message: err.msg,
    }));

    res.status(400).json({
      success: false,
      error: 'Validation failed',
      message: 'One or more fields have invalid values',
      details: formattedErrors,
    });
  };
};

// ============================================
// AUTH VALIDATORS
// ============================================

export const loginValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
];

export const registerValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number'),
  body('businessName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Business name must be between 2 and 100 characters'),
  body('phone')
    .trim()
    .matches(/^\+?[0-9]{10,15}$/)
    .withMessage('Please provide a valid phone number'),
  body('country')
    .isIn(Countries)
    .withMessage(`Country must be one of: ${Countries.join(', ')}`),
];

// ============================================
// ORDER VALIDATORS
// ============================================

export const createOrderValidation = [
  body('cryptoAmount')
    .isFloat({ min: 1 })
    .withMessage('Crypto amount must be greater than 0'),
  body('cryptoCurrency')
    .isIn(CryptoCurrencies)
    .withMessage(`Crypto currency must be one of: ${CryptoCurrencies.join(', ')}`),
  body('cryptoNetwork')
    .isIn(CryptoNetworks)
    .withMessage(`Crypto network must be one of: ${CryptoNetworks.join(', ')}`),
  body('fiatCurrency')
    .isIn(FiatCurrencies)
    .withMessage(`Fiat currency must be one of: ${FiatCurrencies.join(', ')}`),
  body('customerPhone')
    .trim()
    .matches(/^\+?[0-9]{10,15}$/)
    .withMessage('Please provide a valid customer phone number'),
  body('customerEmail')
    .optional()
    .isEmail()
    .withMessage('Please provide a valid customer email'),
  body('customerName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Customer name must be between 2 and 100 characters'),
];

export const updateOrderStatusValidation = [
  param('id')
    .isUUID()
    .withMessage('Invalid order ID format'),
  body('status')
    .isIn(Object.values(OrderStatus))
    .withMessage(`Status must be one of: ${Object.values(OrderStatus).join(', ')}`),
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason must not exceed 500 characters'),
];

export const orderIdValidation = [
  param('id')
    .isUUID()
    .withMessage('Invalid order ID format'),
];

export const listOrdersValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('status')
    .optional()
    .isIn(Object.values(OrderStatus))
    .withMessage(`Status must be one of: ${Object.values(OrderStatus).join(', ')}`),
  query('fiatCurrency')
    .optional()
    .isIn(FiatCurrencies)
    .withMessage(`Fiat currency must be one of: ${FiatCurrencies.join(', ')}`),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
];

// ============================================
// WALLET VALIDATORS
// ============================================

export const createWalletValidation = [
  body('network')
    .isIn(CryptoNetworks)
    .withMessage(`Network must be one of: ${CryptoNetworks.join(', ')}`),
  body('address')
    .trim()
    .isLength({ min: 26, max: 100 })
    .withMessage('Please provide a valid wallet address'),
  body('label')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Label must not exceed 50 characters'),
];

export const listWalletsValidation = [
  query('network')
    .optional()
    .isIn(CryptoNetworks)
    .withMessage(`Network must be one of: ${CryptoNetworks.join(', ')}`),
  query('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];

// ============================================
// EXCHANGE RATE VALIDATORS
// ============================================

export const exchangeRatesValidation = [
  query('fromCurrency')
    .optional()
    .isIn(CryptoCurrencies)
    .withMessage(`From currency must be one of: ${CryptoCurrencies.join(', ')}`),
  query('toCurrency')
    .optional()
    .isIn(FiatCurrencies)
    .withMessage(`To currency must be one of: ${FiatCurrencies.join(', ')}`),
];

export default validate;
