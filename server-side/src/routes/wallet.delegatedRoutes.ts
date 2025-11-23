import type { Request, Response, Router } from "express";
import { Address, parseUnits } from "viem";

import {
  buildEnableSelectorUO,
  buildGrantAccessUO,
  buildInstallCallPolicyUO,
  buildInstallPermissionUO,
  buildUninstallPermissionUO,
  buildSetTokenLimitUO,
  buildSetRecipientAllowedUO,
  CallPolicyPermission,
  getRootCurrentNonce,
  sendUserOpV07,
  KERNEL,
  getAllowedTokens,
  getAllowedRecipients,
} from "../utils/native-code";
import { InstallationStatus } from "../services/websocket";
import { wsService } from "../index";
import { checkPrefundSimple } from "./wallet.prefund";

// Constant for the execute function selector (defined by kernel contract)
const EXECUTE_SELECTOR = "0xe9ae5c53" as `0x${string}`;

type TokenLimitInput = {
  token: string;
  txLimit: string | number;
  dailyLimit: string | number;
  decimals?: number;
  enabled?: boolean;
};

type CallPolicyConfigInput = {
  tokenLimits?: TokenLimitInput[];
  recipients?: string[];
};

type NormalizedTokenLimit = {
  token: Address;
  txLimit: bigint;
  dailyLimit: bigint;
  enabled: boolean;
};

type NormalizedCallPolicyPayload = {
  callPolicyPermissions: CallPolicyPermission[];
  tokenLimits: NormalizedTokenLimit[];
  recipients: Address[];
};

export function registerDelegatedRoutes(router: Router): void {
  // Route to create a delegated key with specified permissions (include full flow)
  router.post("/delegated/create", async (req: Request, res: Response) => {
    try {
      console.log("***".repeat(30));
      console.log("***".repeat(30));
      console.log("***".repeat(30));
      console.log("[delegated/create] -> req.body:", req.body);
      console.log("***".repeat(30));
      console.log("***".repeat(30));
      console.log("***".repeat(30));


      const { delegatedEOA, keyType, clientId, permissions, callPolicyConfig } = req.body ?? {};

      // validate the format of delegatedEOA (expect correct address)
      const validationError = validateDelegatedEOA(delegatedEOA);
      if (validationError) {
        return res.status(400).json({ error: validationError });
      }

      // expect specific type of policy for installation
      if (!keyType || !["sudo", "restricted", "callpolicy"].includes(keyType)) {
        return res
          .status(400)
          .json({ error: "keyType is required and must be either 'sudo', 'restricted', or 'callpolicy'" });
      }

      // callpolicy - restricted policy, requires permissions array
      if (keyType === "callpolicy") {
        if (!permissions) {
          return res
            .status(400)
            .json({ error: "permissions is required for callpolicy keyType" });
        }

        // validate permissions input format for each key (supports both legacy array and RequestCreateDelegateKey shape)
        const permissionValidationError = validateCallPolicyPermissions(permissions);
        if (permissionValidationError) {
          return res.status(400).json({ error: permissionValidationError });
        }
      }

      const installationId = Math.random().toString(36).substring(7);

      try {
        // Check prefund before proceeding
        const prefundResult = await checkPrefundSimple();
        if (!prefundResult.hasPrefund) {
          console.error(`[Installation ${installationId}] Prefund check failed:`, prefundResult.message);
          return res.status(400).json({
            error: "Insufficient funds",
            message: prefundResult.message,
            details: prefundResult.message,
          });
        }
      } catch (prefundError: any) {
        console.error(`[Installation ${installationId}] Prefund check failed:`, prefundError);
        return res.status(400).json({
          error: "Prefund check failed",
          message: "Failed to check account balance. Please try again.",
          details: prefundError.message,
        });
      }

      console.log("***".repeat(30));
      console.log("***".repeat(30));
      console.log("***".repeat(30));
      console.log("Permission:");
      console.log(permissions);
      console.log("***".repeat(30));
      console.log("***".repeat(30));
      console.log("***".repeat(30));

      // Start the installation process asynchronously
      let normalizedCallPolicy: NormalizedCallPolicyPayload | null = null;
      if (keyType === "callpolicy") {
        normalizedCallPolicy = extractCallPolicyPayload(permissions, callPolicyConfig, delegatedEOA);

        if (!normalizedCallPolicy.callPolicyPermissions.length) {
          return res.status(400).json({
            error: "No permissions provided",
            message: "At least one permission is required for callpolicy",
          });
        }
      }

      performDelegatedKeyInstallation(
        installationId,
        delegatedEOA,
        keyType,
        clientId,
        normalizedCallPolicy?.callPolicyPermissions ?? [],
        normalizedCallPolicy?.tokenLimits ?? [],
        normalizedCallPolicy?.recipients ?? []
      );

      return res.json({
        success: true,
        installationId,
        message: "Installation started",
      });
    } catch (err: any) {
      console.error("[/delegated/create] error:", err);
      return res.status(500).json({
        error: "Failed to start delegated key creation",
        details: err?.message ?? "internal error",
      });
    }
  });

  // Route to revoke a delegated key's access
  router.post("/revoke", async (req: Request, res: Response) => {
    try {
      const { delegatedEOA } = req.body ?? {};

      if (!delegatedEOA) {
        return res.status(400).json({
          error: "delegatedEOA is required",
          message: "Please provide the delegated EOA address to revoke",
        });
      }

      if (!/^0x[a-fA-F0-9]{40}$/.test(delegatedEOA)) {
        return res.status(400).json({
          error: "Invalid address format",
          message: "Please provide a valid Ethereum address (0x...)",
        });
      }

      console.log(`[revoke] -> Revoking access for delegated EOA: ${delegatedEOA}`);

      try {
        const prefundResult = await checkPrefundSimple();
        if (!prefundResult.hasPrefund) {
          console.error(`[revoke] Prefund check failed:`, prefundResult.message);
          return res.status(400).json({
            error: "Insufficient funds",
            message: prefundResult.message,
            details: prefundResult.message,
          });
        }
      } catch (prefundError: any) {
        console.error(`[revoke] Prefund check failed:`, prefundError);
        return res.status(400).json({
          error: "Prefund check failed",
          message: "Failed to check account balance. Please try again.",
          details: prefundError.message,
        });
      }

      let unpacked;
      let permissionId;
      let vId;
      let retries = 3;
      let lastError: any;

      while (retries > 0) {
        try {
          const result = await buildUninstallPermissionUO(delegatedEOA as `0x${string}`);
          unpacked = result.unpacked;
          permissionId = result.permissionId;
          vId = result.vId;
          break;
        } catch (err: any) {
          lastError = err;
          const isRateLimit =
            err?.status === 429 ||
            err?.cause?.status === 429 ||
            err?.message?.includes("429") ||
            err?.message?.includes("Too Many Requests") ||
            err?.details === "Too Many Requests";

          if (isRateLimit && retries > 1) {
            const waitTime = Math.pow(2, 3 - retries) * 1000;
            console.warn(`[revoke] Rate limit hit (429), retrying in ${waitTime}ms... (${retries} retries left)`);
            await new Promise((resolve) => setTimeout(resolve, waitTime));
            retries--;
            continue;
          } else {
            throw err;
          }
        }
      }

      if (!unpacked || !permissionId || !vId) {
        throw lastError || new Error("Failed to build uninstall user operation");
      }

      console.log(`[revoke] -> Permission ID: ${permissionId}`);
      console.log(`[revoke] -> vId: ${vId}`);

      const { txHash } = await sendUserOpV07(unpacked);

      console.log(`[revoke] -> Revocation transaction sent: ${txHash}`);

      return res.json({
        success: true,
        txHash,
        message: "Delegated key access revoked successfully",
      });
    } catch (err: any) {
      console.error("[/revoke] error:", err);

      const isRateLimit =
        err?.status === 429 ||
        err?.cause?.status === 429 ||
        err?.message?.includes("429") ||
        err?.message?.includes("Too Many Requests") ||
        err?.details === "Too Many Requests";

      if (isRateLimit) {
        return res.status(429).json({
          error: "Rate limit exceeded",
          message: "Too many requests to the blockchain RPC. Please wait a moment and try again.",
          details: "The RPC endpoint (Infura) has rate limits. Please wait a few seconds before retrying.",
          retryAfter: 5,
        });
      }

      return res.status(500).json({
        error: "Revocation failed",
        message: err?.message ?? "Failed to revoke delegated key access",
        details: err?.message ?? "internal error",
      });
    }
  });
}

// Helper functions for validation correct address format
function validateDelegatedEOA(address: unknown): string | null {
  if (!address || typeof address !== "string") {
    return "delegatedEOA is required and must be a valid Ethereum address string";
  }

  if (!address.startsWith("0x") || address.length !== 42) {
    return "delegatedEOA must be a valid Ethereum address (0x + 40 hex chars)";
  }

  return null;
}

// Helper to convert input permissions to CallPolicyPermission format
function convertToCallPolicyPermissions(permissions: any[], delegatedEOA: string): CallPolicyPermission[] {
  console.log("*".repeat(50));
  console.log("*".repeat(50));
  console.log("Converting permissions:", permissions);
  console.log("*".repeat(50));
  console.log("*".repeat(50));

  return permissions.map((perm) => {
    const selector = perm.selector === "0x" ? "0x00000000" : perm.selector;
    return {
      callType: Number(perm.callType) || 0,
      target: perm.target as `0x${string}`,
      delegatedKey: (perm.delegatedKey || delegatedEOA) as `0x${string}`,
      selector: selector as `0x${string}`,
      rules: (perm.rules || []).map((rule: any) => ({
        condition: Number(rule.condition) || 0,
        offset: BigInt(rule.offset ?? 0),
        params: (rule.params || []) as `0x${string}`[],
      })),
    };
  });
}

// helper to validate call policy permissions format (we expect specific input format)
function validateCallPolicyPermissions(permissions: any[]): string | null {
  // RequestCreateDelegateKey shape
  if (permissions && (permissions as any).permissions && Array.isArray((permissions as any).permissions)) {
    const entries = (permissions as any).permissions;
    for (let i = 0; i < entries.length; i++) {
      const perm = entries[i]?.permission ?? entries[i];
      if (!perm) {
        return `permissions.permissions[${i}] is required`;
      }
      if (perm.callType === undefined || typeof perm.callType !== "number") {
        return `permissions.permissions[${i}].callType is required and must be a number (0 or 1)`;
      }
      if (!perm.target || typeof perm.target !== "string") {
        return `permissions.permissions[${i}].target is required and must be a valid Ethereum address`;
      }
      if (!perm.selector || typeof perm.selector !== "string") {
        return `permissions.permissions[${i}].selector is required and must be a 4-byte hex string`;
      }
    }
    return null;
  }

  for (let i = 0; i < permissions.length; i++) {
    const perm = permissions[i];
    if (perm.callType === undefined || typeof perm.callType !== "number") {
      return `permissions[${i}].callType is required and must be a number (0 or 1)`;
    }
    if (!perm.target || typeof perm.target !== "string") {
      return `permissions[${i}].target is required and must be a valid Ethereum address`;
    }
    if (!perm.selector || typeof perm.selector !== "string") {
      return `permissions[${i}].selector is required and must be a 4-byte hex string`;
    }
    if (perm.delegatedKey && typeof perm.delegatedKey !== "string") {
      return `permissions[${i}].delegatedKey must be a valid Ethereum address if provided`;
    }
  }
  return null;
}

function validateCallPolicyConfig(config?: CallPolicyConfigInput): string | null {
  if (!config) {
    return "callPolicyConfig is required for callpolicy keyType";
  }
  if (!Array.isArray(config.tokenLimits) || config.tokenLimits.length === 0) {
    return "callPolicyConfig.tokenLimits must be a non-empty array";
  }
  if (!Array.isArray(config.recipients) || config.recipients.length === 0) {
    return "callPolicyConfig.recipients must be a non-empty array of addresses";
  }

  for (let i = 0; i < config.tokenLimits.length; i++) {
    const limit = config.tokenLimits[i];
    if (!limit?.token || typeof limit.token !== "string") {
      return `tokenLimits[${i}].token is required`;
    }
    if (limit.txLimit === undefined || limit.txLimit === null) {
      return `tokenLimits[${i}].txLimit is required`;
    }
    if (limit.dailyLimit === undefined || limit.dailyLimit === null) {
      return `tokenLimits[${i}].dailyLimit is required`;
    }
  }

  return null;
}

function normalizeTokenLimits(limits?: TokenLimitInput[]): NormalizedTokenLimit[] {
  if (!Array.isArray(limits)) return [];
  const seen = new Set<string>();
  const result: NormalizedTokenLimit[] = [];

  for (const limit of limits) {
    if (!limit?.token || typeof limit.token !== "string") continue;
    const lower = limit.token.toLowerCase();
    if (!/^0x[a-fA-F0-9]{40}$/.test(lower)) continue;
    if (seen.has(lower)) continue;

    const decimals = typeof limit.decimals === "number" ? limit.decimals : 18;
    try {
      const txLimit = parseUnits(limit.txLimit?.toString() ?? "0", decimals);
      const dailyLimit = parseUnits(limit.dailyLimit?.toString() ?? "0", decimals);
      result.push({
        token: lower as Address,
        txLimit,
        dailyLimit,
        enabled: limit.enabled !== false,
      });
      seen.add(lower);
    } catch (error) {
      console.warn("[CallPolicy] Failed to normalize token limit", limit, error);
      continue;
    }
  }

  return result;
}

function normalizeRecipients(recipients?: string[]): Address[] {
  if (!Array.isArray(recipients)) return [];
  const seen = new Set<string>();
  const result: Address[] = [];

  for (const recipient of recipients) {
    if (!recipient || typeof recipient !== "string") continue;
    const lower = recipient.toLowerCase();
    if (!/^0x[a-fA-F0-9]{40}$/.test(lower)) continue;
    if (seen.has(lower)) continue;

    seen.add(lower);
    result.push(lower as Address);
  }

  return result;
}

function extractCallPolicyPayload(
  permissionsInput: any,
  callPolicyConfig: CallPolicyConfigInput | undefined,
  delegatedEOA: string
): NormalizedCallPolicyPayload {
  const collectedPermissions: CallPolicyPermission[] = [];
  const tokenLimitInputs: TokenLimitInput[] = [];
  const recipientsSet = new Set<string>();

  const maybeAddRecipient = (addr?: string) => {
    if (addr && typeof addr === "string") {
      recipientsSet.add(addr);
    }
  };

  // RequestCreateDelegateKey shape: { permissions: PermissionTokenEntry[] }
  if (permissionsInput?.permissions && Array.isArray(permissionsInput.permissions)) {
    for (const entry of permissionsInput.permissions) {
      const perm = entry?.permission ?? entry;
      if (!perm) continue;

      collectedPermissions.push({
        callType: Number(perm.callType) || 0,
        target: perm.target as `0x${string}`,
        delegatedKey: (perm.delegatedKey || delegatedEOA) as `0x${string}`,
        selector: (perm.selector === "0x" ? "0x00000000" : perm.selector) as `0x${string}`,
        rules: (perm.rules || []).map((rule: any) => ({
          condition: Number(rule.condition) || 0,
          offset: BigInt(rule.offset ?? 0),
          params: (rule.params || []) as `0x${string}`[],
        })),
      });

      maybeAddRecipient(perm.target);

      const tle = entry?.tokenLimitEntry;
      if (tle?.token && tle.limit) {
        tokenLimitInputs.push({
          token: tle.token,
          txLimit: tle.limit.txLimit ?? "0",
          dailyLimit: tle.limit.dailyLimit ?? "0",
          decimals: tle.limit.decimals,
          enabled: tle.limit.enabled !== false,
        });
      }
    }
  } else if (Array.isArray(permissionsInput)) {
    collectedPermissions.push(...convertToCallPolicyPermissions(permissionsInput, delegatedEOA));
    permissionsInput.forEach((perm: any) => maybeAddRecipient(perm?.target));
  }

  // Merge explicit config recipients/token limits
  if (Array.isArray(callPolicyConfig?.recipients)) {
    callPolicyConfig.recipients.forEach((r) => maybeAddRecipient(r));
  }
  if (Array.isArray(callPolicyConfig?.tokenLimits)) {
    tokenLimitInputs.push(...callPolicyConfig.tokenLimits);
  }

  return {
    callPolicyPermissions: collectedPermissions,
    tokenLimits: normalizeTokenLimits(tokenLimitInputs),
    recipients: normalizeRecipients(Array.from(recipientsSet)),
  };
}

// Asynchronous installation process for delegated keys
async function performDelegatedKeyInstallation(
  installationId: string,
  delegatedEOA: string,
  keyType: "sudo" | "restricted" | "callpolicy",
  clientId?: string,
  callPolicyPermissionsArg?: CallPolicyPermission[],
  normalizedTokenLimits: NormalizedTokenLimit[] = [],
  normalizedRecipients: Address[] = []
): Promise<void> {
  const sendStatus = (status: InstallationStatus) => {
    console.log(`[Installation ${installationId}] Status:`, status);
    if (clientId) {
      wsService.broadcastToClient(clientId, status);
    } 
    // else {
    //   wsService.broadcastToAll(status);
    // }
  };

  const tokenLimits: NormalizedTokenLimit[] = keyType === "callpolicy" ? normalizedTokenLimits : [];
  const recipients: Address[] = keyType === "callpolicy" ? normalizedRecipients : [];

  console.log("***".repeat(30));
  console.log("***".repeat(30));
  console.log("***".repeat(30));
  console.log("tokenLimits:");
  console.log(tokenLimits);
  console.log("***".repeat(30));
  console.log("***".repeat(30));
    console.log("recipients:");
  console.log(recipients);
  console.log("***".repeat(30));


  try {
    sendStatus({
      step: "installing",
      message: "Installing permission validation...",
      progress: 10,
    });

    let installTxHash: string;
    let permissionId: string;
    let vId: string;

    if (keyType === "callpolicy") {
      const callPolicyPermissions = callPolicyPermissionsArg ?? [];

      console.log("***".repeat(30));
      console.log("***".repeat(30));
      console.log("callPolicyPermissions:");
      console.log(callPolicyPermissions);
      console.log("***".repeat(30));
      console.log("***".repeat(30));

      logCallPolicySummary(delegatedEOA, callPolicyPermissions);

      const { unpacked: installUO, permissionId: permId, vId: vid } = await buildInstallCallPolicyUO(
        delegatedEOA as `0x${string}`,
        callPolicyPermissions
      );
      console.log("****".repeat(20));
      console.log("SendUserOpV07");
      ({ txHash: installTxHash } = await sendUserOpV07(installUO));
      console.log("^^^^^".repeat(20));
      console.log("^^^^^".repeat(20));
      console.log("^^^^^".repeat(20));
      permissionId = permId;
      vId = vid;
    } else {
      const rootNonceBefore = await getRootCurrentNonce();
      console.log(`[Installation ${installationId}] Root nonce before install: ${rootNonceBefore}`);

      const { unpacked: installUO, permissionId: permId, vId: vid } = await buildInstallPermissionUO(
        delegatedEOA as `0x${string}`
      );

      sendStatus({
        step: "installing",
        message: "Sending install transaction...",
        progress: 25,
      });

      ({ txHash: installTxHash } = await sendUserOpV07(installUO));
      permissionId = permId;
      vId = vid;

      console.log(`[Installation ${installationId}] Install tx:`, installTxHash);

      const rootNonceAfter = await getRootCurrentNonce();

      if (rootNonceAfter > rootNonceBefore) {
        console.log(
          `[Installation ${installationId}] Install confirmed! Nonce updated: ${rootNonceBefore} -> ${rootNonceAfter}`
        );
      } else {
        console.warn(
          `[Installation ${installationId}] Nonce not yet updated (${rootNonceBefore} -> ${rootNonceAfter}), but receipt was received. Transaction should be confirmed.`
        );
      }

      sendStatus({
        step: "installing",
        message: "Install transaction confirmed!",
        progress: 50,
        txHash: installTxHash,
      });
    }

    if (!installTxHash) {
      throw new Error("Installation transaction hash not available");
    }

    sendStatus({
      step: "installing",
      message: "Install transaction confirmed!",
      progress: 50,
      txHash: installTxHash,
    });

    sendStatus({
      step: "granting",
      message: "Granting access to execute selector...",
      progress: 60,
    });

    let grantTxHash: string = "";

    if (keyType === "sudo") {
      const rootNonceBeforeGrant = await getRootCurrentNonce();
      const { unpacked: grantUO } = await buildGrantAccessUO(vId as `0x${string}`, EXECUTE_SELECTOR, true);
      ({ txHash: grantTxHash } = await sendUserOpV07(grantUO));

      const rootNonceAfterGrant = await getRootCurrentNonce();
      if (rootNonceAfterGrant > rootNonceBeforeGrant) {
        console.log(
          `[Installation ${installationId}] Grant confirmed! Nonce: ${rootNonceBeforeGrant} -> ${rootNonceAfterGrant}`
        );
      }
    } else if (keyType === "callpolicy") {
      sendStatus({
        step: "granting",
        message: "Granting access to execute selector for CallPolicy...",
        progress: 70,
      });

      const rootNonceBeforeGrant = await getRootCurrentNonce();
      const { unpacked: grantUO } = await buildGrantAccessUO(vId as `0x${string}`, EXECUTE_SELECTOR, true);
      ({ txHash: grantTxHash } = await sendUserOpV07(grantUO));

      const rootNonceAfterGrant = await getRootCurrentNonce();
      if (rootNonceAfterGrant > rootNonceBeforeGrant) {
        console.log(
          `[Installation ${installationId}] Grant confirmed! Nonce: ${rootNonceBeforeGrant} -> ${rootNonceAfterGrant}`
        );
      }
    }

    console.log(`[Installation ${installationId}] Grant tx:`, grantTxHash);

    if (keyType === "callpolicy" && (tokenLimits.length > 0 || recipients.length > 0)) {
      sendStatus({
          step: "installing",
          message: "Applying CallPolicy token and recipient limits...",
          progress: 80,
        });


      // Apply token limits and recipient restrictions
      if (recipients.length > 0) {
        const recipientList = recipients;
        const allowedList = recipients.map(() => true);

        const { unpacked } = await buildSetRecipientAllowedUO(
          permissionId as `0x${string}`,
          KERNEL,
          recipientList,
          allowedList
        );

        await sendUserOpV07(unpacked);
      }


      // Set token limits in batch
      console.log("***".repeat(30))
      console.log("***".repeat(30))
      console.log("Set token limits in batch:")
      console.log(tokenLimits)
      console.log("***".repeat(30))
      console.log("***".repeat(30))
      if (tokenLimits.length > 0) {
        const tokens = tokenLimits.map(t => t.token);
        const enabled = tokenLimits.map(t => t.enabled);
        const txLimits = tokenLimits.map(t => t.txLimit);
        const dailyLimits = tokenLimits.map(t => t.dailyLimit);

        const { unpacked } = await buildSetTokenLimitUO(
          permissionId as `0x${string}`,
          KERNEL,
          tokens,
          enabled,
          txLimits,
          dailyLimits
        );

        console.log("***".repeat(30))
        console.log("SEEEEEEEEEND")
        console.log("***".repeat(30))

        await sendUserOpV07(unpacked);
      }

      // Best-effort verification and remediation to ensure limits/recipients are actually stored on-chain
      try {
        const currentTokens = await getAllowedTokens(KERNEL, permissionId as `0x${string}`);
        const currentRecipients = await getAllowedRecipients(KERNEL, permissionId as `0x${string}`);

        const missingTokens = tokenLimits.filter(
          (tl) => !currentTokens.some((ct) => ct.token.toLowerCase() === tl.token.toLowerCase())
        );
        const missingRecipients = recipients.filter(
          (r) => !currentRecipients.some((cr) => cr.toLowerCase() === r.toLowerCase())
        );

        if (missingRecipients.length > 0) {
          console.log("[CallPolicy] Re-applying missing recipients:", missingRecipients);
          const allowedList = missingRecipients.map(() => true);
          const { unpacked } = await buildSetRecipientAllowedUO(
            permissionId as `0x${string}`,
            KERNEL,
            missingRecipients,
            allowedList
          );
          await sendUserOpV07(unpacked);
        }

        if (missingTokens.length > 0) {
          console.log("[CallPolicy] Re-applying missing token limits:", missingTokens);
          const tokens = missingTokens.map((t) => t.token);
          const enabled = missingTokens.map((t) => t.enabled);
          const txLimits = missingTokens.map((t) => t.txLimit);
          const dailyLimits = missingTokens.map((t) => t.dailyLimit);

          const { unpacked } = await buildSetTokenLimitUO(
            permissionId as `0x${string}`,
            KERNEL,
            tokens,
            enabled,
            txLimits,
            dailyLimits
          );
          await sendUserOpV07(unpacked);
        }

        const finalTokens = await getAllowedTokens(KERNEL, permissionId as `0x${string}`);
        const finalRecipients = await getAllowedRecipients(KERNEL, permissionId as `0x${string}`);
        if (recipients.length > 0 && finalRecipients.length === 0) {
          throw new Error("CallPolicy recipients not persisted on-chain");
        }
        if (tokenLimits.length > 0 && finalTokens.length === 0) {
          throw new Error("CallPolicy token limits not persisted on-chain");
        }
      } catch (verifyErr) {
        console.warn("[CallPolicy] Verification of limits/recipients failed:", verifyErr);
        throw verifyErr;
      }
    }

    const keyTypeDisplay = keyType === "sudo" ? "Sudo" : "CallPolicy";
    sendStatus({
      step: "completed",
      message: `${keyTypeDisplay} delegated key created successfully!`,
      progress: 100,
      permissionId,
      vId,
    });

    console.log(`[Installation ${installationId}] Completed successfully!`);
    console.log(`[Installation ${installationId}] Permission ID:`, permissionId);
    console.log(`[Installation ${installationId}] vId:`, vId);
  } catch (error: any) {
    console.error(`[Installation ${installationId}] Error:`, error);

    let errorMessage = error.message || "Unknown error occurred";
    let userMessage = "Installation failed due to a blockchain error";

    if (error.message?.includes("AA21 didn't pay prefund")) {
      userMessage =
        "Insufficient funds: The account doesn't have enough ETH deposited in the EntryPoint to pay for transaction fees";
      errorMessage = "AA21_PREFUND_ERROR: Account needs to deposit more ETH to the EntryPoint";
    } else if (error.message?.includes("AA23 reverted")) {
      userMessage = "Transaction reverted: The smart contract execution failed";
      errorMessage = "AA23_REVERTED: Smart contract execution failed";
    } else if (error.message?.includes("AA21")) {
      userMessage = "Account Abstraction error: There was an issue with the smart account";
      errorMessage = "AA_ERROR: Account Abstraction related error";
    } else if (error.message?.includes("timeout")) {
      userMessage = "Transaction timeout: The operation took too long to complete";
      errorMessage = "TIMEOUT_ERROR: Transaction confirmation timeout";
    } else if (error.message?.includes("RPC Request failed")) {
      userMessage = "Network error: Unable to connect to the blockchain network";
      errorMessage = "RPC_ERROR: Blockchain network connection failed";
    }

    sendStatus({
      step: "failed",
      message: userMessage,
      progress: 0,
      error: errorMessage,
    });
  }
}

// Helper to log a summary of CallPolicy permissions being installed
function logCallPolicySummary(delegatedEOA: string, permissions: CallPolicyPermission[]): void {
  console.log("\n🔒 ===== CALLPOLICY RESTRICTIONS SETUP =====");
  console.log(`📱 Delegated Key: ${delegatedEOA}`);

  const uniqueTargets = [...new Set(permissions.map((p) => p.target))];
  const uniqueSelectors = [...new Set(permissions.map((p) => p.selector))];
  const uniqueDelegatedKeys = [...new Set(permissions.map((p) => p.delegatedKey))];

  console.log("\n🎯 ALLOWED TARGET ADDRESSES:");
  uniqueTargets.forEach((target, index) => {
    console.log(`   ${index + 1}. ${target}`);
  });

  console.log("\n👤 Delegated keys in payload:");
  uniqueDelegatedKeys.forEach((dk, index) => {
    console.log(`   ${index + 1}. ${dk}`);
  });

  console.log("\nALLOWED FUNCTION SELECTORS:");
  uniqueSelectors.forEach((selector, index) => {
    const actionName = selector === "0x00000000"
      ? "ETH Transfer"
      : selector === "0xa9059cbb"
        ? "Transfer"
        : selector === "0x095ea7b3"
          ? "Approve"
          : selector === "0x23b872dd"
            ? "Transfer From"
            : selector === "0x38ed1739"
              ? "Swap"
              : selector === "0xa694fc3a"
                ? "Stake"
                : selector === "0x2e17de78"
                  ? "Unstake"
                  : selector === "0x379607f5"
                    ? "Claim Rewards"
                    : selector === "0x47e7ef24"
                      ? "Deposit"
                      : selector === "0x2e1a7d4d"
                        ? "Withdraw"
                        : "Unknown";
    console.log(`   ${index + 1}. ${actionName} (${selector})`);
  });

  console.log("\n🔐 GENERATED PERMISSIONS:");
  permissions.forEach((perm, index) => {
    const actionName = perm.selector === "0x00000000"
      ? "ETH Transfer"
      : perm.selector === "0xa9059cbb"
        ? "Transfer"
        : perm.selector === "0x095ea7b3"
          ? "Approve"
          : perm.selector === "0x23b872dd"
            ? "Transfer From"
            : perm.selector === "0x38ed1739"
              ? "Swap"
              : perm.selector === "0xa694fc3a"
                ? "Stake"
                : perm.selector === "0x2e17de78"
                  ? "Unstake"
                  : perm.selector === "0x379607f5"
          ? "Claim Rewards"
          : perm.selector === "0x47e7ef24"
            ? "Deposit"
            : perm.selector === "0x2e1a7d4d"
              ? "Withdraw"
              : "Unknown";
    console.log(`   ${index + 1}. ${actionName}`);
    console.log(`      Target: ${perm.target}`);
    console.log(`      Delegated Key: ${perm.delegatedKey}`);
    console.log(`      Selector: ${perm.selector}`);
    console.log(`      Rules: ${perm.rules.length > 0 ? JSON.stringify(perm.rules, null, 2) : "None"}`);
    console.log("");
  });
  console.log("🔒 ===========================================\n");
}
