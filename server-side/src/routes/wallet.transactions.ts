import { EtherscanTransaction } from "../utils/etherscanHistory";

export type ApiTransaction = {
  hash: string;
  from: string;
  to: string;
  value: string;
  timestamp: number;
  type: "sent" | "received";
  status: "success" | "pending" | "failed";
  tokenSymbol?: string;
  tokenAddress?: string;
  tokenId?: string;
  eventType?: string;
  errorMessage?: string;
};

export function convertEtherscanToApiFormat(tx: EtherscanTransaction, address: string): ApiTransaction {
  let timestamp = 0;
  if (tx.timestamp !== "unknown") {
    const date = new Date(tx.timestamp);
    timestamp = Math.floor(date.getTime() / 1000);
  }

  return {
    hash: tx.hash,
    from: tx.from,
    to: tx.to,
    value: tx.value.toString(),
    timestamp,
    type: tx.type,
    status: tx.success ? "success" : "failed",
    tokenSymbol: tx.tokenSymbol || (tx.tokenType === "ETH" ? "ETH" : undefined),
    tokenAddress: tx.tokenAddress,
    tokenId: tx.tokenId,
    eventType: tx.isInternal
      ? "internal_transaction"
      : tx.tokenType === "ERC20"
        ? "token_transfer"
        : tx.tokenType === "ERC721" || tx.tokenType === "ERC1155"
          ? "nft_transfer"
          : "external_transaction",
    errorMessage: tx.errorMessage,
  };
}
