import type { Request, Response, Router } from "express";
import {
  getPolicyStatus,
  getCallPolicyPermissionsCount,
  getCallPolicyPermissionByIndex,
  getStoredPermission,
  getAllowedTokens,
  getAllowedRecipients,
  getTokenLimit,
  getTokenDailyUsage,
  getTokenDailyUsageInfo,
  isRecipientAllowed,
  getDelegatedKeyInfo,
  getPermissionId,
  getCurrentDay,
  decodePermissionHash,
  getAllDelegatedKeys,
} from "../utils/native-code";
import { Address } from "viem";

const TOKEN_METADATA = [
  {
    address: "0x0000000000000000000000000000000000000000",
    symbol: "ETH",
    name: "Ether",
    decimals: 18,
  },
  {
    address: "0xff34b3d4aee8ddcd6f9afffb6fe49bd371b8a357",
    symbol: "DAI",
    name: "Dai Stablecoin",
    decimals: 18,
  },
  {
    address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
    symbol: "UNI",
    name: "Uniswap",
    decimals: 18,
  },
  {
    address: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14",
    symbol: "WETH",
    name: "Wrapped Ether",
    decimals: 18,
  },
  {
    address: "0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0",
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
  },
  {
    address: "0x94a9d9ac8a22534e3faca9f4e7f2e2cf85d5e4c8",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
  },
];

const findTokenMeta = (addr: string) =>
  TOKEN_METADATA.find((t) => t.address.toLowerCase() === addr.toLowerCase());

// Helper function to validate Ethereum address
function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// Helper function to validate bytes32
function isValidBytes32(hash: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(hash);
}

export function registerCallPolicyRoutes(router: Router): void {
  
  // ---------------- BASIC POLICY INFO ----------------
  
  // get complete delegated key information
  router.post("/callpolicy/info", async (req: Request, res: Response) => {
    try {
      const { owner, delegatedKey } = req.body;
      
      // verify correctness of owner and delegatedKey addresses
      if (!isValidAddress(owner)) {
        return res.status(400).json({ success: false, error: "Invalid owner (kernel) address" });
      }
      
      if (!isValidAddress(delegatedKey)) {
        return res.status(400).json({ success: false, error: "Invalid delegatedKey address" });
      }

      const policyId = getPermissionId(owner as `0x${string}`, delegatedKey as `0x${string}`);
      const info = await getDelegatedKeyInfo(owner, policyId, delegatedKey);

      if (!info) {
        return res.status(404).json({ success: false, error: "Policy not found" });
      }

      const tokensWithUsage = await Promise.all(
        info.allowedTokens.map(async (t: any) => {
          const meta = findTokenMeta(t.token);
          let usage: null | {
            used: string;
            limit: string;
            remaining: string;
            percentage: number;
          } = null;

          try {
            const usageInfo = await getTokenDailyUsageInfo(
              owner as `0x${string}`,
              policyId,
              t.token as `0x${string}`
            );
            if (usageInfo) {
              usage = {
                used: usageInfo.used.toString(),
                limit: usageInfo.limit.toString(),
                remaining: usageInfo.remaining.toString(),
                percentage: usageInfo.percentage,
              };
            }
          } catch (err) {
            usage = null;
          }

          return {
            token: t.token,
            symbol: meta?.symbol ?? "UNKNOWN",
            name: meta?.name ?? "Unknown Token",
            decimals: meta?.decimals ?? 18,
            enabled: t.enabled,
            txLimit: t.txLimit.toString(),
            dailyLimit: t.dailyLimit.toString(),
            usage,
          };
        })
      );

      return res.json({
        success: true,
        delegatedKey,
        policyId,
        data: {
          delegatedKey: info.delegatedKey,
          status: info.status,
          statusText: info.status === 0 ? "NA" : info.status === 1 ? "Live" : "Deprecated",
          isActive: info.isActive,
          allowedTokens: tokensWithUsage,
          allowedRecipients: info.allowedRecipients,
        },
      });
    } catch (err: any) {
      console.error("[POST /callpolicy/info] error:", err);
      return res.status(500).json({ success: false, error: err?.message ?? "internal error" });
    }
  });

  // get policy status
  router.post("/callpolicy/delegated-keys", async (req: Request, res: Response) => {
    try {
      const { owner } = req.body;
      if (!isValidAddress(owner)) {
        return res.status(400).json({ success: false, error: "Invalid owner (kernel) address" });
      }

      const allDelegatedKeys: Address[] = await getAllDelegatedKeys(owner);

      return res.json({
        success: true,
        allDelegatedKeys
      });
    } catch (err: any) {
      console.error("[POST /callpolicy/delegated-keys] error:", err);
      return res.status(500).json({ success: false, error: err?.message ?? "internal error" });
    }
  });

  // get policy status
  router.post("/callpolicy/status", async (req: Request, res: Response) => {
    try {
      const { owner, delegatedKey } = req.body;
      if (!isValidAddress(owner)) {
        return res.status(400).json({ success: false, error: "Invalid owner (kernel) address" });
      }

      if (!isValidAddress(delegatedKey)) {
        return res.status(400).json({ success: false, error: "Invalid delegatedKey address" });
      }

      const policyId = getPermissionId(owner as `0x${string}`, delegatedKey as `0x${string}`);
      const status = await getPolicyStatus(owner, policyId);

      return res.json({
        success: true,
        delegatedKey,
        policyId,
        status,
        statusText: status === 0 ? "NA" : status === 1 ? "Live" : "Deprecated",
        isActive: status === 1,
      });
    } catch (err: any) {
      console.error("[POST /callpolicy/status] error:", err);
      return res.status(500).json({ success: false, error: err?.message ?? "internal error" });
    }
  });

  // ---------------- PERMISSIONS ----------------

  // get number of permissions
  router.post("/callpolicy/permissions-count", async (req: Request, res: Response) => {
    try {
      const { owner, delegatedKey } = req.body;
      
      if (!isValidAddress(owner)) {
        return res.status(400).json({ success: false, error: "Invalid owner (kernel) address" });
      }

      if (!isValidAddress(delegatedKey)) {
        return res.status(400).json({ success: false, error: "Invalid delegatedKey address" });
      }

      const policyId = getPermissionId(owner as `0x${string}`, delegatedKey as `0x${string}`);
      const count = await getCallPolicyPermissionsCount(policyId, owner);

      return res.json({
        success: true,
        delegatedKey,
        policyId,
        count,
      });
    } catch (err: any) {
      console.error("[POST /callpolicy/permissions-count] error:", err);
      return res.status(500).json({ success: false, error: err?.message ?? "internal error" });
    }
  });

  // get all permissions
  router.post("/callpolicy/permissions/all", async (req: Request, res: Response) => {
    try {
      const { owner, delegatedKey } = req.body;
      
      if (!isValidAddress(owner)) {
        return res.status(400).json({ success: false, error: "Invalid owner (kernel) address" });
      }

      if (!isValidAddress(delegatedKey)) {
        return res.status(400).json({ success: false, error: "Invalid delegatedKey address" });
      }

      const policyId = getPermissionId(owner as `0x${string}`, delegatedKey as `0x${string}`);
      const count = await getCallPolicyPermissionsCount(policyId, owner);
      const permissions = [];

      for (let i = 0; i < count; i++) {
        const perm = await getCallPolicyPermissionByIndex(policyId, owner, i);
        if (perm) {
          const decoded = decodePermissionHash(perm.permissionHash, perm.delegatedKey);
          permissions.push({
            index: i,
            permissionHash: perm.permissionHash,
            delegatedKey: perm.delegatedKey,
            callType: decoded.callType,
            target: decoded.target,
            selector: decoded.selector,
            rules: perm.rules.map(r => ({
              condition: r.condition,
              offset: r.offset.toString(),
              params: r.params,
            })),
          });
        }
      }

      return res.json({
        success: true,
        delegatedKey,
        policyId,
        count: permissions.length,
        permissions,
      });
    } catch (err: any) {
      console.error("[POST /callpolicy/permissions/all] error:", err);
      return res.status(500).json({ success: false, error: err?.message ?? "internal error" });
    }
  });

  // get permission by index
  router.post("/callpolicy/permissions/index", async (req: Request, res: Response) => {
    try {
      const { owner, delegatedKey, index } = req.body;
      
      if (!isValidAddress(owner)) {
        return res.status(400).json({ success: false, error: "Invalid owner (kernel) address" });
      }

      if (!isValidAddress(delegatedKey)) {
        return res.status(400).json({ success: false, error: "Invalid delegatedKey address" });
      }

      const idx = Number(index);
      if (!Number.isInteger(idx) || idx < 0) {
        return res.status(400).json({ success: false, error: "index must be a non-negative integer" });
      }

      const policyId = getPermissionId(owner as `0x${string}`, delegatedKey as `0x${string}`);
      const perm = await getCallPolicyPermissionByIndex(policyId, owner, idx);

      if (!perm) {
        return res.status(404).json({ success: false, error: "Permission not found" });
      }
      const decoded = decodePermissionHash(perm.permissionHash, perm.delegatedKey);

      return res.json({
        success: true,
        delegatedKey,
        policyId,
        index: idx,
        permission: {
          permissionHash: perm.permissionHash,
          delegatedKey: perm.delegatedKey,
          callType: decoded.callType,
          target: decoded.target,
          selector: decoded.selector,
          rules: perm.rules.map(r => ({
            condition: r.condition,
            offset: r.offset.toString(),
            params: r.params,
          })),
        },
      });
    } catch (err: any) {
      console.error("[POST /callpolicy/permission/index] error:", err);
      return res.status(500).json({ success: false, error: err?.message ?? "internal error" });
    }
  });

  // get permission by hash
  router.post("/callpolicy/permission/hash", async (req: Request, res: Response) => {
    try {
      const { owner, delegatedKey, permissionHash } = req.body;
      if (!isValidAddress(owner)) {
        return res.status(400).json({ success: false, error: "Invalid owner (kernel) address" });
      }

      if (!isValidAddress(delegatedKey)) {
        return res.status(400).json({ success: false, error: "Invalid delegatedKey address" });
      }

      if (!isValidBytes32(permissionHash)) {
        return res.status(400).json({ success: false, error: "Invalid permissionHash format" });
      }

      const policyId = getPermissionId(owner as `0x${string}`, delegatedKey as `0x${string}`);
      const perm = await getStoredPermission(owner, policyId, permissionHash as `0x${string}`);

      if (!perm || !perm.exists) {
        return res.status(404).json({ success: false, error: "Permission not found" });
      }
      const decoded = decodePermissionHash(permissionHash as `0x${string}`, perm.delegatedKey);

      return res.json({
        success: true,
        delegatedKey,
        policyId,
        permissionHash,
        permission: {
          delegatedKey: perm.delegatedKey,
          callType: decoded.callType,
          target: decoded.target,
          selector: decoded.selector,
          rules: perm.rules.map(r => ({
            condition: r.condition,
            offset: r.offset.toString(),
            params: r.params,
          })),
        },
      });
    } catch (err: any) {
      console.error("[POST /callpolicy/permission/hash] error:", err);
      return res.status(500).json({ success: false, error: err?.message ?? "internal error" });
    }
  });

  // ---------------- TOKENS ----------------

  // get all allowed tokens with limits
  router.post("/callpolicy/token/all", async (req: Request, res: Response) => {
    try {
      const { owner, delegatedKey } = req.body;
      if (!isValidAddress(owner)) {
        return res.status(400).json({ success: false, error: "Invalid owner (kernel) address" });
      }

      if (!isValidAddress(delegatedKey)) {
        return res.status(400).json({ success: false, error: "Invalid delegatedKey address" });
      }

      const policyId = getPermissionId(owner as `0x${string}`, delegatedKey as `0x${string}`);
      const tokens = await getAllowedTokens(owner, policyId);

      return res.json({
        success: true,
        delegatedKey,
        policyId,
        count: tokens.length,
        tokens: tokens.map(t => ({
          token: t.token,
          enabled: t.enabled,
          txLimit: t.txLimit.toString(),
          dailyLimit: t.dailyLimit.toString(),
        })),
      });
    } catch (err: any) {
      console.error("[POST /callpolicy/tokens/all] error:", err);
      return res.status(500).json({ success: false, error: err?.message ?? "internal error" });
    }
  });

  // get token limit by address
  router.post("/callpolicy/token/limit", async (req: Request, res: Response) => {
    try {
      const { owner, delegatedKey, tokenAddress } = req.body;
      
      if (!isValidAddress(owner)) {
        return res.status(400).json({ success: false, error: "Invalid owner (kernel) address" });
      }

      if (!isValidAddress(delegatedKey)) {
        return res.status(400).json({ success: false, error: "Invalid delegatedKey address" });
      }

      if (!isValidAddress(tokenAddress)) {
        return res.status(400).json({ success: false, error: "Invalid tokenAddress address" });
      }

      const policyId = getPermissionId(owner as `0x${string}`, delegatedKey as `0x${string}`);
      
      const limit = await getTokenLimit(owner as `0x${string}`, policyId, tokenAddress as `0x${string}`);

      if (!limit) {
        return res.status(404).json({ success: false, error: "Token limit not found" });
      }

      return res.json({
        success: true,
        delegatedKey,
        policyId,
        tokenAddress,
        enabled: limit.enabled,
        txLimit: limit.txLimit.toString(),
        dailyLimit: limit.dailyLimit.toString(),
      });
    } catch (err: any) {
      console.error("[POST /callpolicy/token-limit] error:", err);
      return res.status(500).json({ success: false, error: err?.message ?? "internal error" });
    }
  });

  // get token daily usage
  router.post("/callpolicy/token/usage", async (req: Request, res: Response) => {
    try {
      const { owner, delegatedKey, tokenAddress, day } = req.body;
      
      if (!isValidAddress(owner)) {
        return res.status(400).json({ success: false, error: "Invalid owner (kernel) address" });
      }

      if (!isValidAddress(delegatedKey)) {
        return res.status(400).json({ success: false, error: "Invalid delegatedKey address" });
      }

      if (!isValidAddress(tokenAddress)) {
        return res.status(400).json({ success: false, error: "Invalid token address" });
      }

      const policyId = getPermissionId(owner as `0x${string}`, delegatedKey as `0x${string}`);
      const targetDay = day ? Number(day) : undefined;

      if (day !== undefined && (!Number.isInteger(targetDay) || targetDay! < 0)) {
        return res.status(400).json({ success: false, error: "day must be a non-negative integer" });
      }

      const usage = await getTokenDailyUsage(owner, policyId, tokenAddress as `0x${string}`, targetDay);

      return res.json({
        success: true,
        delegatedKey,
        policyId,
        tokenAddress,
        day: targetDay ?? getCurrentDay(),
        usage: usage.toString(),
      });
    } catch (err: any) {
      console.error("[POST /callpolicy/token/usage] error:", err);
      return res.status(500).json({ success: false, error: err?.message ?? "internal error" });
    }
  });

  // get token daily usage with limit info
  router.post("/callpolicy/token/usage-info", async (req: Request, res: Response) => {
    try {
      const { owner, delegatedKey, tokenAddress } = req.body;
      
      if (!isValidAddress(owner)) {
        return res.status(400).json({ success: false, error: "Invalid owner (kernel) address" });
      }
      if (!isValidAddress(delegatedKey)) {
        return res.status(400).json({ success: false, error: "Invalid delegatedKey address" });
      }
      if (!isValidAddress(tokenAddress)) {
        return res.status(400).json({ success: false, error: "Invalid tokenAddress address" });
      }

      const policyId = getPermissionId(owner as `0x${string}`, delegatedKey as `0x${string}`);
      const usageInfo = await getTokenDailyUsageInfo(owner, policyId, tokenAddress as `0x${string}`);

      if (!usageInfo) {
        return res.status(404).json({ success: false, error: "Token not found or not configured" });
      }

      return res.json({
        success: true,
        delegatedKey,
        policyId,
        tokenAddress,
        day: getCurrentDay(),
        used: usageInfo.used.toString(),
        limit: usageInfo.limit.toString(),
        remaining: usageInfo.remaining.toString(),
        percentage: usageInfo.percentage,
      });
    } catch (err: any) {
      console.error("[POST /callpolicy/token/usage-info] error:", err);
      return res.status(500).json({ success: false, error: err?.message ?? "internal error" });
    }
  });

  // ---------------- RECIPIENTS ----------------

  // get all allowed recipients
  router.post("/callpolicy/recipient/all", async (req: Request, res: Response) => {
    try {
      const { owner, delegatedKey } = req.body;
      
      if (!isValidAddress(owner)) {
        return res.status(400).json({ success: false, error: "Invalid owner (kernel) address" });
      }
      if (!isValidAddress(delegatedKey)) {
        return res.status(400).json({ success: false, error: "Invalid delegatedKey address" });
      }

      const policyId = getPermissionId(owner as `0x${string}`, delegatedKey as `0x${string}`);
      const recipients = await getAllowedRecipients(owner, policyId);

      return res.json({
        success: true,
        delegatedKey,
        policyId,
        count: recipients.length,
        recipients,
      });
    } catch (err: any) {
      console.error("[POST /callpolicy/recipient/all] error:", err);
      return res.status(500).json({ success: false, error: err?.message ?? "internal error" });
    }
  });

  // check if recipient is allowed
  router.post("/callpolicy/recipient/is-allowed", async (req: Request, res: Response) => {
    try {
      const { owner, delegatedKey, recipientAddress } = req.body;
      
      if (!isValidAddress(owner)) {
        return res.status(400).json({ success: false, error: "Invalid owner (kernel) address" });
      }

      if (!isValidAddress(delegatedKey)) {
        return res.status(400).json({ success: false, error: "Invalid delegatedKey address" });
      }

      if (!isValidAddress(recipientAddress)) {
        return res.status(400).json({ success: false, error: "Invalid recipientAddress address" });
      }

      const policyId = getPermissionId(owner as `0x${string}`, delegatedKey as `0x${string}`);
      const allowed = await isRecipientAllowed(owner, policyId, recipientAddress as `0x${string}`);

      return res.json({
        success: true,
        delegatedKey,
        policyId,
        recipientAddress,
        allowed,
      });
    } catch (err: any) {
      console.error("[POST /callpolicy/recipient/is-allowed] error:", err);
      return res.status(500).json({ success: false, error: err?.message ?? "internal error" });
    }
  });
}
