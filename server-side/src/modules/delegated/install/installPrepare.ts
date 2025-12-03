import { Address } from "viem";
import { badRequest, ErrorResponse, HttpResult, internalError, ok } from "../../../shared/http/apiResponse";
import { validateCallPolicyPermissions, validateKeyType } from "../../../utils/native/dataValidation";
import { checkPrefundSafe, generateInstallationId } from "../../../utils/native/helpers";
import { CallPolicyPermission, DelegateInstallationPrepareData, InstallPrepareInput, InstallPrepareSuccess, NormalizedTokenLimit, PermissionPolicyType, PrepareDataForSigning, SignedDataForDelegateInstallation } from "../../../utils/native/types";
import { extractCallPolicyPayload, logCallPolicySummary } from "../helper";
import { wsService } from "../../..";
import { InstallationStatus } from "../../../services/websocket";
import { buildGrantAccessUoUnsigned, buildInstallCallPolicyUoUnsigned, buildInstallPermissionUoUnsigned, buildSetRecipientAllowedUoUnsigned, buildSetTokenLimitUoUnsigned, getRootCurrentNonce } from "../../../utils/native/userOps";
import { EXECUTE_SELECTOR } from "../../../shared/constants/constants";
import { debugLog } from "../../../shared/helpers/helper";
import { installPrepareSchema } from "../schema";


export async function handlePrepareDelegatedKeyCreation(
  input: InstallPrepareInput
): Promise<HttpResult<InstallPrepareSuccess | ErrorResponse>>  {
  try {
    const parsed = installPrepareSchema.safeParse(input);
    if (!parsed.success) {
      return badRequest("Validation error", parsed.error.issues[0].message);
    }

    const { delegatedAddress, keyType, clientId, permissions, callPolicyConfig, kernelAddress } = parsed.data;

    debugLog("[/delegated/create] Received prepare request:", input);

    // --- VALIDATION BLOCK ---
    const keyTypeError = validateKeyType(keyType);
    if (keyTypeError) return badRequest(keyTypeError);

    if (keyType === PermissionPolicyType.CALL_POLICY) {
      const permError = validateCallPolicyPermissions(permissions);
      if (permError) return badRequest(permError);
    }

    if (!clientId || typeof clientId !== "string") {
      return badRequest("clientId is required and must be a string");
    }

    // --- PREFUND CHECK ---
    const installationId = generateInstallationId();
    const prefund = await checkPrefundSafe(kernelAddress as Address, installationId);
    if (prefund.error) return badRequest(prefund.message);

    // --- NORMALIZATION ---
    let normalized = null;
    if (keyType === PermissionPolicyType.CALL_POLICY) {
      normalized = extractCallPolicyPayload(permissions, callPolicyConfig, delegatedAddress);

      if (!normalized.callPolicyPermissions.length) {
        return badRequest("At least one permission is required for callpolicy");
      }
    }

    // --- MAIN LOGIC ---
    const result = await prepareDelegatedKeyInstallationData(
      installationId,
      delegatedAddress,
      keyType,
      clientId,
      kernelAddress as Address,
      normalized?.callPolicyPermissions ?? [],
      normalized?.tokenLimits ?? [],
      normalized?.recipients ?? []
    );

    debugLog("[/delegated/create] Installation preparation result:", result);

    if (result.isSuccess) {
      return ok({
        success: true,
        data: result.data,
        installationId,
        message: "Installation started",
      });
    }

    return ok({
      success: false,
      installationId,
      message: "Installation failed",
    });

  } catch (err: any) {
    console.error("[/delegated/create] error:", err);
    return internalError("Failed to start delegated key creation", err);
  }
}


async function prepareDelegatedKeyInstallationData(
  installationId: string,
  delegatedEOA: string,
  keyType: PermissionPolicyType,
  clientId: string,
  kernelAddress: Address,
  callPolicyPermissionsArg?: CallPolicyPermission[],
  normalizedTokenLimits: NormalizedTokenLimit[] = [],
  normalizedRecipients: Address[] = []
): Promise<DelegateInstallationPrepareData> {
  const sendStatus = (status: InstallationStatus) => {
    console.log(`[Installation ${installationId}] Status:`, status);
    if (clientId) {
      wsService.broadcastToClient(clientId, status);
    } 
    // else {
    //   wsService.broadcastToAll(status);
    // }
  };

  const tokenLimits: NormalizedTokenLimit[] = keyType === PermissionPolicyType.CALL_POLICY ? normalizedTokenLimits : [];
  const recipients: Address[] = keyType === PermissionPolicyType.CALL_POLICY ? normalizedRecipients : [];

  try {
    sendStatus({
      step: "installing",
      message: "Installing permission validation...",
      progress: 10,
    });

    let permissionId: string;
    let vId: string;

    let unsignedPermissionPolicyData: PrepareDataForSigning;
    let unsignedGrantAccessData: PrepareDataForSigning;
    let unsignedRecipientListData: PrepareDataForSigning | undefined = undefined;
    let unsignedTokenListData: PrepareDataForSigning | undefined = undefined;
    let permissionPolicyType: PermissionPolicyType;

    let index = 0;

    if (keyType === PermissionPolicyType.SUDO) {
      permissionPolicyType = PermissionPolicyType.SUDO;
      const rootNonceBefore = await getRootCurrentNonce(kernelAddress);
      console.log(`[Installation ${installationId}] Root nonce before install: ${rootNonceBefore}`);

      const { unpacked, packed, userOpHash, permissionId: permId, vId: vid } = await buildInstallPermissionUoUnsigned(
        kernelAddress,
        delegatedEOA as `0x${string}`
      );

      unsignedPermissionPolicyData = { unpacked, packed, userOpHash };

      permissionId = permId;
      vId = vid;
    } else {
      permissionPolicyType = PermissionPolicyType.CALL_POLICY;

      const callPolicyPermissions = callPolicyPermissionsArg ?? [];

      logCallPolicySummary(delegatedEOA, callPolicyPermissions);

      const { unpacked, packed, userOpHash, permissionId: permId, vId: vid } = await buildInstallCallPolicyUoUnsigned(
        kernelAddress,
        delegatedEOA as `0x${string}`,
        callPolicyPermissions
      );
      unsignedPermissionPolicyData = { unpacked, packed, userOpHash };
      
      permissionId = permId;
      vId = vid;
    } 

    index++;


    // grant access to vId
    unsignedGrantAccessData = await buildGrantAccessUoUnsigned(
      kernelAddress,
      vId as `0x${string}`,
      EXECUTE_SELECTOR,
      true,
      index
    );
  
    index++;


    if (keyType === PermissionPolicyType.CALL_POLICY && (tokenLimits.length > 0 || recipients.length > 0)) {
      // Apply token limits and recipient restrictions
      if (recipients.length > 0) {
        const recipientList = recipients;
        const allowedList = recipients.map(() => true);

        unsignedRecipientListData = await buildSetRecipientAllowedUoUnsigned(
          permissionId as `0x${string}`,
          kernelAddress,
          recipientList,
          allowedList,
          index
        );

        index++;
      }


      // Set token limits in batch
      if (tokenLimits.length > 0) {
        const tokens = tokenLimits.map(t => t.token);
        const enabled = tokenLimits.map(t => t.enabled);
        const txLimits = tokenLimits.map(t => t.txLimit);
        const dailyLimits = tokenLimits.map(t => t.dailyLimit);

        unsignedTokenListData = await buildSetTokenLimitUoUnsigned(
          permissionId as `0x${string}`,
          kernelAddress,
          tokens,
          enabled,
          txLimits,
          dailyLimits,
          index
        );

        index++;
      }

      // Best-effort verification and remediation to ensure limits/recipients are actually stored on-chain
      // try {
      //   const currentTokens = await getAllowedTokens(kernelAddress, permissionId as `0x${string}`);
      //   const currentRecipients = await getAllowedRecipients(kernelAddress, permissionId as `0x${string}`);

      //   const missingTokens = tokenLimits.filter(
      //     (tl) => !currentTokens.some((ct) => ct.token.toLowerCase() === tl.token.toLowerCase())
      //   );
      //   const missingRecipients = recipients.filter(
      //     (r) => !currentRecipients.some((cr) => cr.toLowerCase() === r.toLowerCase())
      //   );

      //   if (missingRecipients.length > 0) {
      //     console.log("[CallPolicy] Re-applying missing recipients:", missingRecipients);
      //     const allowedList = missingRecipients.map(() => true);
      //     const { unpacked } = await buildSetRecipientAllowedUoUnsigned(
      //       permissionId as `0x${string}`,
      //       kernelAddress,
      //       missingRecipients,
      //       allowedList
      //     );
      //   }

      //   if (missingTokens.length > 0) {
      //     console.log("[CallPolicy] Re-applying missing token limits:", missingTokens);
      //     const tokens = missingTokens.map((t) => t.token);
      //     const enabled = missingTokens.map((t) => t.enabled);
      //     const txLimits = missingTokens.map((t) => t.txLimit);
      //     const dailyLimits = missingTokens.map((t) => t.dailyLimit);

      //     const { unpacked } = await buildSetTokenLimitUoUnsigned(
      //       permissionId as `0x${string}`,
      //       kernelAddress,
      //       tokens,
      //       enabled,
      //       txLimits,
      //       dailyLimits
      //     );
      //   }

      //   const finalTokens = await getAllowedTokens(kernelAddress, permissionId as `0x${string}`);
      //   const finalRecipients = await getAllowedRecipients(kernelAddress, permissionId as `0x${string}`);
      //   if (recipients.length > 0 && finalRecipients.length === 0) {
      //     throw new Error("CallPolicy recipients not persisted on-chain");
      //   }
      //   if (tokenLimits.length > 0 && finalTokens.length === 0) {
      //     throw new Error("CallPolicy token limits not persisted on-chain");
      //   }
      // } catch (verifyErr) {
      //   console.warn("[CallPolicy] Verification of limits/recipients failed:", verifyErr);
      //   throw verifyErr;
      // }
    }


    console.log(`[Installation ${installationId}] Completed successfully!`);
    console.log(`[Installation ${installationId}] Permission ID:`, permissionId);
    console.log(`[Installation ${installationId}] vId:`, vId);

    return {
      isSuccess: true,
      data: {
        permissionPolicyType,
        unsignedPermissionPolicyData,
        unsignedGrantAccessData,
        unsignedRecipientListData,
        unsignedTokenListData
      },
    };

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

    return {
      isSuccess: false
    };
  }
}
