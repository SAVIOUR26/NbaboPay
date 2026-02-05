import { Request } from 'express';

/**
 * Extended Express Request with authenticated merchant information
 */
export interface AuthenticatedRequest extends Request {
  merchantId?: string;
  merchant?: any;
}
