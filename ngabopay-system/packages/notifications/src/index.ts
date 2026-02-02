/**
 * NgaboPay Notification Service
 *
 * Provides WhatsApp and Telegram notification capabilities for the NgaboPay system.
 * WhatsApp is the primary channel, Telegram serves as a backup.
 *
 * Environment Variables Required:
 * - WHATSAPP_PHONE_NUMBER_ID: Meta WhatsApp Business phone number ID
 * - WHATSAPP_ACCESS_TOKEN: Meta WhatsApp Business API access token
 * - WHATSAPP_ADMIN_PHONE: (Optional) Admin phone for payout approvals
 * - TELEGRAM_BOT_TOKEN: Telegram bot token
 * - TELEGRAM_CHAT_ID: Default Telegram chat ID for notifications
 */

// WhatsApp exports
export {
  sendPayoutNotification,
  sendPayoutConfirmation,
  sendPayoutRejection,
  sendWhatsAppMessage,
} from './whatsapp';

// Telegram exports
export {
  sendAlert,
  sendPayoutAlert,
  sendErrorNotification,
  sendSuccessNotification,
  sendCustomMessage,
} from './telegram';

// Default exports for namespace imports
import whatsapp from './whatsapp';
import telegram from './telegram';

export { whatsapp, telegram };

// Utility function to send notification to both channels
export async function sendDualChannelNotification(
  message: string,
  whatsappRecipient: string
): Promise<{ whatsapp: boolean; telegram: boolean }> {
  const results = { whatsapp: false, telegram: false };

  try {
    const { sendWhatsAppMessage } = await import('./whatsapp');
    await sendWhatsAppMessage(whatsappRecipient, message);
    results.whatsapp = true;
  } catch (error) {
    console.error('WhatsApp notification failed:', error);
  }

  try {
    const { sendAlert } = await import('./telegram');
    await sendAlert(message);
    results.telegram = true;
  } catch (error) {
    console.error('Telegram notification failed:', error);
  }

  return results;
}

// Notification types for type safety
export interface PayoutNotificationData {
  amount: number;
  phone: string;
  orderRef: string;
}

export interface PayoutConfirmationData extends PayoutNotificationData {
  transactionId: string;
}

export interface PayoutRejectionData extends PayoutNotificationData {
  reason: string;
}

export default {
  whatsapp,
  telegram,
  sendDualChannelNotification,
};
