import type { Request, Response, Router } from "express";

import {
  buildEnableSelectorUO,
  buildGrantAccessUO,
  buildInstallCallPolicyUO,
  buildInstallPermissionUO,
  buildUninstallPermissionUO,
  CallPolicyPermission,
  getRootCurrentNonce,
  sendUserOpV07,
} from "../utils/native-code";
import { InstallationStatus } from "../services/websocket";
import { wsService } from "../index";
import { checkPrefundSimple } from "./wallet.prefund";

// Constant for the execute function selector (defined by kernel contract)
const EXECUTE_SELECTOR = "0xe9ae5c53" as `0x${string}`;

export function registerDelegatedRoutes(router: Router): void {
  // Route to create a delegated key with specified permissions (include full flow)
  router.post("/delegated/create", async (req: Request, res: Response) => {
    try {
      console.log("[delegated/create] -> req.body:", req.body);

      const { delegatedEOA, keyType, clientId, permissions } = req.body ?? {};

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
        if (!permissions || !Array.isArray(permissions) || permissions.length === 0) {
          return res
            .status(400)
            .json({ error: "permissions is required for callpolicy keyType and must be a non-empty array" });
        }

        // validate permissions input format for each key
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

      // Start the installation process asynchronously
      performDelegatedKeyInstallation(installationId, delegatedEOA, keyType, clientId, permissions);

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
function convertToCallPolicyPermissions(permissions: any[]): CallPolicyPermission[] {
  return permissions.map((perm) => {
    const ethValue = parseFloat(perm.valueLimit.toString());
    const weiValue = Math.floor(ethValue * 1e18);
    const ethDailyValue = parseFloat((perm.dailyLimit || 0).toString());
    const weiDailyValue = Math.floor(ethDailyValue * 1e18);
    return {
      callType: perm.callType,
      target: perm.target as `0x${string}`,
      selector: (perm.selector === "0x" ? "0x00000000" : perm.selector) as `0x${string}`,
      valueLimit: BigInt(weiValue),
      dailyLimit: BigInt(weiDailyValue),
      rules: (perm.rules || []).map((rule: any) => ({
        condition: rule.condition,
        offset: rule.offset,
        params: rule.params || [],
      })),
    };
  });
}

// helper to validate call policy permissions format (we expect specific input format)
function validateCallPolicyPermissions(permissions: any[]): string | null {
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
    if (perm.valueLimit === undefined || perm.valueLimit === null) {
      return `permissions[${i}].valueLimit is required and must be a string or number`;
    }
  }
  return null;
}

// Asynchronous installation process for delegated keys
async function performDelegatedKeyInstallation(
  installationId: string,
  delegatedEOA: string,
  keyType: "sudo" | "restricted" | "callpolicy",
  clientId?: string,
  permissions?: any[]
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
      const callPolicyPermissions = convertToCallPolicyPermissions(permissions!);

      logCallPolicySummary(delegatedEOA, callPolicyPermissions);

      const { unpacked: installUO, permissionId: permId, vId: vid } = await buildInstallCallPolicyUO(
        delegatedEOA as `0x${string}`,
        callPolicyPermissions
      );
      ({ txHash: installTxHash } = await sendUserOpV07(installUO));
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

  console.log("\n🎯 ALLOWED TARGET ADDRESSES:");
  uniqueTargets.forEach((target, index) => {
    console.log(`   ${index + 1}. ${target}`);
  });

  console.log("\n ALLOWED FUNCTION SELECTORS:");
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
    const ethValue = (Number(perm.valueLimit) / 1e18).toFixed(6);
    const ethDailyValue = (Number(perm.dailyLimit) / 1e18).toFixed(6);
    console.log(`   ${index + 1}. ${actionName}`);
    console.log(`      Target: ${perm.target}`);
    console.log(`      Selector: ${perm.selector}`);
    console.log(`      Value Limit: ${ethValue} ETH`);
    console.log(`      Daily Limit: ${ethDailyValue} ETH`);
    console.log(`      Rules: ${perm.rules.length > 0 ? JSON.stringify(perm.rules, null, 8) : "None"}`);
    console.log("");
  });
  console.log("🔒 ===========================================\n");
}
