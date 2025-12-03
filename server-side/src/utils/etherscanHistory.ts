/**
 * Etherscan-based transaction history fetcher
 * Similar implementation to test-fetch/etherscanHistory.ts
 * Fetches external and internal transactions from Etherscan API
 */

import { TokenType, TxType } from "../modules/account/types";

type NetworkConfig = {
  baseUrl: string;
  chainId: string;
};

type RawApiResponse = {
  status?: string;
  message?: string;
  result?: any;
};

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

// Get Etherscan configuration for a given chain
function getEtherscanConfig(chain: string): NetworkConfig {
  switch (chain.toLowerCase()) {
    case 'mainnet':
    case 'eth':
    case 'ethereum':
      return { baseUrl: 'https://api.etherscan.io/v2/api', chainId: '1' };
    case 'sepolia':
      return { baseUrl: 'https://api.etherscan.io/v2/api', chainId: '11155111' };
    case 'goerli':
      return { baseUrl: 'https://api.etherscan.io/v2/api', chainId: '5' };
    default:
      throw new Error(`Unsupported chain: ${chain}`);
  }
}

// Extract transactions from API response (different endpoints have different structures)
function extractTransactions(response: RawApiResponse): any[] {
  if (!response) return [];
  const { result } = response;
  if (Array.isArray(result)) {
    return result;
  }
  if (result && Array.isArray(result.transactions)) {
    return result.transactions;
  }
  return [];
}


// Build URL with query parameters
function buildUrl(baseUrl: string, params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      search.set(key, value);
    }
  });
  return `${baseUrl}?${search.toString()}`;
}


// Call Etherscan API and parse response in parallel
async function callEtherscan(url: string, label: string): Promise<any[]> {
  const apiKey = process.env.ETHERSCAN_API_KEY || '';
  const maskedUrl = url.replace(apiKey, '***');
  
  console.log(`[Etherscan] ${label} URL:`, maskedUrl);
  
  const response = await fetch(url);
  
  if (!response.ok) {
    console.error(`[Etherscan] ${label} API error: ${response.status} ${response.statusText}`);
    throw new Error(`Etherscan API error: ${response.status} ${response.statusText}`);
  }
  
  const body = await response.text();
  let data: RawApiResponse;
  
  try {
    const parsed = JSON.parse(body) as RawApiResponse;
    data = parsed;
  } catch (err) {
    console.error(`[Etherscan] ${label} API returned non-JSON payload:`, body.slice(0, 200));
    throw err;
  }
  
  console.log(`[Etherscan] ${label} API status: ${data.status} | message: ${data.message || 'OK'}`);
  
  if (data.status && data.status !== '1') {
    const errorMsg = data.message || data.result || 'Unknown error';
    console.error(`[Etherscan] ${label} API error:`, errorMsg);
    
    // Handle "No transactions found" as a valid case
    if (errorMsg.includes('No transactions') || errorMsg.includes('No record found')) {
      return [];
    }
    
    if (typeof data.result === 'string') {
      console.error(`[Etherscan] ${label} Error details:`, data.result);
    }
    
    // Don't throw for empty results, return empty array instead
    if (errorMsg.includes('No transactions')) {
      return [];
    }
  }
  
  const txs = extractTransactions(data);
  console.log(`[Etherscan] ${label} transactions found: ${txs.length}`);
  
  return txs;
}

/**
 * Fetch transaction history from Etherscan for a given address
 * @param address Ethereum address to fetch transactions for
 * @param chain Chain name (sepolia, mainnet, goerli)
 * @param limit Maximum number of transactions to return
 * @returns Array of formatted transactions
 */
export async function fetchEtherscanTransactions(
  address: string,
  chain: string = 'sepolia',
  limit: number = 100
): Promise<EtherscanTransaction[]> {
  const { baseUrl, chainId } = getEtherscanConfig(chain);
  const apiKey = process.env.ETHERSCAN_API_KEY;

  if (!apiKey) {
    console.warn('[Etherscan] ETHERSCAN_API_KEY not found in environment variables');
    throw new Error('ETHERSCAN_API_KEY is required in environment variables');
  }

  console.log(`[Etherscan] Fetching transactions for ${address} on ${chain}...`);

  // Fetch more transactions to allow for filtering and deduplication across all types
  const fetchLimit = Math.max(limit * 3, 1000);

  // 1. External ETH transactions
  const externalUrl = buildUrl(baseUrl, {
    module: 'account',
    action: 'txlist',
    address,
    startblock: '0',
    endblock: '99999999',
    sort: 'desc',
    page: '1',
    offset: fetchLimit.toString(),
    chainid: chainId,
    apikey: apiKey,
  });

  // 2. Internal transactions
  const internalUrl = buildUrl(baseUrl, {
    module: 'account',
    action: 'txlistinternal',
    address,
    startblock: '0',
    endblock: '99999999',
    sort: 'desc',
    page: '1',
    offset: fetchLimit.toString(),
    chainid: chainId,
    apikey: apiKey,
  });

  // 3. ERC-20 Token transfers
  const erc20Url = buildUrl(baseUrl, {
    module: 'account',
    action: 'tokentx',
    address,
    startblock: '0',
    endblock: '99999999',
    sort: 'desc',
    page: '1',
    offset: fetchLimit.toString(),
    chainid: chainId,
    apikey: apiKey,
  });

  // 4. ERC-721 NFT transfers
  const erc721Url = buildUrl(baseUrl, {
    module: 'account',
    action: 'tokennfttx',
    address,
    startblock: '0',
    endblock: '99999999',
    sort: 'desc',
    page: '1',
    offset: fetchLimit.toString(),
    chainid: chainId,
    apikey: apiKey,
  });

  // 5. ERC-1155 NFT transfers
  const erc1155Url = buildUrl(baseUrl, {
    module: 'account',
    action: 'token1155tx',
    address,
    startblock: '0',
    endblock: '99999999',
    sort: 'desc',
    page: '1',
    offset: fetchLimit.toString(),
    chainid: chainId,
    apikey: apiKey,
  });

  // Fetch all transaction types in parallel
  const [externalTxs, internalTxs, erc20Txs, erc721Txs, erc1155Txs] = await Promise.all([
    callEtherscan(externalUrl, 'External'),
    callEtherscan(internalUrl, 'Internal'),
    callEtherscan(erc20Url, 'ERC-20'),
    callEtherscan(erc721Url, 'ERC-721'),
    callEtherscan(erc1155Url, 'ERC-1155'),
  ]);

  console.log(`[Etherscan] External: ${externalTxs.length} | Internal: ${internalTxs.length} | ERC-20: ${erc20Txs.length} | ERC-721: ${erc721Txs.length} | ERC-1155: ${erc1155Txs.length}`);

  // 6. Process ETH transactions (external + internal)
  const ethTxs = [...externalTxs, ...internalTxs].map((tx: any) => {
    const timeNum = Number(tx.timeStamp);
    const timestamp =
      !isNaN(timeNum) && timeNum > 0
        ? new Date(timeNum * 1000).toISOString()
        : "unknown";

    const valueEth = tx.value ? Number(tx.value) / 1e18 : 0;

    // Determine transaction success status
    // isError can be "0" (success), "1" (failed), or a number 0/1
    // txReceiptStatus: "1" = success, "0" = failed (if available)
    const isErrorZero = tx.isError === "0" || tx.isError === 0;
    const receiptStatusGood = tx.txreceipt_status === "1" || tx.txreceipt_status === 1 || tx.txreceipt_status === undefined;
    const isSuccess = isErrorZero && receiptStatusGood;

    return {
      hash: tx.hash || "unknown",
      from: tx.from || "unknown",
      to: tx.to || "unknown",
      value: valueEth,
      type:
        tx.from?.toLowerCase() === address.toLowerCase()
          ? TxType.SENT
          : TxType.RECEIVED,
      isInternal: !!tx.traceId || tx.type === "internal",
      timestamp,
      success: isSuccess,
      errorMessage: !isSuccess && tx.isError !== "0" && tx.isError !== 0 ? "Transaction failed" : undefined,
      tokenType: TokenType.ETH,
    };
  });

  // 7. Process ERC-20 token transfers
  const erc20Processed = erc20Txs.map((tx: any) => {
    const timeNum = Number(tx.timeStamp);
    const timestamp = !isNaN(timeNum) && timeNum > 0
      ? new Date(timeNum * 1000).toISOString()
      : "unknown";

    const decimals = Number(tx.tokenDecimal) || 18;
    const value = tx.value ? Number(tx.value) / Math.pow(10, decimals) : 0;

    return {
      hash: tx.hash || "unknown",
      from: tx.from || "unknown",
      to: tx.to || "unknown",
      value,
      type: tx.from?.toLowerCase() === address.toLowerCase()
        ? TxType.SENT
        : TxType.RECEIVED,
      isInternal: false,
      timestamp,
      success: true,
      tokenSymbol: tx.tokenSymbol || 'UNKNOWN',
      tokenName: tx.tokenName || tx.tokenSymbol || 'Unknown Token',
      tokenAddress: tx.contractAddress || tx.tokenAddress,
      tokenDecimals: decimals,
      tokenType: TokenType.ERC20,
    };
  });

  // 8. Process ERC-721 NFT transfers
  const erc721Processed = erc721Txs.map((tx: any) => {
    const timeNum = Number(tx.timeStamp);
    const timestamp = !isNaN(timeNum) && timeNum > 0
      ? new Date(timeNum * 1000).toISOString()
      : "unknown";

    return {
      hash: tx.hash || "unknown",
      from: tx.from || "unknown",
      to: tx.to || "unknown",
      value: 1,
      type: tx.from?.toLowerCase() === address.toLowerCase()
        ? TxType.SENT
        : TxType.RECEIVED,
      isInternal: false,
      timestamp,
      success: true,
      tokenSymbol: tx.tokenSymbol || tx.tokenName || 'NFT',
      tokenName: tx.tokenName || tx.tokenSymbol || 'NFT',
      tokenAddress: tx.contractAddress || tx.tokenAddress,
      tokenId: tx.tokenID || tx.tokenId,
      tokenType: TokenType.ERC721,
    };
  });

  // 9. Process ERC-1155 NFT transfers
  const erc1155Processed = erc1155Txs.map((tx: any) => {
    const timeNum = Number(tx.timeStamp);
    const timestamp = !isNaN(timeNum) && timeNum > 0
      ? new Date(timeNum * 1000).toISOString()
      : "unknown";

    const value = Number(tx.value) || 0;

    return {
      hash: tx.hash || "unknown",
      from: tx.from || "unknown",
      to: tx.to || "unknown",
      value,
      type: tx.from?.toLowerCase() === address.toLowerCase()
        ? TxType.SENT
        : TxType.RECEIVED,
      isInternal: false,
      timestamp,
      success: true,
      tokenSymbol: tx.tokenSymbol || tx.tokenName || 'NFT',
      tokenName: tx.tokenName || tx.tokenSymbol || 'NFT',
      tokenAddress: tx.contractAddress || tx.tokenAddress,
      tokenId: tx.tokenID || tx.tokenId,
      tokenType: TokenType.ERC1155,
    };
  });

  // 10. Combine all transaction types
  const all = [...ethTxs, ...erc20Processed, ...erc721Processed, ...erc1155Processed];

  // 11. Remove duplicates and sort
  // Create unique keys by combining hash, from, to, tokenType, tokenAddress, tokenId for better deduplication
  const seenKeys = new Set<string>();
  const unique = all.filter((tx) => {
    const tokenAddress = (tx as any).tokenAddress || '';
    const tokenId = (tx as any).tokenId || '';
    const uniqueKey = `${tx.hash}-${tx.from}-${tx.to}-${tx.tokenType || 'ETH'}-${tokenAddress}-${tokenId}-${tx.isInternal}`;
    if (seenKeys.has(uniqueKey)) {
      return false;
    }
    seenKeys.add(uniqueKey);
    return true;
  });

  const sorted = unique.sort((a, b) => {
    if (a.timestamp === "unknown") return 1;
    if (b.timestamp === "unknown") return -1;
    return a.timestamp < b.timestamp ? 1 : -1;
  });

  // Limit results
  const limited = sorted.slice(0, limit);

  console.log(`[Etherscan] Final transaction count: ${limited.length}`);
  
  return limited;
}
