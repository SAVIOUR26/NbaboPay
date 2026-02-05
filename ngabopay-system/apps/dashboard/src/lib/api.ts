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

  // Orders
  async getOrders(params?: { status?: string; page?: number; limit?: number }) {
    const query = new URLSearchParams(params as any).toString();
    return this.request<{ orders: any[]; pagination: any }>(`/orders?${query}`);
  }

  // Configuration
  async getConfigs() {
    return this.request<{ configs: any[] }>('/config');
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

  // Binance Monitor
  async getBinanceStatus() {
    return this.request<{ connected: boolean; monitoring: boolean; lastChecked: string | null }>('/config/binance/status');
  }

  // Binance Browser Control
  async launchBinanceBrowser() {
    return this.request<{ browserUrl: string; sessionId: string; message: string }>('/binance/launch-browser', {
      method: 'POST',
    });
  }

  async checkBinanceLogin() {
    return this.request<{ isLoggedIn: boolean; sessionId: string; message: string }>('/binance/check-login', {
      method: 'POST',
    });
  }

  async getBinanceSessionStatus() {
    return this.request<{ isValid: boolean; lastChecked: string | null; expiresAt: string | null }>('/binance/session-status');
  }

  async startBinanceMonitoring() {
    return this.request<{ message: string; status: string }>('/binance/start-monitoring', {
      method: 'POST',
    });
  }

  async stopBinanceMonitoring() {
    return this.request<{ message: string }>('/binance/stop-monitoring', {
      method: 'POST',
    });
  }

  async getBinanceRates() {
    return this.request<{ rates: any[]; timestamp: string }>('/binance/rates');
  }

  async closeBinanceBrowser() {
    return this.request<{ message: string }>('/binance/close-browser', {
      method: 'POST',
    });
  }
}

export const api = new ApiClient();
