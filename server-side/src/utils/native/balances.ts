import { Address, formatEther, parseAbi } from "viem";
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";

import { ETH_RPC_URL, TOKEN_METADATA } from "../../shared/constants/constants";
import { ApiTransaction, TxStatus, TxType } from "../../modules/account";

export interface TokenMetadata {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
  color: string;
}


export async function fetchAllTokenBalances(address: Address): Promise<{
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
}> {
  const client = createPublicClient({
    chain: sepolia,
    transport: http(ETH_RPC_URL),
  });

  const erc20Abi = parseAbi([
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
    "function name() view returns (string)",
  ]);

  try {
    const ethBalanceWei = await client.getBalance({ address });
    const ethBalance = formatEther(ethBalanceWei);

    const tokenBalances = await Promise.all(
      TOKEN_METADATA.map(async (token) => {
        try {
          const balanceWei = await client.readContract({
            address: token.address,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [address],
          });

          let decimals = token.decimals;
          try {
            decimals = await client.readContract({
              address: token.address,
              abi: erc20Abi,
              functionName: "decimals",
            });
          } catch {
            /* keep default decimals */
          }

          const divisor = BigInt(10 ** Number(decimals));
          const balance = (Number(balanceWei) / Number(divisor)).toFixed(decimals);
          const hasBalance = balanceWei > 0n;

          return {
            symbol: token.symbol,
            name: token.name,
            balance,
            value: 0,
            decimals,
            address: token.address,
            color: token.color,
            amount: balance,
            hasBalance,
          };
        } catch (error) {
          console.warn(`[Balance] Error fetching balance for ${token.symbol}:`, error);
          return null;
        }
      })
    );

    const validTokens = tokenBalances.filter((token): token is NonNullable<typeof token> => token !== null && token.hasBalance);

    const tokensWithEth: Array<{
      symbol: string;
      name: string;
      balance: string;
      value: number;
      decimals: number;
      address: string;
      color: string;
      amount: string;
      hasBalance: boolean;
    }> = [];

    if (parseFloat(ethBalance) > 0) {
      tokensWithEth.push({
        symbol: "ETH",
        name: "Ethereum",
        balance: ethBalance,
        value: 0,
        decimals: 18,
        address: "0x0000000000000000000000000000000000000000",
        color: "#627EEA",
        amount: ethBalance,
        hasBalance: true,
      });
    }

    const allTokens = [...tokensWithEth, ...validTokens].sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount));

    return {
      ethBalance,
      tokens: allTokens.filter((t) => t.hasBalance),
    };
  } catch (error) {
    console.error("[Balance] Error fetching balances:", error);
    throw error;
  }
}

export async function fetchTransactionHistory(
  address: Address,
  limit: number = 20
): Promise<ApiTransaction[]> {
  const client = createPublicClient({
    chain: sepolia,
    transport: http(ETH_RPC_URL),
  });

  let alchemyApiKey = process.env.ALCHEMY_API_KEY;

  const erc20Abi = parseAbi([
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
    "function name() view returns (string)",
  ]);

  try {
    const allTransactions: ApiTransaction[] = [];

    if (alchemyApiKey) {
      try {
        const { Alchemy, Network, AssetTransfersCategory } = await import("alchemy-sdk");

        const alchemy = new Alchemy({ apiKey: alchemyApiKey, network: Network.ETH_SEPOLIA });

        const transfers = await alchemy.core.getAssetTransfers({
          fromBlock: "0x0",
          toBlock: "latest",
          fromAddress: address,
          category: [
            AssetTransfersCategory.EXTERNAL,
            AssetTransfersCategory.ERC20,
            AssetTransfersCategory.ERC721,
            AssetTransfersCategory.ERC1155,
            AssetTransfersCategory.INTERNAL,
          ],
          withMetadata: true,
          maxCount: limit * 3,
        });

        const transfersTo = await alchemy.core.getAssetTransfers({
          fromBlock: "0x0",
          toBlock: "latest",
          toAddress: address,
          category: [
            AssetTransfersCategory.EXTERNAL,
            AssetTransfersCategory.ERC20,
            AssetTransfersCategory.ERC721,
            AssetTransfersCategory.ERC1155,
            AssetTransfersCategory.INTERNAL,
          ],
          withMetadata: true,
          maxCount: limit * 3,
        });

        const combinedTransfers = [...transfers.transfers, ...transfersTo.transfers];
        const seenHashes = new Set<string>();
        const deduplicatedTransfers = combinedTransfers.filter((transfer) => {
          if (transfer.hash && seenHashes.has(transfer.hash)) {
            return false;
          }
          if (transfer.hash) seenHashes.add(transfer.hash);
          return true;
        });

        for (const transfer of deduplicatedTransfers) {
          try {
            if (!transfer.to || !transfer.from) continue;
            const isReceived = transfer.to.toLowerCase() === address.toLowerCase();

            let timestamp = Date.now();
            if (transfer.metadata?.blockTimestamp) {
              timestamp = new Date(transfer.metadata.blockTimestamp).getTime();
            } else if (transfer.blockNum) {
              const blockNum = transfer.blockNum ? parseInt(transfer.blockNum, 16) : undefined;
              if (blockNum) {
                const block = await client.getBlock({ blockNumber: BigInt(blockNum) });
                timestamp = Number(block.timestamp) * 1000;
              }
            }

            let valueStr = "0";
            let tokenSymbol = "ETH";
            let numericValue = 0;

            if (transfer.erc1155Metadata) {
              valueStr = transfer.erc1155Metadata.length.toString();
              tokenSymbol = "NFT";
              numericValue = parseFloat(valueStr);
            } else if (transfer.erc721TokenId) {
              valueStr = "1";
              tokenSymbol = "NFT";
              numericValue = 1;
            } else if (transfer.rawContract?.decimal) {
              const decimals = parseInt(transfer.rawContract.decimal);
              const rawValueStr = transfer.value?.toString() || "0";
              let calculatedValue = 0;

              try {
                if (rawValueStr.includes(".") || rawValueStr.toLowerCase().includes("e")) {
                  calculatedValue = parseFloat(rawValueStr);
                } else if (
                  transfer.category === "erc20" ||
                  transfer.category === "erc1155" ||
                  transfer.category === "erc721"
                ) {
                  calculatedValue = parseFloat(rawValueStr);
                } else {
                  const rawValue = BigInt(rawValueStr);
                  const divisor = BigInt(10 ** decimals);
                  calculatedValue = Number(rawValue) / Number(divisor);
                }
              } catch (error) {
                console.error(`[Transaction History] Error parsing value "${rawValueStr}":`, error);
                calculatedValue = parseFloat(rawValueStr) || 0;
              }

              numericValue = calculatedValue;

              if (calculatedValue === 0) {
                valueStr = "0";
              } else if (calculatedValue < 0.0001) {
                valueStr = calculatedValue.toFixed(18).replace(/\.?0+$/, "");
              } else {
                valueStr = calculatedValue.toFixed(8).replace(/\.?0+$/, "");
              }
              tokenSymbol = "TOKEN";
            } else {
              const ethValue = parseFloat(transfer.value?.toString() || "0");
              numericValue = ethValue;

              if (ethValue === 0) {
                valueStr = "0";
              } else if (ethValue < 0.0001) {
                valueStr = ethValue.toFixed(18).replace(/\.?0+$/, "");
              } else {
                valueStr = ethValue.toFixed(8).replace(/\.?0+$/, "");
              }
              tokenSymbol = "ETH";
            }

            if (transfer.asset) {
              tokenSymbol = transfer.asset;
            }

            const isInternal = transfer.category === "internal";
            if (numericValue === 0 && !isInternal) {
              continue;
            }

            let status: TxStatus = TxStatus.SUCCESS;
            try {
              if (transfer.hash) {
                const receipt = await client.getTransactionReceipt({ hash: transfer.hash as `0x${string}` });
                status = receipt ? (receipt.status === "success" ? TxStatus.SUCCESS : TxStatus.FAILED) : TxStatus.PENDING;
              }
            } catch {
              status = TxStatus.PENDING;
            }

            allTransactions.push({
              hash: transfer.hash || "0x",
              from: transfer.from || "0x0000000000000000000000000000000000000000",
              to: transfer.to || "0x0000000000000000000000000000000000000000",
              value: valueStr,
              timestamp: Math.floor(timestamp / 1000),
              type: isReceived ? TxType.RECEIVED : TxType.SENT,
              status,
              tokenSymbol,
              tokenAddress: transfer.rawContract?.address || undefined,
              eventType: isInternal ? "internal_transaction" : transfer.category,
            });
          } catch (transferError) {
            console.warn(`[Transaction History] Error processing transfer:`, transferError);
          }
        }
      } catch (alchemyError: any) {
        console.error("[Transaction History] Alchemy error:", alchemyError);
        alchemyApiKey = undefined;
      }
    }

    if (!alchemyApiKey || allTransactions.length === 0) {
      const currentBlock = await client.getBlockNumber();
      const fromBlock = currentBlock - 5_000n;
      const toBlock = "latest";

      const transferEventAbi = parseAbi(["event Transfer(address indexed from, address indexed to, uint256 value)"]);

      for (const token of TOKEN_METADATA) {
        try {
          const logsTo = await client.getLogs({
            address: token.address,
            event: transferEventAbi[0],
            args: { to: address },
            fromBlock,
            toBlock,
          });

          const logsFrom = await client.getLogs({
            address: token.address,
            event: transferEventAbi[0],
            args: { from: address },
            fromBlock,
            toBlock,
          });

          for (const log of [...logsTo, ...logsFrom]) {
            try {
              const block = await client.getBlock({ blockNumber: log.blockNumber });
              const receipt = await client.getTransactionReceipt({ hash: log.transactionHash });
              const isReceived = log.args.to?.toLowerCase() === address.toLowerCase();

              let decimals = token.decimals;
              try {
                const decimalsData = await client.readContract({
                  address: token.address,
                  abi: erc20Abi,
                  functionName: "decimals",
                });
                decimals = Number(decimalsData);
              } catch {
                /* keep default decimals */
              }

              const divisor = BigInt(10 ** decimals);
              const valueStr = (Number(log.args.value) / Number(divisor)).toFixed(decimals);

              allTransactions.push({
                hash: log.transactionHash,
                from: log.args.from || "0x0000000000000000000000000000000000000000",
                to: log.args.to || "0x0000000000000000000000000000000000000000",
                value: valueStr,
                timestamp: Number(block.timestamp),
                type: isReceived ? TxType.RECEIVED : TxType.SENT,
                status: receipt ? (receipt.status === "success" ? TxStatus.SUCCESS : TxStatus.FAILED) : TxStatus.PENDING,
                tokenSymbol: token.symbol,
                tokenAddress: token.address,
                eventType: "token_transfer",
              });
            } catch (error) {
              console.warn(`Error processing log:`, error);
            }
          }
        } catch (error) {
          console.warn(`[Transaction History] Error fetching transfers for ${token.symbol}:`, error);
        }
      }
    }

    const sortedTransactions = allTransactions.sort((a, b) => b.timestamp - a.timestamp);
    return sortedTransactions.slice(0, limit);
  } catch (error) {
    console.error("[Transaction History] Error fetching transactions:", error);
    return [];
  }
}
