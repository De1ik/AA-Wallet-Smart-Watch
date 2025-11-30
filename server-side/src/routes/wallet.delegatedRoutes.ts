import type { Request, Response, Router } from "express";
import { handlePrepareDelegatedKeyCreation } from "../utils/native/delegateKey/installPrepare";
import { handleExecuteDelegatedKeyCreation } from "../utils/native/delegateKey/installExecute";
import { handlePrepareDelegatedKeyRevoke } from "../utils/native/delegateKey/revokePrepare";
import { handleExecuteDelegatedKeyRevoke } from "../utils/native/delegateKey/revokeExecute";
import type {
  InstallExecuteInput,
  InstallExecuteSuccess,
  InstallPrepareInput,
  InstallPrepareSuccess,
  RevokeExecuteInput,
  RevokeExecuteSuccess,
  RevokePrepareInput,
  RevokePrepareSuccess,
} from "../utils/native/types";
import type { ErrorResponse } from "../utils/apiResponse";


export function registerDelegatedRoutes(router: Router): void {
  // Route to create a delegated key with specified permissions (include full flow)
  router.post("/delegated/install/prepare-data", async (req: Request<any, any, InstallPrepareInput>, res: Response<InstallPrepareSuccess | ErrorResponse>) => {
    const result = await handlePrepareDelegatedKeyCreation(req.body);

    if (result.status === 200) {
      return res.json(result.body);
    }

    return res.status(result.status).json(result.body);
  });

  // Route to create a delegated key with specified permissions (include full flow)
  router.post("/delegated/install/execute", async (req: Request<any, any, InstallExecuteInput>, res: Response<InstallExecuteSuccess | ErrorResponse>) => {
    const result = await handleExecuteDelegatedKeyCreation(req.body);

    if (result.status === 200) {
      return res.json(result.body);
    }

    return res.status(result.status).json(result.body);
  });

  // Route to revoke a delegated key's access
  router.post("delegated/revoke/prepare-data", async (req: Request<any, any, RevokePrepareInput>, res: Response<RevokePrepareSuccess | ErrorResponse>) => {
    const result = await handlePrepareDelegatedKeyRevoke(req.body);

    return res.status(result.status).json(result.body);
  });

  // Route to revoke a delegated key's access
  router.post("delegated/revoke/execute", async (req: Request<any, any, RevokeExecuteInput>, res: Response<RevokeExecuteSuccess>) => {
    const result = await handleExecuteDelegatedKeyRevoke(req.body);

    return res.status(result.status).json(result.body);
  });
}









// // Helper functions for validation correct address format
// function validateDelegatedEOA(address: unknown): string | null {
//   if (!address || typeof address !== "string") {
//     return "delegatedEOA is required and must be a valid Ethereum address string";
//   }

//   if (!address.startsWith("0x") || address.length !== 42) {
//     return "delegatedEOA must be a valid Ethereum address (0x + 40 hex chars)";
//   }

//   return null;
// }

// // Helper to convert input permissions to CallPolicyPermission format
// function convertToCallPolicyPermissions(permissions: any[], delegatedEOA: string): CallPolicyPermission[] {
//   console.log("*".repeat(50));
//   console.log("*".repeat(50));
//   console.log("Converting permissions:", permissions);
//   console.log("*".repeat(50));
//   console.log("*".repeat(50));

//   return permissions.map((perm) => {
//     const selector = perm.selector === "0x" ? "0x00000000" : perm.selector;
//     return {
//       callType: Number(perm.callType) || 0,
//       target: perm.target as `0x${string}`,
//       delegatedKey: (perm.delegatedKey || delegatedEOA) as `0x${string}`,
//       selector: selector as `0x${string}`,
//       rules: (perm.rules || []).map((rule: any) => ({
//         condition: Number(rule.condition) || 0,
//         offset: BigInt(rule.offset ?? 0),
//         params: (rule.params || []) as `0x${string}`[],
//       })),
//     };
//   });
// }

// // helper to validate call policy permissions format (we expect specific input format)
// function validateCallPolicyPermissions(permissions: any[]): string | null {
//   // RequestCreateDelegateKey shape
//   if (permissions && (permissions as any).permissions && Array.isArray((permissions as any).permissions)) {
//     const entries = (permissions as any).permissions;
//     for (let i = 0; i < entries.length; i++) {
//       const perm = entries[i]?.permission ?? entries[i];
//       if (!perm) {
//         return `permissions.permissions[${i}] is required`;
//       }
//       if (perm.callType === undefined || typeof perm.callType !== "number") {
//         return `permissions.permissions[${i}].callType is required and must be a number (0 or 1)`;
//       }
//       if (!perm.target || typeof perm.target !== "string") {
//         return `permissions.permissions[${i}].target is required and must be a valid Ethereum address`;
//       }
//       if (!perm.selector || typeof perm.selector !== "string") {
//         return `permissions.permissions[${i}].selector is required and must be a 4-byte hex string`;
//       }
//     }
//     return null;
//   }

//   for (let i = 0; i < permissions.length; i++) {
//     const perm = permissions[i];
//     if (perm.callType === undefined || typeof perm.callType !== "number") {
//       return `permissions[${i}].callType is required and must be a number (0 or 1)`;
//     }
//     if (!perm.target || typeof perm.target !== "string") {
//       return `permissions[${i}].target is required and must be a valid Ethereum address`;
//     }
//     if (!perm.selector || typeof perm.selector !== "string") {
//       return `permissions[${i}].selector is required and must be a 4-byte hex string`;
//     }
//     if (perm.delegatedKey && typeof perm.delegatedKey !== "string") {
//       return `permissions[${i}].delegatedKey must be a valid Ethereum address if provided`;
//     }
//   }
//   return null;
// }

// function validateCallPolicyConfig(config?: CallPolicyConfigInput): string | null {
//   if (!config) {
//     return "callPolicyConfig is required for callpolicy keyType";
//   }
//   if (!Array.isArray(config.tokenLimits) || config.tokenLimits.length === 0) {
//     return "callPolicyConfig.tokenLimits must be a non-empty array";
//   }
//   if (!Array.isArray(config.recipients) || config.recipients.length === 0) {
//     return "callPolicyConfig.recipients must be a non-empty array of addresses";
//   }

//   for (let i = 0; i < config.tokenLimits.length; i++) {
//     const limit = config.tokenLimits[i];
//     if (!limit?.token || typeof limit.token !== "string") {
//       return `tokenLimits[${i}].token is required`;
//     }
//     if (limit.txLimit === undefined || limit.txLimit === null) {
//       return `tokenLimits[${i}].txLimit is required`;
//     }
//     if (limit.dailyLimit === undefined || limit.dailyLimit === null) {
//       return `tokenLimits[${i}].dailyLimit is required`;
//     }
//   }

//   return null;
// }

// function normalizeTokenLimits(limits?: TokenLimitInput[]): NormalizedTokenLimit[] {
//   if (!Array.isArray(limits)) return [];
//   const seen = new Set<string>();
//   const result: NormalizedTokenLimit[] = [];

//   for (const limit of limits) {
//     if (!limit?.token || typeof limit.token !== "string") continue;
//     const lower = limit.token.toLowerCase();
//     if (!/^0x[a-fA-F0-9]{40}$/.test(lower)) continue;
//     if (seen.has(lower)) continue;

//     const decimals =
//       typeof limit.decimals === "number"
//         ? limit.decimals
//         : KNOWN_TOKEN_DECIMALS[lower] ?? 18;
//     try {
//       const txLimit = parseUnits(limit.txLimit?.toString() ?? "0", decimals);
//       const dailyLimit = parseUnits(limit.dailyLimit?.toString() ?? "0", decimals);
//       result.push({
//         token: lower as Address,
//         txLimit,
//         dailyLimit,
//         enabled: limit.enabled !== false,
//       });
//       seen.add(lower);
//     } catch (error) {
//       console.warn("[CallPolicy] Failed to normalize token limit", limit, error);
//       continue;
//     }
//   }

//   return result;
// }

// function normalizeRecipients(recipients?: string[]): Address[] {
//   if (!Array.isArray(recipients)) return [];
//   const seen = new Set<string>();
//   const result: Address[] = [];

//   for (const recipient of recipients) {
//     if (!recipient || typeof recipient !== "string") continue;
//     const lower = recipient.toLowerCase();
//     if (!/^0x[a-fA-F0-9]{40}$/.test(lower)) continue;
//     if (seen.has(lower)) continue;

//     seen.add(lower);
//     result.push(lower as Address);
//   }

//   return result;
// }

// function extractCallPolicyPayload(
//   permissionsInput: any,
//   callPolicyConfig: CallPolicyConfigInput | undefined,
//   delegatedEOA: string
// ): NormalizedCallPolicyPayload {
//   const collectedPermissions: CallPolicyPermission[] = [];
//   const tokenLimitInputs: TokenLimitInput[] = [];
//   const recipientsSet = new Set<string>();

//   const maybeAddRecipient = (addr?: string) => {
//     if (addr && typeof addr === "string") {
//       recipientsSet.add(addr);
//     }
//   };

//   // RequestCreateDelegateKey shape: { permissions: PermissionTokenEntry[] }
//   if (permissionsInput?.permissions && Array.isArray(permissionsInput.permissions)) {
//     for (const entry of permissionsInput.permissions) {
//       const perm = entry?.permission ?? entry;
//       if (!perm) continue;

//       collectedPermissions.push({
//         callType: Number(perm.callType) || 0,
//         target: perm.target as `0x${string}`,
//         delegatedKey: (perm.delegatedKey || delegatedEOA) as `0x${string}`,
//         selector: (perm.selector === "0x" ? "0x00000000" : perm.selector) as `0x${string}`,
//         rules: (perm.rules || []).map((rule: any) => ({
//           condition: Number(rule.condition) || 0,
//           offset: BigInt(rule.offset ?? 0),
//           params: (rule.params || []) as `0x${string}`[],
//         })),
//       });

//       maybeAddRecipient(perm.target);

//       const tle = entry?.tokenLimitEntry;
//       if (tle?.token && tle.limit) {
//         tokenLimitInputs.push({
//           token: tle.token,
//           txLimit: tle.limit.txLimit ?? "0",
//           dailyLimit: tle.limit.dailyLimit ?? "0",
//           decimals: tle.limit.decimals,
//           enabled: tle.limit.enabled !== false,
//         });
//       }
//     }
//   } else if (Array.isArray(permissionsInput)) {
//     collectedPermissions.push(...convertToCallPolicyPermissions(permissionsInput, delegatedEOA));
//     permissionsInput.forEach((perm: any) => maybeAddRecipient(perm?.target));
//   }

//   // Merge explicit config recipients/token limits
//   if (Array.isArray(callPolicyConfig?.recipients)) {
//     callPolicyConfig.recipients.forEach((r) => maybeAddRecipient(r));
//   }
//   if (Array.isArray(callPolicyConfig?.tokenLimits)) {
//     tokenLimitInputs.push(...callPolicyConfig.tokenLimits);
//   }

//   return {
//     callPolicyPermissions: collectedPermissions,
//     tokenLimits: normalizeTokenLimits(tokenLimitInputs),
//     recipients: normalizeRecipients(Array.from(recipientsSet)),
//   };
// }

// // Asynchronous installation process for delegated keys
// async function performDelegatedKeyInstallation(
//   installationId: string,
//   delegatedEOA: string,
//   keyType: "sudo" | "restricted" | "callpolicy",
//   clientId: string,
//   kernelAddress: Address,
//   callPolicyPermissionsArg?: CallPolicyPermission[],
//   normalizedTokenLimits: NormalizedTokenLimit[] = [],
//   normalizedRecipients: Address[] = []
// ): Promise<void> {
//   const sendStatus = (status: InstallationStatus) => {
//     console.log(`[Installation ${installationId}] Status:`, status);
//     if (clientId) {
//       wsService.broadcastToClient(clientId, status);
//     } 
//     // else {
//     //   wsService.broadcastToAll(status);
//     // }
//   };

//   const tokenLimits: NormalizedTokenLimit[] = keyType === "callpolicy" ? normalizedTokenLimits : [];
//   const recipients: Address[] = keyType === "callpolicy" ? normalizedRecipients : [];

//   try {
//     sendStatus({
//       step: "installing",
//       message: "Installing permission validation...",
//       progress: 10,
//     });

//     let installTxHash: string;
//     let permissionId: string;
//     let vId: string;

//       if (keyType === "callpolicy") {
//       const callPolicyPermissions = callPolicyPermissionsArg ?? [];

//       logCallPolicySummary(delegatedEOA, callPolicyPermissions);

//       const { unpacked: installUO, packed, userOpHash, permissionId: permId, vId: vid } = await buildInstallCallPolicyUoUnsigned(
//         kernelAddress,
//         delegatedEOA as `0x${string}`,
//         callPolicyPermissions
//       );
//       ({ txHash: installTxHash } = await sendUserOpV07(installUO));
//       permissionId = permId;
//       vId = vid;
//     } else {
//       const rootNonceBefore = await getRootCurrentNonce(kernelAddress);
//       console.log(`[Installation ${installationId}] Root nonce before install: ${rootNonceBefore}`);

//       const { unpacked: installUO, packed, userOpHash, permissionId: permId, vId: vid } = await buildInstallPermissionUoUnsigned(
//         kernelAddress,
//         delegatedEOA as `0x${string}`
//       );

//       sendStatus({
//         step: "installing",
//         message: "Sending install transaction...",
//         progress: 25,
//       });

//       ({ txHash: installTxHash } = await sendUserOpV07(installUO));
//       permissionId = permId;
//       vId = vid;

//       console.log(`[Installation ${installationId}] Install tx:`, installTxHash);

//       const rootNonceAfter = await getRootCurrentNonce(kernelAddress);

//       if (rootNonceAfter > rootNonceBefore) {
//         console.log(
//           `[Installation ${installationId}] Install confirmed! Nonce updated: ${rootNonceBefore} -> ${rootNonceAfter}`
//         );
//       } else {
//         console.warn(
//           `[Installation ${installationId}] Nonce not yet updated (${rootNonceBefore} -> ${rootNonceAfter}), but receipt was received. Transaction should be confirmed.`
//         );
//       }

//       sendStatus({
//         step: "installing",
//         message: "Install transaction confirmed!",
//         progress: 50,
//         txHash: installTxHash,
//       });
//     }

//     if (!installTxHash) {
//       throw new Error("Installation transaction hash not available");
//     }

//     sendStatus({
//       step: "installing",
//       message: "Install transaction confirmed!",
//       progress: 50,
//       txHash: installTxHash,
//     });

//     sendStatus({
//       step: "granting",
//       message: "Granting access to execute selector...",
//       progress: 60,
//     });

//     let grantTxHash: string = "";

//     if (keyType === "sudo") {
//       const rootNonceBeforeGrant = await getRootCurrentNonce(kernelAddress);
//       const { unpacked: grantUO } = await buildGrantAccessUoUnsigned(
//         kernelAddress,
//         vId as `0x${string}`,
//         EXECUTE_SELECTOR,
//         true,
//         1
//       );
//       ({ txHash: grantTxHash } = await sendUserOpV07(grantUO));

//       const rootNonceAfterGrant = await getRootCurrentNonce(kernelAddress);
//       if (rootNonceAfterGrant > rootNonceBeforeGrant) {
//         console.log(
//           `[Installation ${installationId}] Grant confirmed! Nonce: ${rootNonceBeforeGrant} -> ${rootNonceAfterGrant}`
//         );
//       }
//     } else if (keyType === "callpolicy") {
//       sendStatus({
//         step: "granting",
//         message: "Granting access to execute selector for CallPolicy...",
//         progress: 70,
//       });

//       const rootNonceBeforeGrant = await getRootCurrentNonce(kernelAddress);
//       const { unpacked: grantUO } = await buildGrantAccessUoUnsigned(
//         kernelAddress,
//         vId as `0x${string}`,
//         EXECUTE_SELECTOR,
//         true,
//         1
//       );
//       ({ txHash: grantTxHash } = await sendUserOpV07(grantUO));

//       const rootNonceAfterGrant = await getRootCurrentNonce(kernelAddress);
//       if (rootNonceAfterGrant > rootNonceBeforeGrant) {
//         console.log(
//           `[Installation ${installationId}] Grant confirmed! Nonce: ${rootNonceBeforeGrant} -> ${rootNonceAfterGrant}`
//         );
//       }
//     }

//     console.log(`[Installation ${installationId}] Grant tx:`, grantTxHash);

//     if (keyType === "callpolicy" && (tokenLimits.length > 0 || recipients.length > 0)) {
//       sendStatus({
//           step: "installing",
//           message: "Applying CallPolicy token and recipient limits...",
//           progress: 80,
//         });


//       // Apply token limits and recipient restrictions
//       if (recipients.length > 0) {
//         const recipientList = recipients;
//         const allowedList = recipients.map(() => true);

//         const { unpacked, packed, userOpHash } = await buildSetRecipientAllowedUoUnsigned(
//           permissionId as `0x${string}`,
//           kernelAddress,
//           recipientList,
//           allowedList,
//           2
//         );

//         await sendUserOpV07(unpacked);
//       }


//       // Set token limits in batch
//       if (tokenLimits.length > 0) {
//         const tokens = tokenLimits.map(t => t.token);
//         const enabled = tokenLimits.map(t => t.enabled);
//         const txLimits = tokenLimits.map(t => t.txLimit);
//         const dailyLimits = tokenLimits.map(t => t.dailyLimit);

//         const { unpacked, packed, userOpHash } = await buildSetTokenLimitUoUnsigned(
//           permissionId as `0x${string}`,
//           kernelAddress,
//           tokens,
//           enabled,
//           txLimits,
//           dailyLimits,
//           3
//         );

//         await sendUserOpV07(unpacked);
//       }

//       // Best-effort verification and remediation to ensure limits/recipients are actually stored on-chain
//       try {
//         const currentTokens = await getAllowedTokens(kernelAddress, permissionId as `0x${string}`);
//         const currentRecipients = await getAllowedRecipients(kernelAddress, permissionId as `0x${string}`);

//         const missingTokens = tokenLimits.filter(
//           (tl) => !currentTokens.some((ct) => ct.token.toLowerCase() === tl.token.toLowerCase())
//         );
//         const missingRecipients = recipients.filter(
//           (r) => !currentRecipients.some((cr) => cr.toLowerCase() === r.toLowerCase())
//         );

//         if (missingRecipients.length > 0) {
//           console.log("[CallPolicy] Re-applying missing recipients:", missingRecipients);
//           const allowedList = missingRecipients.map(() => true);
//           const { unpacked } = await buildSetRecipientAllowedUO(
//             permissionId as `0x${string}`,
//             kernelAddress,
//             missingRecipients,
//             allowedList
//           );
//           await sendUserOpV07(unpacked);
//         }

//         if (missingTokens.length > 0) {
//           console.log("[CallPolicy] Re-applying missing token limits:", missingTokens);
//           const tokens = missingTokens.map((t) => t.token);
//           const enabled = missingTokens.map((t) => t.enabled);
//           const txLimits = missingTokens.map((t) => t.txLimit);
//           const dailyLimits = missingTokens.map((t) => t.dailyLimit);

//           const { unpacked } = await buildSetTokenLimitUO(
//             permissionId as `0x${string}`,
//             kernelAddress,
//             tokens,
//             enabled,
//             txLimits,
//             dailyLimits
//           );
//           await sendUserOpV07(unpacked);
//         }

//         const finalTokens = await getAllowedTokens(kernelAddress, permissionId as `0x${string}`);
//         const finalRecipients = await getAllowedRecipients(kernelAddress, permissionId as `0x${string}`);
//         if (recipients.length > 0 && finalRecipients.length === 0) {
//           throw new Error("CallPolicy recipients not persisted on-chain");
//         }
//         if (tokenLimits.length > 0 && finalTokens.length === 0) {
//           throw new Error("CallPolicy token limits not persisted on-chain");
//         }
//       } catch (verifyErr) {
//         console.warn("[CallPolicy] Verification of limits/recipients failed:", verifyErr);
//         throw verifyErr;
//       }
//     }

//     const keyTypeDisplay = keyType === "sudo" ? "Sudo" : "CallPolicy";
//     sendStatus({
//       step: "completed",
//       message: `${keyTypeDisplay} delegated key created successfully!`,
//       progress: 100,
//       permissionId,
//       vId,
//     });

//     console.log(`[Installation ${installationId}] Completed successfully!`);
//     console.log(`[Installation ${installationId}] Permission ID:`, permissionId);
//     console.log(`[Installation ${installationId}] vId:`, vId);
//   } catch (error: any) {
//     console.error(`[Installation ${installationId}] Error:`, error);

//     let errorMessage = error.message || "Unknown error occurred";
//     let userMessage = "Installation failed due to a blockchain error";

//     if (error.message?.includes("AA21 didn't pay prefund")) {
//       userMessage =
//         "Insufficient funds: The account doesn't have enough ETH deposited in the EntryPoint to pay for transaction fees";
//       errorMessage = "AA21_PREFUND_ERROR: Account needs to deposit more ETH to the EntryPoint";
//     } else if (error.message?.includes("AA23 reverted")) {
//       userMessage = "Transaction reverted: The smart contract execution failed";
//       errorMessage = "AA23_REVERTED: Smart contract execution failed";
//     } else if (error.message?.includes("AA21")) {
//       userMessage = "Account Abstraction error: There was an issue with the smart account";
//       errorMessage = "AA_ERROR: Account Abstraction related error";
//     } else if (error.message?.includes("timeout")) {
//       userMessage = "Transaction timeout: The operation took too long to complete";
//       errorMessage = "TIMEOUT_ERROR: Transaction confirmation timeout";
//     } else if (error.message?.includes("RPC Request failed")) {
//       userMessage = "Network error: Unable to connect to the blockchain network";
//       errorMessage = "RPC_ERROR: Blockchain network connection failed";
//     }

//     sendStatus({
//       step: "failed",
//       message: userMessage,
//       progress: 0,
//       error: errorMessage,
//     });
//   }
// }

// // Helper to log a summary of CallPolicy permissions being installed
// function logCallPolicySummary(delegatedEOA: string, permissions: CallPolicyPermission[]): void {
//   console.log("\n🔒 ===== CALLPOLICY RESTRICTIONS SETUP =====");
//   console.log(`📱 Delegated Key: ${delegatedEOA}`);

//   const uniqueTargets = [...new Set(permissions.map((p) => p.target))];
//   const uniqueSelectors = [...new Set(permissions.map((p) => p.selector))];
//   const uniqueDelegatedKeys = [...new Set(permissions.map((p) => p.delegatedKey))];

//   console.log("\n🎯 ALLOWED TARGET ADDRESSES:");
//   uniqueTargets.forEach((target, index) => {
//     console.log(`   ${index + 1}. ${target}`);
//   });

//   console.log("\n👤 Delegated keys in payload:");
//   uniqueDelegatedKeys.forEach((dk, index) => {
//     console.log(`   ${index + 1}. ${dk}`);
//   });

//   console.log("\nALLOWED FUNCTION SELECTORS:");
//   uniqueSelectors.forEach((selector, index) => {
//     const actionName = selector === "0x00000000"
//       ? "ETH Transfer"
//       : selector === "0xa9059cbb"
//         ? "Transfer"
//         : selector === "0x095ea7b3"
//           ? "Approve"
//           : selector === "0x23b872dd"
//             ? "Transfer From"
//             : selector === "0x38ed1739"
//               ? "Swap"
//               : selector === "0xa694fc3a"
//                 ? "Stake"
//                 : selector === "0x2e17de78"
//                   ? "Unstake"
//                   : selector === "0x379607f5"
//                     ? "Claim Rewards"
//                     : selector === "0x47e7ef24"
//                       ? "Deposit"
//                       : selector === "0x2e1a7d4d"
//                         ? "Withdraw"
//                         : "Unknown";
//     console.log(`   ${index + 1}. ${actionName} (${selector})`);
//   });

//   console.log("\n🔐 GENERATED PERMISSIONS:");
//   permissions.forEach((perm, index) => {
//     const actionName = perm.selector === "0x00000000"
//       ? "ETH Transfer"
//       : perm.selector === "0xa9059cbb"
//         ? "Transfer"
//         : perm.selector === "0x095ea7b3"
//           ? "Approve"
//           : perm.selector === "0x23b872dd"
//             ? "Transfer From"
//             : perm.selector === "0x38ed1739"
//               ? "Swap"
//               : perm.selector === "0xa694fc3a"
//                 ? "Stake"
//                 : perm.selector === "0x2e17de78"
//                   ? "Unstake"
//                   : perm.selector === "0x379607f5"
//           ? "Claim Rewards"
//           : perm.selector === "0x47e7ef24"
//             ? "Deposit"
//             : perm.selector === "0x2e1a7d4d"
//               ? "Withdraw"
//               : "Unknown";
//     console.log(`   ${index + 1}. ${actionName}`);
//     console.log(`      Target: ${perm.target}`);
//     console.log(`      Delegated Key: ${perm.delegatedKey}`);
//     console.log(`      Selector: ${perm.selector}`);
//     console.log(`      Rules: ${perm.rules.length > 0 ? JSON.stringify(perm.rules, null, 2) : "None"}`);
//     console.log("");
//   });
//   console.log("🔒 ===========================================\n");
// }





// // --------------- NEW UPDATED --------------- //


// async function checkNonceUpdated(kernelAddress: Address, rootNonceBefore: bigint): Promise<boolean> {
//   let counter = 0;
//   while (counter < 5) {
//     const rootNonceAfter = await getRootCurrentNonce(kernelAddress);

//     if (rootNonceAfter > rootNonceBefore) {
//       return true;
//     }
//     await new Promise((resolve) => setTimeout(resolve, 1000));
//     counter++;
//   }
//   return false;
// }


// async function executeUserOpInstallation(
//   unpacked: UnpackedUserOperationV07,
//   kernelAddress: Address,
// ): Promise<boolean> {
//   const rootNonceBefore = await getRootCurrentNonce(kernelAddress);
//   const result = await sendUserOpV07(unpacked);
//   if (!result.txHash || !result.success) {
//     throw new Error("Installation transaction hash not available");
//   }

//   const isUpdated = await checkNonceUpdated(kernelAddress, rootNonceBefore);
//   return isUpdated;
// }


// async function getInstallationErrorMessage(error: any): Promise<{ userMessage: string; errorMessage: string }> {
//     let errorMessage = error.message || "Unknown error occurred";
//     let userMessage = "Installation failed due to a blockchain error";

//     if (error.message?.includes("AA21 didn't pay prefund")) {
//       userMessage =
//         "Insufficient funds: The account doesn't have enough ETH deposited in the EntryPoint to pay for transaction fees";
//       errorMessage = "AA21_PREFUND_ERROR: Account needs to deposit more ETH to the EntryPoint";
//     } else if (error.message?.includes("AA23 reverted")) {
//       userMessage = "Transaction reverted: The smart contract execution failed";
//       errorMessage = "AA23_REVERTED: Smart contract execution failed";
//     } else if (error.message?.includes("AA21")) {
//       userMessage = "Account Abstraction error: There was an issue with the smart account";
//       errorMessage = "AA_ERROR: Account Abstraction related error";
//     } else if (error.message?.includes("timeout")) {
//       userMessage = "Transaction timeout: The operation took too long to complete";
//       errorMessage = "TIMEOUT_ERROR: Transaction confirmation timeout";
//     } else if (error.message?.includes("RPC Request failed")) {
//       userMessage = "Network error: Unable to connect to the blockchain network";
//       errorMessage = "RPC_ERROR: Blockchain network connection failed";
//     }

//     return { userMessage, errorMessage };
//   }



// async function executeDelegatedKeyInstallation(
//   data: ExecuteDelegateInstallation,
//   clientId: string,
//   kernelAddress: Address,
//   installationId: string,
// ): Promise<void> {
//   const sendStatus = (status: InstallationStatus) => {
//     console.log(`[Installation ${installationId}] Status:`, status);
//     if (clientId) {
//       wsService.broadcastToClient(clientId, status);
//     } 
//   };

//   try {
//     sendStatus({
//       step: "installing",
//       message: "Installing permission...",
//       progress: 10,
//     });

//     const isUpdatedPermissionInstalled = await executeUserOpInstallation(data.signedPermissionPolicyData.unpacked, kernelAddress);

//     sendStatus({
//       step: "installing",
//       message: "Grant access...",
//       progress: 40,
//     });

//     const isUpdatedGrant = await executeUserOpInstallation(data.signedGrantAccessData.unpacked, kernelAddress);
    
//     if (data.permissionPolicyType === PermissionPolicyType.CALL_POLICY) {
//       sendStatus({
//         step: "installing",
//         message: "Install allowed tokens...",
//         progress: 60,
//       });
      
//       const isUpdatedTokenInstall = await executeUserOpInstallation(data.signedTokenListData!.unpacked, kernelAddress);

//       sendStatus({
//         step: "installing",
//         message: "Recipient restrictions installation...",
//         progress: 100,
//       });

//       const isUpdatedRecipientInstall = await executeUserOpInstallation(data.signedRecipientListData!.unpacked, kernelAddress);
//     }

//     sendStatus({
//       step: "completed",
//       message: `${data.permissionPolicyType} delegated key created successfully!`,
//       progress: 100,
//     });
//   } catch (error: any) {
//     console.error(`[Installation ${installationId}] Error:`, error);

//     const { userMessage, errorMessage } = await getInstallationErrorMessage(error);

//     sendStatus({
//       step: "failed",
//       message: userMessage,
//       progress: 0,
//       error: errorMessage,
//     });
//   }
// }


// async function prepareDelegatedKeyInstallationData(
//   installationId: string,
//   delegatedEOA: string,
//   keyType: "sudo" | "restricted" | "callpolicy",
//   clientId: string,
//   kernelAddress: Address,
//   callPolicyPermissionsArg?: CallPolicyPermission[],
//   normalizedTokenLimits: NormalizedTokenLimit[] = [],
//   normalizedRecipients: Address[] = []
// ): Promise<DelegateInstallationPrepareData> {
//   const sendStatus = (status: InstallationStatus) => {
//     console.log(`[Installation ${installationId}] Status:`, status);
//     if (clientId) {
//       wsService.broadcastToClient(clientId, status);
//     } 
//     // else {
//     //   wsService.broadcastToAll(status);
//     // }
//   };

//   const tokenLimits: NormalizedTokenLimit[] = keyType === "callpolicy" ? normalizedTokenLimits : [];
//   const recipients: Address[] = keyType === "callpolicy" ? normalizedRecipients : [];

//   try {
//     sendStatus({
//       step: "installing",
//       message: "Installing permission validation...",
//       progress: 10,
//     });

//     let permissionId: string;
//     let vId: string;

//     let permissionPolicyData: PrepareDataForSigning;
//     let grantAccessData: PrepareDataForSigning;
//     let recipientListData: PrepareDataForSigning | undefined = undefined;
//     let tokenListData: PrepareDataForSigning | undefined = undefined;
//     let permissionPolicyType: PermissionPolicyType;

//     if (keyType === "sudo") {
//       permissionPolicyType = PermissionPolicyType.SUDO;
//       const rootNonceBefore = await getRootCurrentNonce(kernelAddress);
//       console.log(`[Installation ${installationId}] Root nonce before install: ${rootNonceBefore}`);

//       const { unpacked, packed, userOpHash, permissionId: permId, vId: vid } = await buildInstallPermissionUoUnsigned(
//         kernelAddress,
//         delegatedEOA as `0x${string}`
//       );

//       permissionPolicyData = { unpacked, packed, userOpHash };

//       permissionId = permId;
//       vId = vid;
//     } else {
//       permissionPolicyType = PermissionPolicyType.CALL_POLICY;

//       const callPolicyPermissions = callPolicyPermissionsArg ?? [];

//       logCallPolicySummary(delegatedEOA, callPolicyPermissions);

//       const { unpacked, packed, userOpHash, permissionId: permId, vId: vid } = await buildInstallCallPolicyUoUnsigned(
//         kernelAddress,
//         delegatedEOA as `0x${string}`,
//         callPolicyPermissions
//       );
//       permissionPolicyData = { unpacked, packed, userOpHash };
      
//       permissionId = permId;
//       vId = vid;
//     } 



//     if (keyType === "callpolicy") {
//       grantAccessData = await buildGrantAccessUoUnsigned(
//         kernelAddress,
//         vId as `0x${string}`,
//         EXECUTE_SELECTOR,
//         true,
//         1
//       );
//     } else {
//       grantAccessData = await buildGrantAccessUoUnsigned(
//         kernelAddress,
//         vId as `0x${string}`,
//         EXECUTE_SELECTOR,
//         true,
//         1
//       );
//     }


//     if (keyType === "callpolicy" && (tokenLimits.length > 0 || recipients.length > 0)) {
//       // Apply token limits and recipient restrictions
//       if (recipients.length > 0) {
//         const recipientList = recipients;
//         const allowedList = recipients.map(() => true);

//         recipientListData = await buildSetRecipientAllowedUoUnsigned(
//           permissionId as `0x${string}`,
//           kernelAddress,
//           recipientList,
//           allowedList,
//           2
//         );
//       }


//       // Set token limits in batch
//       if (tokenLimits.length > 0) {
//         const tokens = tokenLimits.map(t => t.token);
//         const enabled = tokenLimits.map(t => t.enabled);
//         const txLimits = tokenLimits.map(t => t.txLimit);
//         const dailyLimits = tokenLimits.map(t => t.dailyLimit);

//         tokenListData = await buildSetTokenLimitUoUnsigned(
//           permissionId as `0x${string}`,
//           kernelAddress,
//           tokens,
//           enabled,
//           txLimits,
//           dailyLimits,
//           3
//         );
//       }

//       // Best-effort verification and remediation to ensure limits/recipients are actually stored on-chain
//       try {
//         const currentTokens = await getAllowedTokens(kernelAddress, permissionId as `0x${string}`);
//         const currentRecipients = await getAllowedRecipients(kernelAddress, permissionId as `0x${string}`);

//         const missingTokens = tokenLimits.filter(
//           (tl) => !currentTokens.some((ct) => ct.token.toLowerCase() === tl.token.toLowerCase())
//         );
//         const missingRecipients = recipients.filter(
//           (r) => !currentRecipients.some((cr) => cr.toLowerCase() === r.toLowerCase())
//         );

//         if (missingRecipients.length > 0) {
//           console.log("[CallPolicy] Re-applying missing recipients:", missingRecipients);
//           const allowedList = missingRecipients.map(() => true);
//           const { unpacked } = await buildSetRecipientAllowedUoUnsigned(
//             permissionId as `0x${string}`,
//             kernelAddress,
//             missingRecipients,
//             allowedList
//           );
//         }

//         if (missingTokens.length > 0) {
//           console.log("[CallPolicy] Re-applying missing token limits:", missingTokens);
//           const tokens = missingTokens.map((t) => t.token);
//           const enabled = missingTokens.map((t) => t.enabled);
//           const txLimits = missingTokens.map((t) => t.txLimit);
//           const dailyLimits = missingTokens.map((t) => t.dailyLimit);

//           const { unpacked } = await buildSetTokenLimitUoUnsigned(
//             permissionId as `0x${string}`,
//             kernelAddress,
//             tokens,
//             enabled,
//             txLimits,
//             dailyLimits
//           );
//         }

//         const finalTokens = await getAllowedTokens(kernelAddress, permissionId as `0x${string}`);
//         const finalRecipients = await getAllowedRecipients(kernelAddress, permissionId as `0x${string}`);
//         if (recipients.length > 0 && finalRecipients.length === 0) {
//           throw new Error("CallPolicy recipients not persisted on-chain");
//         }
//         if (tokenLimits.length > 0 && finalTokens.length === 0) {
//           throw new Error("CallPolicy token limits not persisted on-chain");
//         }
//       } catch (verifyErr) {
//         console.warn("[CallPolicy] Verification of limits/recipients failed:", verifyErr);
//         throw verifyErr;
//       }
//     }


//     console.log(`[Installation ${installationId}] Completed successfully!`);
//     console.log(`[Installation ${installationId}] Permission ID:`, permissionId);
//     console.log(`[Installation ${installationId}] vId:`, vId);

//     return {
//       isSuccess: true,
//       data: {
//         permissionPolicyType,
//         permissionPolicyData,
//         grantAccessData,
//         recipientListData,
//         tokenListData
//       },
//     };

//   } catch (error: any) {
//     console.error(`[Installation ${installationId}] Error:`, error);

//     let errorMessage = error.message || "Unknown error occurred";
//     let userMessage = "Installation failed due to a blockchain error";

//     if (error.message?.includes("AA21 didn't pay prefund")) {
//       userMessage =
//         "Insufficient funds: The account doesn't have enough ETH deposited in the EntryPoint to pay for transaction fees";
//       errorMessage = "AA21_PREFUND_ERROR: Account needs to deposit more ETH to the EntryPoint";
//     } else if (error.message?.includes("AA23 reverted")) {
//       userMessage = "Transaction reverted: The smart contract execution failed";
//       errorMessage = "AA23_REVERTED: Smart contract execution failed";
//     } else if (error.message?.includes("AA21")) {
//       userMessage = "Account Abstraction error: There was an issue with the smart account";
//       errorMessage = "AA_ERROR: Account Abstraction related error";
//     } else if (error.message?.includes("timeout")) {
//       userMessage = "Transaction timeout: The operation took too long to complete";
//       errorMessage = "TIMEOUT_ERROR: Transaction confirmation timeout";
//     } else if (error.message?.includes("RPC Request failed")) {
//       userMessage = "Network error: Unable to connect to the blockchain network";
//       errorMessage = "RPC_ERROR: Blockchain network connection failed";
//     }

//     return {
//       isSuccess: false
//     };
//   }
// }
