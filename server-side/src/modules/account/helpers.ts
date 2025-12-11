import { ApiTransaction, EtherscanTransaction, TokenType, TxStatus } from "./types";

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
    status: tx.success ? TxStatus.SUCCESS : TxStatus.FAILED,
    tokenSymbol: tx.tokenSymbol || (tx.tokenType === TokenType.ETH ? "ETH" : undefined),
    tokenAddress: tx.tokenAddress,
    tokenId: tx.tokenId,
    eventType: tx.isInternal
      ? "internal_transaction"
      : tx.tokenType === TokenType.ERC20
        ? "token_transfer"
        : tx.tokenType === TokenType.ERC721 || tx.tokenType === TokenType.ERC1155
          ? "nft_transfer"
          : "external_transaction",
    errorMessage: tx.errorMessage,
  };
}
