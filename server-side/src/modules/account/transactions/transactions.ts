import { z } from "zod";
import { Address } from "viem";

import type { HttpResult, ErrorResponse } from "../../../shared/http/apiResponse";
import { badRequest, internalError, ok } from "../../../shared/http/apiResponse";
import { fetchTransactionHistory } from "../../../utils/native-code";
import { fetchEtherscanTransactions } from "../../../utils/etherscanHistory";
import { convertEtherscanToApiFormat } from "../helpers";
import type { TransactionsResponse } from "../types";
import { transactionsSchema } from "./schema";
import { debugLog } from "../../../shared/helpers/helper";


export async function handleGetTransactions(
  query: unknown
): Promise<HttpResult<TransactionsResponse | ErrorResponse>> {
  try {
    const parsed = transactionsSchema.safeParse(query);

    if (!parsed.success) {
      return badRequest("Validation error", parsed.error.issues[0].message);
    }

    const { address, limit, useEtherscan } = parsed.data;
    if (useEtherscan === null) {
      return badRequest("Invalid useEtherscan flag", "useEtherscan must be true/false or 1/0");
    }
    const limitValue = limit ?? 20;

    debugLog(`[Transactions] Fetching transaction history for address: ${address}`);

    let transactions: TransactionsResponse["transactions"];

    if (useEtherscan) {
      try {
        const chain = process.env.CHAIN || "sepolia";
        const etherscanTxs = await fetchEtherscanTransactions(address, chain, Number(limitValue));
        transactions = etherscanTxs.map((tx) => convertEtherscanToApiFormat(tx, address));
        debugLog(`[Transactions] Using Etherscan API - Found ${transactions.length} transactions`);
      } catch (etherscanError: any) {
        console.warn(`[Transactions] Etherscan failed, falling back to default method:`, etherscanError?.message);
        transactions = await fetchTransactionHistory(address, Number(limitValue));
      }
    } else {
      transactions = await fetchTransactionHistory(address, Number(limitValue));
    }

    console.log(`[Transactions] Found ${transactions.length} transactions`);

    return ok({
      success: true,
      transactions,
      message: `Found ${transactions.length} transactions`,
      limit: Number(limitValue),
    });
  } catch (err: any) {
    console.error("[/transactions] error:", err);
    return internalError("Failed to fetch transactions", err);
  }
}
