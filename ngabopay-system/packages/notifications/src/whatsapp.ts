import axios, { AxiosError } from 'axios';

/**
 * WhatsApp Cloud API client for NgaboPay notifications
 * Uses Meta WhatsApp Business Cloud API
 */

const WHATSAPP_API_VERSION = 'v17.0';
const WHATSAPP_API_BASE_URL = 'https://graph.facebook.com';

interface WhatsAppMessageResponse {
  messaging_product: string;
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
}

interface WhatsAppErrorResponse {
  error: {
    message: string;
    type: string;
    code: number;
    fbtrace_id: string;
  };
}

interface SendMessageOptions {
  to: string;
  message: string;
}

/**
 * Get WhatsApp API configuration from environment variables
 */
function getConfig() {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId) {
    throw new Error('WHATSAPP_PHONE_NUMBER_ID environment variable is not set');
  }

  if (!accessToken) {
    throw new Error('WHATSAPP_ACCESS_TOKEN environment variable is not set');
  }

  return { phoneNumberId, accessToken };
}

/**
 * Format phone number to international format for WhatsApp
 * Converts Ugandan numbers (0772...) to international format (256772...)
 */
function formatPhoneNumber(phone: string): string {
  // Remove any spaces, dashes, or special characters
  let cleaned = phone.replace(/[\s\-\(\)\.]/g, '');

  // If starts with 0, assume Ugandan number and replace with 256
  if (cleaned.startsWith('0')) {
    cleaned = '256' + cleaned.substring(1);
  }

  // If doesn't start with +, ensure it's clean
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }

  return cleaned;
}

/**
 * Format currency amount with thousand separators
 */
function formatAmount(amount: number): string {
  return amount.toLocaleString('en-UG');
}

/**
 * Send a text message via WhatsApp Cloud API
 */
async function sendMessage(options: SendMessageOptions): Promise<WhatsAppMessageResponse> {
  const { phoneNumberId, accessToken } = getConfig();
  const { to, message } = options;

  const url = `${WHATSAPP_API_BASE_URL}/${WHATSAPP_API_VERSION}/${phoneNumberId}/messages`;

  try {
    const response = await axios.post<WhatsAppMessageResponse>(
      url,
      {
        messaging_product: 'whatsapp',
        to: formatPhoneNumber(to),
        type: 'text',
        text: {
          body: message,
        },
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<WhatsAppErrorResponse>;
      const errorData = axiosError.response?.data;

      if (errorData?.error) {
        throw new Error(
          `WhatsApp API Error: ${errorData.error.message} (Code: ${errorData.error.code})`
        );
      }
    }
    throw error;
  }
}

/**
 * Send a payout notification via WhatsApp
 *
 * @param amount - The payout amount in UGX
 * @param phone - The recipient's phone number
 * @param orderRef - The order reference number (e.g., "NGP-001")
 * @returns Promise resolving to the WhatsApp API response
 *
 * @example
 * await sendPayoutNotification(185000, '0772123456', 'NGP-001');
 */
export async function sendPayoutNotification(
  amount: number,
  phone: string,
  orderRef: string
): Promise<WhatsAppMessageResponse> {
  // Ensure order reference has the # prefix
  const formattedOrderRef = orderRef.startsWith('#') ? orderRef : `#${orderRef}`;

  const message = `\u{1F4B0} PAYOUT REQUEST
Amount: ${formatAmount(amount)} UGX
Phone: ${phone}
Order: ${formattedOrderRef}
Reply CONFIRM to approve`;

  // Get admin phone number from environment or use the payout phone as default
  const adminPhone = process.env.WHATSAPP_ADMIN_PHONE || phone;

  return sendMessage({
    to: adminPhone,
    message,
  });
}

/**
 * Send a custom WhatsApp message
 *
 * @param to - Recipient phone number
 * @param message - Message text
 * @returns Promise resolving to the WhatsApp API response
 */
export async function sendWhatsAppMessage(
  to: string,
  message: string
): Promise<WhatsAppMessageResponse> {
  return sendMessage({ to, message });
}

/**
 * Send a payout confirmation notification
 *
 * @param amount - The payout amount in UGX
 * @param phone - The recipient's phone number
 * @param orderRef - The order reference number
 * @param transactionId - The transaction ID from the payment processor
 */
export async function sendPayoutConfirmation(
  amount: number,
  phone: string,
  orderRef: string,
  transactionId: string
): Promise<WhatsAppMessageResponse> {
  const formattedOrderRef = orderRef.startsWith('#') ? orderRef : `#${orderRef}`;

  const message = `\u{2705} PAYOUT CONFIRMED
Amount: ${formatAmount(amount)} UGX
Phone: ${phone}
Order: ${formattedOrderRef}
Transaction ID: ${transactionId}
Status: Completed`;

  return sendMessage({ to: phone, message });
}

/**
 * Send a payout rejection notification
 *
 * @param amount - The payout amount in UGX
 * @param phone - The recipient's phone number
 * @param orderRef - The order reference number
 * @param reason - The reason for rejection
 */
export async function sendPayoutRejection(
  amount: number,
  phone: string,
  orderRef: string,
  reason: string
): Promise<WhatsAppMessageResponse> {
  const formattedOrderRef = orderRef.startsWith('#') ? orderRef : `#${orderRef}`;

  const message = `\u{274C} PAYOUT REJECTED
Amount: ${formatAmount(amount)} UGX
Phone: ${phone}
Order: ${formattedOrderRef}
Reason: ${reason}
Contact support for assistance.`;

  return sendMessage({ to: phone, message });
}

export default {
  sendPayoutNotification,
  sendPayoutConfirmation,
  sendPayoutRejection,
  sendWhatsAppMessage,
};
