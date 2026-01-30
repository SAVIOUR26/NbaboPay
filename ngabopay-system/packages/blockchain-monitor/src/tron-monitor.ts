/**
 * TRON Network Monitor
 * Monitors TRC20 USDT/USDC deposits using TronGrid API
 */

import axios, { AxiosInstance } from 'axios';
import {
  Deposit,
  MonitorConfig,
  MonitorState,
  TronGridTRC20Response,
  TronGridTRC20Transaction,
  TOKEN_ADDRESSES,
  API_ENDPOINTS,
  TokenSymbol,
} from './types';

const DEFAULT_POLLING_INTERVAL = 30000; // 30 seconds
const DEFAULT_MIN_CONFIRMATIONS = 19; // TRON recommended confirmations

export class TronMonitor {
  private config: Required<MonitorConfig>;
  private state: MonitorState;
  private client: AxiosInstance;
  private pollingTimer: NodeJS.Timeout | null = null;
  private processedTxHashes: Set<string> = new Set();

  constructor(config: MonitorConfig) {
    this.config = {
      address: config.address,
      pollingInterval: config.pollingInterval ?? DEFAULT_POLLING_INTERVAL,
      apiKey: config.apiKey ?? '',
      minConfirmations: config.minConfirmations ?? DEFAULT_MIN_CONFIRMATIONS,
      onDeposit: config.onDeposit ?? (() => {}),
      onError: config.onError ?? console.error,
    };

    this.state = {
      lastProcessedTxHash: null,
      lastProcessedTimestamp: Date.now(),
      isRunning: false,
    };

    this.client = axios.create({
      baseURL: API_ENDPOINTS.TRON.mainnet,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey && { 'TRON-PRO-API-KEY': this.config.apiKey }),
      },
    });
  }

  /**
   * Start monitoring the wallet for new deposits
   */
  start(): void {
    if (this.state.isRunning) {
      console.log('TRON monitor is already running');
      return;
    }

    this.state.isRunning = true;
    console.log(`Starting TRON monitor for address: ${this.config.address}`);

    // Initial check
    this.checkForDeposits();

    // Start polling
    this.pollingTimer = setInterval(() => {
      this.checkForDeposits();
    }, this.config.pollingInterval);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    this.state.isRunning = false;
    console.log('TRON monitor stopped');
  }

  /**
   * Check for new TRC20 deposits
   */
  async checkForDeposits(): Promise<Deposit[]> {
    try {
      const transactions = await this.fetchTRC20Transactions();
      const deposits = this.processTransactions(transactions);

      for (const deposit of deposits) {
        if (!this.processedTxHashes.has(deposit.txHash)) {
          this.processedTxHashes.add(deposit.txHash);
          this.state.lastProcessedTxHash = deposit.txHash;
          this.state.lastProcessedTimestamp = deposit.timestamp;

          await this.config.onDeposit(deposit);
        }
      }

      return deposits;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.config.onError(err);
      return [];
    }
  }

  /**
   * Fetch TRC20 transactions from TronGrid API
   */
  private async fetchTRC20Transactions(): Promise<TronGridTRC20Transaction[]> {
    const url = `/v1/accounts/${this.config.address}/transactions/trc20`;

    const params: Record<string, string | number> = {
      only_to: true, // Only incoming transactions
      limit: 50,
      order_by: 'block_timestamp,desc',
    };

    // Only fetch transactions after the last processed timestamp
    if (this.state.lastProcessedTimestamp) {
      params.min_timestamp = this.state.lastProcessedTimestamp;
    }

    const response = await this.client.get<TronGridTRC20Response>(url, { params });

    if (!response.data.success) {
      throw new Error('TronGrid API request failed');
    }

    return response.data.data || [];
  }

  /**
   * Process transactions and filter for USDT/USDC deposits
   */
  private processTransactions(transactions: TronGridTRC20Transaction[]): Deposit[] {
    const deposits: Deposit[] = [];

    for (const tx of transactions) {
      // Check if this is a USDT or USDC transfer to our address
      const tokenAddress = tx.token_info.address;
      const isUsdt = tokenAddress === TOKEN_ADDRESSES.TRON.USDT;
      const isUsdc = tokenAddress === TOKEN_ADDRESSES.TRON.USDC;

      if (!isUsdt && !isUsdc) {
        continue;
      }

      // Verify the recipient is our monitored address
      if (tx.to.toLowerCase() !== this.config.address.toLowerCase()) {
        continue;
      }

      // Skip already processed transactions
      if (this.processedTxHashes.has(tx.transaction_id)) {
        continue;
      }

      const tokenSymbol: TokenSymbol = isUsdt ? 'USDT' : 'USDC';
      const decimals = tx.token_info.decimals;
      const amount = this.formatAmount(tx.value, decimals);

      const deposit: Deposit = {
        txHash: tx.transaction_id,
        amount,
        fromAddress: tx.from,
        toAddress: tx.to,
        tokenSymbol,
        tokenAddress,
        network: 'TRON',
        confirmations: this.estimateConfirmations(tx.block_timestamp),
        timestamp: tx.block_timestamp,
        blockNumber: 0, // TronGrid doesn't return block number in this endpoint
      };

      deposits.push(deposit);
    }

    return deposits;
  }

  /**
   * Format token amount from raw value with decimals
   */
  private formatAmount(value: string, decimals: number): string {
    const rawValue = BigInt(value);
    const divisor = BigInt(10 ** decimals);
    const integerPart = rawValue / divisor;
    const fractionalPart = rawValue % divisor;

    const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
    const trimmedFractional = fractionalStr.replace(/0+$/, '');

    if (trimmedFractional === '') {
      return integerPart.toString();
    }

    return `${integerPart}.${trimmedFractional}`;
  }

  /**
   * Estimate confirmations based on timestamp
   * TRON produces ~1 block every 3 seconds
   */
  private estimateConfirmations(blockTimestamp: number): number {
    const now = Date.now();
    const ageMs = now - blockTimestamp;
    const ageSeconds = Math.floor(ageMs / 1000);
    const estimatedBlocks = Math.floor(ageSeconds / 3);
    return Math.max(0, estimatedBlocks);
  }

  /**
   * Get current monitor state
   */
  getState(): MonitorState {
    return { ...this.state };
  }

  /**
   * Check if a specific transaction has been processed
   */
  isTransactionProcessed(txHash: string): boolean {
    return this.processedTxHashes.has(txHash);
  }

  /**
   * Mark a transaction as processed (useful for restoring state)
   */
  markTransactionProcessed(txHash: string): void {
    this.processedTxHashes.add(txHash);
  }

  /**
   * Clear processed transactions history
   */
  clearProcessedTransactions(): void {
    this.processedTxHashes.clear();
    this.state.lastProcessedTxHash = null;
  }
}

/**
 * Convenience function to monitor a TRON wallet for USDT/USDC deposits
 */
export async function monitorTronWallet(
  address: string,
  options?: Partial<Omit<MonitorConfig, 'address'>>
): Promise<TronMonitor> {
  const monitor = new TronMonitor({
    address,
    ...options,
  });

  monitor.start();
  return monitor;
}

/**
 * One-time check for recent deposits without starting continuous monitoring
 */
export async function checkTronDeposits(
  address: string,
  apiKey?: string
): Promise<Deposit[]> {
  const monitor = new TronMonitor({
    address,
    apiKey,
  });

  return monitor.checkForDeposits();
}
