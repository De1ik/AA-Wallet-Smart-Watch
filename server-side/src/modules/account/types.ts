import { Address } from "viem";

export enum TxType {
  SENT = 0,
  RECEIVED = 1
}

export enum TxStatus {
  SUCCESS = 0,
  FAILED = 1,
  PENDING = 2
}

export enum TokenType {
  ETH = 0,
  ERC20 = 1,
  ERC721 = 2,
  ERC1155 = 3
}

export interface BalancesQuery {
  address?: string | string[];
}

export interface BalancesResponse {
  success: true;
  ethBalance: string;
  tokens: Array<{
    symbol: string;
    name: string;
    balance: string;
    value: number;
    decimals: number;
    address: string;
    color: string;
    amount: string;
  }>;
  message: string;
}

export interface TransactionsQuery {
  address?: string | string[];
  limit?: number | string | string[];
  useEtherscan?: string | string[];
}

export interface TransactionsResponse {
  success: true;
  transactions: ApiTransaction[];
  message: string;
  limit: number;
}

export interface SendRequest {
  to?: string;
  amount?: string;
  tokenAddress?: Address;
  kernelAddress?: Address;
}

export interface SendResponse {
  success: true;
  data: {
    packed: any;
    unpacked: any;
    userOpHash: string;
  };
  message: string;
}

export type EtherscanTransaction = {
  hash: string;
  from: string;
  to: string;
  value: number;
  type: TxType;
  isInternal: boolean;
  timestamp: string;
  success: boolean;
  errorMessage?: string;
  // Token transfer fields
  tokenSymbol?: string;
  tokenName?: string;
  tokenAddress?: string;
  tokenDecimals?: number;
  tokenId?: string; // For NFTs
  tokenType?: TokenType;
};

export type ApiTransaction = {
  hash: string;
  from: string;
  to: string;
  value: string;
  timestamp: number;
  type: TxType;
  status: TxStatus;
  tokenSymbol?: string;
  tokenAddress?: string;
  tokenId?: string;
  eventType?: string;
  errorMessage?: string;
};
