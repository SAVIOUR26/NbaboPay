import axios from 'axios';
import { logger } from './logger';

const WHATSAPP_API_URL = 'https://graph.facebook.com/v17.0';
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_RECIPIENT = process.env.WHATSAPP_RECIPIENT_NUMBER;

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;

/**
 * Send WhatsApp notification using Meta Cloud API
 */
export async function sendWhatsAppNotification(message: string): Promise<boolean> {
  if (!WHATSAPP_PHONE_ID || !WHATSAPP_TOKEN || !WHATSAPP_RECIPIENT) {
    logger.warn('WhatsApp credentials not configured, skipping notification');

    // If Telegram is configured, send there as fallback
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      await sendTelegramAlert(message);
    }

    return false;
  }

  try {
    const response = await axios.post(
      `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: WHATSAPP_RECIPIENT,
        type: 'text',
        text: {
          preview_url: false,
          body: message,
        },
      },
      {
        headers: {
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    logger.info('WhatsApp message sent successfully', {
      messageId: response.data.messages?.[0]?.id,
    });

    return true;
  } catch (error: any) {
    logger.error('Failed to send WhatsApp message', {
      error: error.response?.data || error.message,
    });

    // Try Telegram as fallback
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      await sendTelegramAlert(`[WhatsApp Failed]\n\n${message}`);
    }

    throw new Error(`WhatsApp API error: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * Send payout notification with formatted details
 */
export async function sendPayoutNotification(
  amount: number,
  currency: string,
  customerPhone: string,
  orderReference: string
): Promise<boolean> {
  const formattedAmount = new Intl.NumberFormat('en-UG').format(amount);

  const message = `💰 *PAYOUT REQUEST*

*Amount:* ${formattedAmount} ${currency}
*Phone:* ${customerPhone}
*Order:* #${orderReference}

Please complete the mobile money transfer and confirm in dashboard.`;

  return sendWhatsAppNotification(message);
}

/**
 * Send order received notification
 */
export async function sendOrderNotification(
  cryptoAmount: number,
  cryptoCurrency: string,
  fiatAmount: number,
  fiatCurrency: string,
  orderReference: string
): Promise<boolean> {
  const formattedFiat = new Intl.NumberFormat('en-UG').format(fiatAmount);

  const message = `🔔 *NEW ORDER RECEIVED*

*Crypto:* ${cryptoAmount} ${cryptoCurrency}
*Fiat:* ${formattedFiat} ${fiatCurrency}
*Order:* #${orderReference}

Login to dashboard to process this order.`;

  return sendWhatsAppNotification(message);
}

/**
 * Send Telegram alert (backup channel)
 */
export async function sendTelegramAlert(message: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    logger.debug('Telegram not configured, skipping alert');
    return false;
  }

  try {
    await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'Markdown',
      }
    );

    logger.info('Telegram alert sent');
    return true;
  } catch (error: any) {
    logger.error('Failed to send Telegram alert', {
      error: error.response?.data || error.message,
    });
    return false;
  }
}

/**
 * Send deposit detected notification
 */
export async function sendDepositNotification(
  amount: number,
  currency: string,
  txHash: string,
  network: string
): Promise<boolean> {
  const shortHash = `${txHash.slice(0, 8)}...${txHash.slice(-8)}`;

  const message = `✅ *DEPOSIT DETECTED*

*Amount:* ${amount} ${currency}
*Network:* ${network}
*TX:* ${shortHash}

Processing order...`;

  return sendWhatsAppNotification(message);
}
