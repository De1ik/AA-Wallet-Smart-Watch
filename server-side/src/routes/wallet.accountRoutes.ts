import type { Request, Response, Router } from "express";
import { createPublicClient, http, parseAbi, parseEther } from "viem";
import { sepolia } from "viem/chains";

import {
  buildSendRootUoUnsigned,
  buildSendTokenUoUnsigned,
  fetchAllTokenBalances,
  fetchTransactionHistory,
  sendUserOpV07,
} from "../utils/native-code";
import { fetchEtherscanTransactions } from "../utils/etherscanHistory";
import { ETH_RPC_URL } from "./wallet.constants";
import { convertEtherscanToApiFormat } from "./wallet.transactions";

const tokenClient = createPublicClient({ chain: sepolia, transport: http(ETH_RPC_URL) });
const erc20Abi = parseAbi(["function decimals() view returns (uint8)"]);

export function registerAccountRoutes(router: Router): void {
  router.get("/balances", async (req: Request, res: Response) => {
    try {
      const { address } = req.query;

      if (!address || typeof address !== "string") {
        return res.status(400).json({
          error: "Address is required",
          message: "Please provide a valid Ethereum address as query parameter",
        });
      }

      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        return res.status(400).json({
          error: "Invalid address format",
          message: "Please provide a valid Ethereum address (0x...)",
        });
      }

      console.log(`[Balance] Fetching balances for address: ${address}`);

      const balances = await fetchAllTokenBalances(address as `0x${string}`);

      console.log(`[Balance] Found ${balances.tokens.length} tokens with non-zero balance`);

      return res.json({
        success: true,
        ethBalance: balances.ethBalance,
        tokens: balances.tokens,
        message: `Found ${balances.tokens.length} tokens with balance`,
      });
    } catch (err: any) {
      console.error("[/balances] error:", err);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch balances",
        message: err?.message ?? "internal error",
        details: err?.stack,
      });
    }
  });

  router.get("/transactions", async (req: Request, res: Response) => {
    try {
      const { address, limit = 20, useEtherscan = "true" } = req.query;

      if (!address || typeof address !== "string") {
        return res.status(400).json({
          error: "Address is required",
          message: "Please provide a valid Ethereum address as query parameter",
        });
      }

      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        return res.status(400).json({
          error: "Invalid address format",
          message: "Please provide a valid Ethereum address (0x...)",
        });
      }

      console.log(`[Transactions] Fetching transaction history for address: ${address}`);

      let transactions: Array<{
        hash: string;
        from: string;
        to: string;
        value: string;
        timestamp: number;
        type: "sent" | "received";
        status: "success" | "pending" | "failed";
        tokenSymbol?: string;
        tokenAddress?: string;
        eventType?: string;
      }>;

      const useEtherscanFlag =
        useEtherscan === undefined ||
        (typeof useEtherscan === "string" && useEtherscan.toLowerCase() === "true") ||
        useEtherscan === "1";

      if (useEtherscanFlag) {
        try {
          const chain = process.env.CHAIN || "sepolia";
          const etherscanTxs = await fetchEtherscanTransactions(address, chain, Number(limit));
          transactions = etherscanTxs.map((tx) => convertEtherscanToApiFormat(tx, address));
          console.log(`[Transactions] Using Etherscan API - Found ${transactions.length} transactions`);
        } catch (etherscanError: any) {
          console.warn(
            `[Transactions] Etherscan failed, falling back to default method:`,
            etherscanError?.message
          );
          transactions = await fetchTransactionHistory(address as `0x${string}`, Number(limit));
        }
      } else {
        transactions = await fetchTransactionHistory(address as `0x${string}`, Number(limit));
      }

      console.log(`[Transactions] Found ${transactions.length} transactions`);

      return res.json({
        success: true,
        transactions,
        message: `Found ${transactions.length} transactions`,
        limit: Number(limit),
      });
    } catch (err: any) {
      console.error("[/transactions] error:", err);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch transactions",
        message: err?.message ?? "internal error",
        details: err?.stack,
        transactions: [],
      });
    }
  });

  router.post("/send", async (req: Request, res: Response) => {
    try {
      const { to, amount, tokenAddress, kernelAddress } = req.body;

      if (!to || typeof to !== "string") {
        return res.status(400).json({
          error: "Recipient address is required",
          message: "Please provide a valid recipient address",
        });
      }

      if (!/^0x[a-fA-F0-9]{40}$/.test(to)) {
        return res.status(400).json({
          error: "Invalid recipient address",
          message: "Recipient address must be a valid Ethereum address",
        });
      }

      if (!amount || typeof amount !== "string") {
        return res.status(400).json({
          error: "Amount is required",
          message: "Please provide a valid amount as string",
        });
      }

      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        return res.status(400).json({
          error: "Invalid amount",
          message: "Amount must be a positive number",
        });
      }

      console.log(`[Send] Sending ${tokenAddress ? "token" : "ETH"} to ${to}:`, amount);

      let txHash: string;

      let packed, unpacked, userOpHash;

      if (tokenAddress) {
        if (!/^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) {
          return res.status(400).json({
            error: "Invalid token address",
            message: "Token address must be a valid Ethereum address",
          });
        }

        const decimals = (await tokenClient.readContract({
          address: tokenAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: "decimals",
        })) as number;

        const amountInWei = BigInt(Math.floor(amountNum * 10 ** decimals));

        console.log(`[Send] Building ERC20 transfer: ${amount} * 10^${decimals} = ${amountInWei.toString()}`);

        const result = await buildSendTokenUoUnsigned(
          tokenAddress as `0x${string}`,
          to as `0x${string}`,
          amountInWei,
          kernelAddress,
          0
        );
        ({ packed, unpacked, userOpHash } = result);
      } else {
        const amountInWei = parseEther(amount);

        console.log(`[Send] Building ETH transfer: ${amount} ETH = ${amountInWei.toString()} wei`);

        const result = await buildSendRootUoUnsigned(to as `0x${string}`, amountInWei, "0x", kernelAddress, 0);
        ({ packed, unpacked, userOpHash } = result);
      }

      return res.json({
        success: true,
        data: {
          packed, unpacked, userOpHash
        },
        message: tokenAddress ? "Token transfer initiated" : "ETH transfer initiated",
      });
    } catch (err: any) {
      console.error("[/send] error:", err);
      return res.status(500).json({
        success: false,
        error: "Failed to send transaction",
        message: err?.message ?? "internal error",
        details: err?.stack,
      });
    }
  });
}
