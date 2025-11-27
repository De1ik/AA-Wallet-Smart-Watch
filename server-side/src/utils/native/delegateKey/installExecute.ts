import { Address } from "viem";
import { ExecuteDelegateInstallation, PermissionPolicyType, UnpackedUserOperationV07 } from "../types";
import { InstallationStatus } from "../../../services/websocket";
import { wsService } from "../../..";
import { getRootCurrentNonce, sendUserOpV07 } from "../userOps";
import { HttpResult, ok } from "../../apiResponse";
import { executeUserOp } from "./helper";


// TODO: Catch errors if nonce was not updated after userOp execution
export async function handleExecuteDelegatedKeyCreation(
    input : { 
        data: ExecuteDelegateInstallation,
        clientId: string,
        kernelAddress: Address,
        installationId: string,
    }
): Promise<HttpResult> {

    const { data, clientId, kernelAddress, installationId } = input;

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
            progress: 10,
        });

        const { isUpdated: isUpdatedPermissionInstalled, txHash: txHashPermissionInstalled } = await executeUserOp(data.signedPermissionPolicyData.unpacked, kernelAddress);

        sendStatus({
            step: "installing",
            message: "Grant access...",
            progress: 40,
        });

        const { isUpdated: isUpdatedGrant, txHash: txHashGrant } = await executeUserOp(data.signedGrantAccessData.unpacked, kernelAddress);

        if (data.permissionPolicyType === PermissionPolicyType.CALL_POLICY) {
        sendStatus({
            step: "installing",
            message: "Install allowed tokens...",
            progress: 60,
        });

        const { isUpdated: isUpdatedTokenInstall, txHash: txHashTokenInstall } = await executeUserOp(data.signedTokenListData!.unpacked, kernelAddress);

        sendStatus({
            step: "installing",
            message: "Recipient restrictions installation...",
            progress: 100,
        });

        const { isUpdated: isUpdatedRecipientInstall, txHash: txHashRecipientInstall } = await executeUserOp(data.signedRecipientListData!.unpacked, kernelAddress);
        }

        sendStatus({
            step: "completed",
            message: `${data.permissionPolicyType} delegated key created successfully!`,
            progress: 100,
        });

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
