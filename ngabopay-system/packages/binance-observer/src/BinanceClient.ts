/**
 * Binance P2P Observer Client
 * Monitors Binance P2P exchange rates using Playwright browser automation
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { Cookie, BrowserSession, ExchangeRate, P2POrder } from './types';
import * as fs from 'fs';
import * as path from 'path';

export interface BinanceClientOptions {
  headless?: boolean;
  userDataDir?: string;
  sessionStoragePath?: string;
  remoteDebuggingPort?: number;
  displayNumber?: string; // For Xvfb display (e.g., ":99")
}

export class BinanceClient {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private options: BinanceClientOptions;
  private sessionId: string;

  constructor(sessionId: string, options: BinanceClientOptions = {}) {
    this.sessionId = sessionId;
    this.options = {
      headless: false, // Always visible for VNC
      userDataDir: options.userDataDir || '/home/ngabopay/.chromium-profile',
      sessionStoragePath: options.sessionStoragePath || '/home/ngabopay/binance-sessions',
      remoteDebuggingPort: options.remoteDebuggingPort || 9222,
      displayNumber: options.displayNumber || ':99',
      ...options,
    };

    // Ensure session storage directory exists
    if (!fs.existsSync(this.options.sessionStoragePath!)) {
      fs.mkdirSync(this.options.sessionStoragePath!, { recursive: true });
    }
  }

  /**
   * Launch browser with VNC support
   */
  async launch(): Promise<void> {
    console.log(`[BinanceClient] Launching browser for session ${this.sessionId}`);

    // Set DISPLAY environment variable for Xvfb
    process.env.DISPLAY = this.options.displayNumber;

    const launchOptions: any = {
      headless: this.options.headless,
      args: [
        `--remote-debugging-port=${this.options.remoteDebuggingPort}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1920,1080',
        '--start-maximized',
      ],
    };

    // Use persistent context for session management
    if (this.options.userDataDir) {
      this.context = await chromium.launchPersistentContext(
        this.options.userDataDir,
        launchOptions
      );
      this.browser = this.context.browser()!;
    } else {
      this.browser = await chromium.launch(launchOptions);
      this.context = await this.browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });
    }

    // Try to restore session if exists
    await this.restoreSession();

    // Create or get existing page
    const pages = this.context.pages();
    if (pages.length > 0) {
      this.page = pages[0];
    } else {
      this.page = await this.context.newPage();
    }

    console.log(`[BinanceClient] Browser launched successfully`);
  }

  /**
   * Navigate to Binance P2P page
   */
  async navigateToP2P(fiatCurrency: string = 'UGX'): Promise<void> {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    console.log(`[BinanceClient] Navigating to Binance P2P (${fiatCurrency})`);
    const url = `https://p2p.binance.com/en/trade/sell/USDT?fiat=${fiatCurrency}&payment=ALL`;

    await this.page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    // Wait for page to load
    await this.page.waitForTimeout(3000);

    console.log(`[BinanceClient] Loaded: ${this.page.url()}`);
  }

  /**
   * Check if user is logged in
   */
  async isLoggedIn(): Promise<boolean> {
    if (!this.page) return false;

    try {
      // Check for login indicators
      const loginButton = await this.page.$('button:has-text("Log In")');
      const userAvatar = await this.page.$('[class*="avatar"]');

      return !loginButton && !!userAvatar;
    } catch (error) {
      console.error('[BinanceClient] Error checking login status:', error);
      return false;
    }
  }

  /**
   * Wait for user to log in manually (via VNC)
   */
  async waitForLogin(timeoutMs: number = 300000): Promise<boolean> {
    if (!this.page) {
      throw new Error('Browser not launched');
    }

    console.log('[BinanceClient] Waiting for user to log in...');
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const loggedIn = await this.isLoggedIn();
      if (loggedIn) {
        console.log('[BinanceClient] User logged in successfully!');
        await this.saveSession();
        return true;
      }
      await this.page.waitForTimeout(2000);
    }

    console.log('[BinanceClient] Login timeout');
    return false;
  }

  /**
   * Scrape P2P exchange rates
   */
  async scrapeExchangeRates(fiatCurrency: string = 'UGX'): Promise<ExchangeRate | null> {
    if (!this.page) {
      throw new Error('Browser not launched');
    }

    try {
      console.log(`[BinanceClient] Scraping rates for USDT/${fiatCurrency}`);

      // Wait for order list to load
      await this.page.waitForSelector('[class*="advertiser"]', { timeout: 10000 });

      // Extract order data
      const orders = await this.page.$$eval('[class*="order-row"], [class*="advertise"]', (elements) => {
        return elements.slice(0, 10).map((el) => {
          const priceElement = el.querySelector('[class*="price"]');
          const priceText = priceElement?.textContent?.trim() || '';
          const price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
          return isNaN(price) ? null : price;
        }).filter(p => p !== null);
      });

      if (orders.length === 0) {
        console.warn('[BinanceClient] No orders found');
        return null;
      }

      // Calculate rates
      const validOrders = orders.filter(o => o > 0) as number[];
      const buyRate = Math.max(...validOrders);
      const sellRate = Math.min(...validOrders);
      const avgRate = validOrders.reduce((a, b) => a + b, 0) / validOrders.length;
      const spread = buyRate - sellRate;

      const exchangeRate: ExchangeRate = {
        crypto: 'USDT',
        fiat: fiatCurrency as any,
        buyRate,
        sellRate,
        avgRate,
        spread,
        timestamp: new Date(),
        source: 'binance_p2p',
        orderCount: validOrders.length,
      };

      console.log(`[BinanceClient] Rates: Buy=${buyRate}, Sell=${sellRate}, Avg=${avgRate.toFixed(2)}`);
      return exchangeRate;

    } catch (error) {
      console.error('[BinanceClient] Error scraping rates:', error);
      return null;
    }
  }

  /**
   * Save session to disk
   */
  async saveSession(): Promise<void> {
    if (!this.context) return;

    try {
      const cookies = await this.context.cookies();
      const sessionData: BrowserSession = {
        id: this.sessionId,
        cookies: cookies as Cookie[],
        localStorage: {},
        createdAt: new Date(),
        lastUsed: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        userAgent: this.page ? await this.page.evaluate('navigator.userAgent') : '',
        isValid: true,
      };

      const sessionPath = path.join(this.options.sessionStoragePath!, `${this.sessionId}.json`);
      fs.writeFileSync(sessionPath, JSON.stringify(sessionData, null, 2));

      console.log(`[BinanceClient] Session saved: ${sessionPath}`);
    } catch (error) {
      console.error('[BinanceClient] Error saving session:', error);
    }
  }

  /**
   * Restore session from disk
   */
  async restoreSession(): Promise<boolean> {
    if (!this.context) return false;

    try {
      const sessionPath = path.join(this.options.sessionStoragePath!, `${this.sessionId}.json`);

      if (!fs.existsSync(sessionPath)) {
        console.log('[BinanceClient] No saved session found');
        return false;
      }

      const sessionData: BrowserSession = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));

      // Check if session expired
      if (new Date() > new Date(sessionData.expiresAt)) {
        console.log('[BinanceClient] Session expired');
        return false;
      }

      // Restore cookies
      await this.context.addCookies(sessionData.cookies as any);
      console.log(`[BinanceClient] Session restored: ${sessionData.cookies.length} cookies`);

      return true;
    } catch (error) {
      console.error('[BinanceClient] Error restoring session:', error);
      return false;
    }
  }

  /**
   * Take screenshot
   */
  async screenshot(filename: string): Promise<string | null> {
    if (!this.page) return null;

    try {
      const screenshotPath = path.join(this.options.sessionStoragePath!, filename);
      await this.page.screenshot({ path: screenshotPath, fullPage: false });
      console.log(`[BinanceClient] Screenshot saved: ${screenshotPath}`);
      return screenshotPath;
    } catch (error) {
      console.error('[BinanceClient] Error taking screenshot:', error);
      return null;
    }
  }

  /**
   * Get current page URL
   */
  async getCurrentUrl(): Promise<string | null> {
    return this.page?.url() || null;
  }

  /**
   * Close browser
   */
  async close(): Promise<void> {
    if (this.page) {
      await this.page.close();
      this.page = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    this.context = null;
    console.log('[BinanceClient] Browser closed');
  }

  /**
   * Get browser info
   */
  getBrowserInfo() {
    return {
      sessionId: this.sessionId,
      isLaunched: !!this.browser,
      currentUrl: this.page?.url() || null,
      remoteDebuggingPort: this.options.remoteDebuggingPort,
      displayNumber: this.options.displayNumber,
    };
  }
}
