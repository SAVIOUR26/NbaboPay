import axios, { AxiosError } from 'axios';

/**
 * Telegram Bot API client for NgaboPay notifications (backup channel)
 * Used as a fallback when WhatsApp notifications fail or for internal alerts
 */

const TELEGRAM_API_BASE_URL = 'https://api.telegram.org';

interface TelegramMessageResponse {
  ok: boolean;
  result: {
    message_id: number;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      username: string;
    };
    chat: {
      id: number;
      first_name?: string;
      username?: string;
      type: string;
    };
    date: number;
    text: string;
  };
}

interface TelegramErrorResponse {
  ok: false;
  error_code: number;
  description: string;
}

/**
 * Get Telegram API configuration from environment variables
 */
function getConfig() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken) {
    throw new Error('TELEGRAM_BOT_TOKEN environment variable is not set');
  }

  if (!chatId) {
    throw new Error('TELEGRAM_CHAT_ID environment variable is not set');
  }

  return { botToken, chatId };
}

/**
 * Send a message via Telegram Bot API
 */
async function sendTelegramMessage(
  message: string,
  chatId?: string,
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2'
): Promise<TelegramMessageResponse> {
  const config = getConfig();
  const targetChatId = chatId || config.chatId;

  const url = `${TELEGRAM_API_BASE_URL}/bot${config.botToken}/sendMessage`;

  try {
    const response = await axios.post<TelegramMessageResponse>(url, {
      chat_id: targetChatId,
      text: message,
      parse_mode: parseMode,
    });

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<TelegramErrorResponse>;
      const errorData = axiosError.response?.data;

      if (errorData && !errorData.ok) {
        throw new Error(
          `Telegram API Error: ${errorData.description} (Code: ${errorData.error_code})`
        );
      }
    }
    throw error;
  }
}

/**
 * Send an alert message via Telegram
 * Used for system alerts, error notifications, and backup notifications
 *
 * @param message - The alert message to send
 * @returns Promise resolving to the Telegram API response
 *
 * @example
 * await sendAlert('Payment processing error: Transaction timeout');
 */
export async function sendAlert(message: string): Promise<TelegramMessageResponse> {
  const timestamp = new Date().toISOString();
  const formattedMessage = `\u{1F6A8} NGABOPAY ALERT\n\n${message}\n\nTime: ${timestamp}`;

  return sendTelegramMessage(formattedMessage);
}

/**
 * Send a payout alert via Telegram (backup for WhatsApp)
 *
 * @param amount - The payout amount in UGX
 * @param phone - The recipient's phone number
 * @param orderRef - The order reference number
 */
export async function sendPayoutAlert(
  amount: number,
  phone: string,
  orderRef: string
): Promise<TelegramMessageResponse> {
  const formattedOrderRef = orderRef.startsWith('#') ? orderRef : `#${orderRef}`;
  const formattedAmount = amount.toLocaleString('en-UG');

  const message = `\u{1F4B0} PAYOUT REQUEST

Amount: ${formattedAmount} UGX
Phone: ${phone}
Order: ${formattedOrderRef}

Use /approve ${orderRef} to confirm
Use /reject ${orderRef} to decline`;

  return sendTelegramMessage(message);
}

/**
 * Send an error notification via Telegram
 *
 * @param error - The error object or message
 * @param context - Additional context about where the error occurred
 */
export async function sendErrorNotification(
  error: Error | string,
  context?: string
): Promise<TelegramMessageResponse> {
  const errorMessage = error instanceof Error ? error.message : error;
  const stack = error instanceof Error ? error.stack : undefined;

  let message = `\u{274C} ERROR NOTIFICATION\n\nError: ${errorMessage}`;

  if (context) {
    message += `\nContext: ${context}`;
  }

  if (stack) {
    // Truncate stack trace if too long
    const truncatedStack = stack.length > 500 ? stack.substring(0, 500) + '...' : stack;
    message += `\n\nStack:\n${truncatedStack}`;
  }

  message += `\n\nTime: ${new Date().toISOString()}`;

  return sendTelegramMessage(message);
}

/**
 * Send a success notification via Telegram
 *
 * @param message - The success message
 */
export async function sendSuccessNotification(message: string): Promise<TelegramMessageResponse> {
  const formattedMessage = `\u{2705} SUCCESS\n\n${message}\n\nTime: ${new Date().toISOString()}`;

  return sendTelegramMessage(formattedMessage);
}

/**
 * Send a custom message to a specific chat
 *
 * @param message - The message to send
 * @param chatId - The target chat ID
 * @param parseMode - Optional parse mode for formatting
 */
export async function sendCustomMessage(
  message: string,
  chatId?: string,
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2'
): Promise<TelegramMessageResponse> {
  return sendTelegramMessage(message, chatId, parseMode);
}

export default {
  sendAlert,
  sendPayoutAlert,
  sendErrorNotification,
  sendSuccessNotification,
  sendCustomMessage,
};
