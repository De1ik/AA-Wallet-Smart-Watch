import { InstallExecuteInput, InstallExecuteSuccess, PermissionPolicyType } from "../types";
import { InstallationStatus } from "../../../services/websocket";
import { wsService } from "../../..";
import { HttpResult, ok } from "../../apiResponse";
import { debugLog, executeUserOp } from "./helper";
import { debug } from "node:util";
import { buildGrantAccessUoUnsigned } from "../userOps";
import { EXECUTE_SELECTOR } from "../constants";
import { privateKeyToAccount } from "viem/accounts";
import { Hex } from "viem";


// TODO: Catch errors if nonce was not updated after userOp execution
export async function handleExecuteDelegatedKeyCreation(
  input: InstallExecuteInput
): Promise<HttpResult<InstallExecuteSuccess>> {
    debugLog("[/delegated/execute] Received execute request:", input);
    const { data, clientId, kernelAddress, installationId } = input;
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
            progress: 10,
        });

        debugLog(`[Installation ${installationId}] signedPermissionPolicyData`, data.signedPermissionPolicyData.unpacked);
        debugLog(`signedPermissionPolicyData nonce`, parseInt(data.signedPermissionPolicyData.unpacked.nonce, 16) );

        

        const { isUpdated: isUpdatedPermissionInstalled, txHash: txHashPermissionInstalled } = await executeUserOp(data.signedPermissionPolicyData.unpacked, kernelAddress);

        debugLog(`[Installation ${installationId}] Permission policy installed. TxHash: ${txHashPermissionInstalled}, Nonce updated: ${isUpdatedPermissionInstalled}`);

        sendStatus({
            step: "installing",
            message: "Grant access...",
            progress: 40,
        });

        debugLog(`[Installation ${installationId}] signedGrantAccessData`, data.signedGrantAccessData.unpacked);
        debugLog(`signedGrantAccessData nonce`, parseInt(data.signedGrantAccessData.unpacked.nonce, 16) );


        // const unsignedGrantAccessData = await buildGrantAccessUoUnsigned(
        //   kernelAddress,
        //   '0x026f18035d00000000000000000000000000000000',
        //   EXECUTE_SELECTOR,
        //   true,
        // );
        // const rootAccount = privateKeyToAccount("0xac53eeed69c1aa303f184d5581346b0e196ba2216b75d2aabee01e89d9626050")
        // const signature = await rootAccount.signMessage({ message: { raw: unsignedGrantAccessData.userOpHash } }) as Hex;

        // unsignedGrantAccessData.unpacked.signature = signature;


        // debugLog(`[Installation ${installationId}] unsignedGrantAccessData INPLACE CALC`, unsignedGrantAccessData.unpacked);
        // debugLog(`unsignedGrantAccessData nonce`, parseInt(unsignedGrantAccessData.unpacked.nonce, 16) );

        await new Promise(resolve => setTimeout(resolve, 10000));
        const { isUpdated: isUpdatedGrant, txHash: txHashGrant } = await executeUserOp(data.signedGrantAccessData.unpacked, kernelAddress);
        // const { isUpdated: isUpdatedGrant, txHash: txHashGrant } = await executeUserOp(unsignedGrantAccessData.unpacked, kernelAddress);

        debugLog(`[Installation ${installationId}] Grant was installed. TxHash: ${txHashGrant}, Nonce updated: ${isUpdatedGrant}`);


        if (data.permissionPolicyType === PermissionPolicyType.CALL_POLICY) {
          // Install recipient restrictions
          sendStatus({
              step: "installing",
              message: "Recipient restrictions installation...",
              progress: 70,
          });

          debugLog(`[Installation ${installationId}] signedRecipientListData`, data.signedRecipientListData!.unpacked);
          debugLog(`signedRecipientListData nonce`, parseInt(data.signedRecipientListData!.unpacked.nonce, 16) );

          const { isUpdated: isUpdatedRecipientInstall, txHash: txHashRecipientInstall } = await executeUserOp(data.signedRecipientListData!.unpacked, kernelAddress);

          debugLog(`[Installation ${installationId}] Recipient list installed. TxHash: ${txHashRecipientInstall}, Nonce updated: ${isUpdatedRecipientInstall}`);
          
          // Install allowed tokens
          sendStatus({
              step: "installing",
              message: "Install allowed tokens...",
              progress: 85,
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
