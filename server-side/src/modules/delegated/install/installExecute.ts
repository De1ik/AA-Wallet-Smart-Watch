import { InstallExecuteInput, InstallExecuteSuccess, PermissionPolicyType } from "../../../utils/native/types";
import { InstallationStatus } from "../../../services/websocket";
import { wsService } from "../../..";
import { ErrorResponse, HttpResult, ok } from "../../../shared/http/apiResponse";
import { executeUserOp } from "../helper";
import { installExecuteSchema } from "../schema";
import { badRequest } from "../../../shared/http/apiResponse";
import { debugLog } from "../../../shared/helpers/helper";


// TODO: Catch errors if nonce was not updated after userOp execution
export async function handleExecuteDelegatedKeyCreation(
  input: unknown
): Promise<HttpResult<InstallExecuteSuccess | ErrorResponse>> {
    const parsed = installExecuteSchema.safeParse(input);
    if (!parsed.success) {
      return badRequest("Validation error", parsed.error.issues[0].message);
    }

    const { data, clientId, kernelAddress, installationId } = parsed.data;
    debugLog("[/delegated/execute] Received execute request:", parsed.data);
    debugLog(`[Installation ${installationId}] Starting delegated key installation with data:`, data);


    const sendStatus = (status: InstallationStatus) => {
        console.log(`[Installation ${installationId}] Status:`, status);
        if (clientId) {
            wsService.broadcastToClient(clientId, status);
        } 
    };

    try {
        sendStatus({
            step: "installing",
            message: "Installing permission...",
            progress: 0,
        });

        debugLog(`[Installation ${installationId}] signedPermissionPolicyData`, data.signedPermissionPolicyData.unpacked);
        debugLog(`signedPermissionPolicyData nonce`, parseInt(data.signedPermissionPolicyData.unpacked.nonce, 16) );

        

        const { isUpdated: isUpdatedPermissionInstalled, txHash: txHashPermissionInstalled } = await executeUserOp(data.signedPermissionPolicyData.unpacked, kernelAddress);

        debugLog(`[Installation ${installationId}] Permission policy installed. TxHash: ${txHashPermissionInstalled}, Nonce updated: ${isUpdatedPermissionInstalled}`);

        sendStatus({
            step: "installing",
            message: "Grant access...",
            progress: 25,
        });

        debugLog(`[Installation ${installationId}] signedGrantAccessData`, data.signedGrantAccessData.unpacked);
        debugLog(`signedGrantAccessData nonce`, parseInt(data.signedGrantAccessData.unpacked.nonce, 16) );

        await new Promise(resolve => setTimeout(resolve, 10000));
        const { isUpdated: isUpdatedGrant, txHash: txHashGrant } = await executeUserOp(data.signedGrantAccessData.unpacked, kernelAddress);
        // const { isUpdated: isUpdatedGrant, txHash: txHashGrant } = await executeUserOp(unsignedGrantAccessData.unpacked, kernelAddress);

        debugLog(`[Installation ${installationId}] Grant was installed. TxHash: ${txHashGrant}, Nonce updated: ${isUpdatedGrant}`);


        if (data.permissionPolicyType === PermissionPolicyType.CALL_POLICY) {
          // Install recipient restrictions
          sendStatus({
              step: "installing",
              message: "Recipient restrictions installation...",
              progress: 50,
          });

          debugLog(`[Installation ${installationId}] signedRecipientListData`, data.signedRecipientListData!.unpacked);
          debugLog(`signedRecipientListData nonce`, parseInt(data.signedRecipientListData!.unpacked.nonce, 16) );

          const { isUpdated: isUpdatedRecipientInstall, txHash: txHashRecipientInstall } = await executeUserOp(data.signedRecipientListData!.unpacked, kernelAddress);

          debugLog(`[Installation ${installationId}] Recipient list installed. TxHash: ${txHashRecipientInstall}, Nonce updated: ${isUpdatedRecipientInstall}`);
          
          // Install allowed tokens
          sendStatus({
              step: "installing",
              message: "Install allowed tokens...",
              progress: 75,
          });

          debugLog(`[Installation ${installationId}] signedTokenListData`, data.signedTokenListData!.unpacked);
          debugLog(`signedTokenListData nonce`, parseInt(data.signedTokenListData!.unpacked.nonce, 16) );

          const { isUpdated: isUpdatedTokenInstall, txHash: txHashTokenInstall } = await executeUserOp(data.signedTokenListData!.unpacked, kernelAddress);

          debugLog(`[Installation ${installationId}] Token list installed. TxHash: ${txHashTokenInstall}, Nonce updated: ${isUpdatedTokenInstall}`);
        }

        sendStatus({
            step: "completed",
            message: `${data.permissionPolicyType} delegated key created successfully!`,
            progress: 100,
        });

        debugLog(`[Installation ${installationId}] Delegated key installation completed successfully.`);

        return ok({
            success: true,
            installationId,
            message: "Installation started",
        });
    

    } catch (error: any) {
        console.error(`[Installation ${installationId}] Error:`, error);

        const { userMessage, errorMessage } = await getInstallationErrorMessage(error);

        sendStatus({
            step: "failed",
            message: userMessage,
            progress: 0,
            error: errorMessage,
        });

        return ok({
            success: false,
            installationId,
            message: "Installation failed",
        });
    }
}





async function getInstallationErrorMessage(error: any): Promise<{ userMessage: string; errorMessage: string }> {
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

    return { userMessage, errorMessage };
  }
