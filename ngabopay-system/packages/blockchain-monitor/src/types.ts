/**
 * Blockchain Monitor Types
 * TypeScript interfaces for deposit monitoring on TRC20 and BSC networks
 */

export type Network = 'TRON' | 'BSC';
export type TokenSymbol = 'USDT' | 'USDC';

/**
 * Represents a detected deposit transaction
 */
export interface Deposit {
  txHash: string;
  amount: string;
  fromAddress: string;
  toAddress: string;
  tokenSymbol: TokenSymbol;
  tokenAddress: string;
  network: Network;
  confirmations: number;
  timestamp: number;
  blockNumber: number;
}

/**
 * Configuration for wallet monitoring
 */
export interface MonitorConfig {
  /** Wallet address to monitor */
  address: string;
  /** Polling interval in milliseconds (default: 30000) */
  pollingInterval?: number;
  /** API key for the respective blockchain explorer */
  apiKey?: string;
  /** Minimum confirmations required to consider deposit valid */
  minConfirmations?: number;
  /** Callback function when new deposit is detected */
  onDeposit?: (deposit: Deposit) => void | Promise<void>;
  /** Callback function on error */
  onError?: (error: Error) => void;
}

/**
 * Monitor state for tracking processed transactions
 */
export interface MonitorState {
  lastProcessedTxHash: string | null;
  lastProcessedTimestamp: number;
  isRunning: boolean;
}

/**
 * TronGrid API response for TRC20 transactions
 */
export interface TronGridTRC20Response {
  data: TronGridTRC20Transaction[];
  success: boolean;
  meta: {
    at: number;
    fingerprint?: string;
    page_size: number;
  };
}

export interface TronGridTRC20Transaction {
  transaction_id: string;
  token_info: {
    symbol: string;
    address: string;
    decimals: number;
    name: string;
  };
  block_timestamp: number;
  from: string;
  to: string;
  type: string;
  value: string;
}

/**
 * BSCScan API response for BEP20 token transfers
 */
export interface BSCScanTokenTransferResponse {
  status: string;
  message: string;
  result: BSCScanTokenTransfer[];
}

export interface BSCScanTokenTransfer {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  nonce: string;
  blockHash: string;
  from: string;
  contractAddress: string;
  to: string;
  value: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: string;
  transactionIndex: string;
  gas: string;
  gasPrice: string;
  gasUsed: string;
  cumulativeGasUsed: string;
  input: string;
  confirmations: string;
}

/**
 * Token contract addresses for supported networks
 */
export const TOKEN_ADDRESSES = {
  TRON: {
    USDT: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    USDC: 'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8',
  },
  BSC: {
    USDT: '0x55d398326f99059fF775485246999027B3197955',
    USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
  },
} as const;

/**
 * API endpoints for blockchain explorers
 */
export const API_ENDPOINTS = {
  TRON: {
    mainnet: 'https://api.trongrid.io',
    testnet: 'https://api.shasta.trongrid.io',
  },
  BSC: {
    mainnet: 'https://api.bscscan.com/api',
    testnet: 'https://api-testnet.bscscan.com/api',
  },
} as const;
