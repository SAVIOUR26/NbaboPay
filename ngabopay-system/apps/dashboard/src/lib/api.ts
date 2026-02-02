const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

class ApiClient {
  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('ngabopay_token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken();

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    };

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'API request failed');
    }

    return data;
  }

  // Auth
  async login(email: string, password: string) {
    return this.request<{ token: string; merchant: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async register(email: string, password: string, businessName: string) {
    return this.request<{ token: string; merchant: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, businessName, phone: '', country: 'UG' }),
    });
  }

  // Orders
  async getOrders(params?: { status?: string; page?: number; limit?: number }) {
    const query = new URLSearchParams(params as any).toString();
    return this.request<{ orders: any[]; pagination: any }>(`/orders?${query}`);
  }

  async getOrder(id: string) {
    return this.request<{ order: any }>(`/orders/${id}`);
  }

  async updateOrderStatus(id: string, status: string, note?: string) {
    return this.request<{ order: any }>(`/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, note }),
    });
  }

  async approveOrder(id: string) {
    return this.request<{ order: any }>(`/orders/${id}/approve`, {
      method: 'POST',
    });
  }

  // Wallets
  async getWallets() {
    return this.request<{ wallets: any[] }>('/wallets');
  }

  async createWallet(data: { network: string; address: string; label?: string }) {
    return this.request<{ wallet: any }>('/wallets', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Payouts
  async getPayouts(params?: { status?: string; page?: number }) {
    const query = new URLSearchParams(params as any).toString();
    return this.request<{ payouts: any[]; pagination: any }>(`/payouts?${query}`);
  }

  async confirmPayout(id: string, transactionId?: string) {
    return this.request<{ payout: any }>(`/payouts/${id}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ transactionId }),
    });
  }

  async retryPayout(id: string) {
    return this.request<{ payout: any }>(`/payouts/${id}/retry`, {
      method: 'POST',
    });
  }

  // Exchange Rates
  async getExchangeRates() {
    return this.request<{ rates: any[] }>('/exchange-rates');
  }

  // Configuration
  async getConfigs() {
    return this.request<{ configs: any[] }>('/config');
  }

  async getConfig(key: string) {
    return this.request<{ key: string; value: string; isEncrypted: boolean }>(`/config/${key}`);
  }

  async setConfig(key: string, value: string) {
    return this.request<{ message: string }>(`/config/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    });
  }

  async setBatchConfigs(configs: { key: string; value: string }[]) {
    return this.request<{ message: string; count: number }>('/config/batch', {
      method: 'POST',
      body: JSON.stringify({ configs }),
    });
  }

  async deleteConfig(key: string) {
    return this.request<{ message: string }>(`/config/${key}`, {
      method: 'DELETE',
    });
  }

  // Telegram
  async getTelegramStatus() {
    return this.request<{ configured: boolean; botToken: string | null; chatId: string | null }>('/config/telegram/status');
  }

  async testTelegram() {
    return this.request<{ success: boolean; message?: string; error?: string }>('/config/telegram/test', {
      method: 'POST',
    });
  }

  // Android Devices
  async getDevices() {
    return this.request<{ devices: any[] }>('/config/devices');
  }

  async registerDevice(data: { deviceId: string; deviceName?: string; fcmToken?: string }) {
    return this.request<{ message: string; device: any }>('/config/devices/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async removeDevice(id: string) {
    return this.request<{ message: string }>(`/config/devices/${id}`, {
      method: 'DELETE',
    });
  }

  // Binance
  async getBinanceStatus() {
    return this.request<{ connected: boolean; lastChecked: string | null; expiresAt: string | null; invalidReason: string | null }>('/config/binance/status');
  }

  async saveBinanceSession(sessionData: any, expiresAt?: string) {
    return this.request<{ message: string; expiresAt: string }>('/config/binance/session', {
      method: 'POST',
      body: JSON.stringify({ sessionData, expiresAt }),
    });
  }

  async clearBinanceSession() {
    return this.request<{ message: string }>('/config/binance/session', {
      method: 'DELETE',
    });
  }
}

export const api = new ApiClient();
