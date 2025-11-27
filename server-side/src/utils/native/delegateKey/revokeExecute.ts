import { Address } from "viem";
import { CallPolicyPermission, ExecuteDelegateInstallation, NormalizedTokenLimit, PermissionPolicyType, RevokeExecuteInput, SignedDataForDelegateInstallation, UnpackedUserOperationV07 } from "../types";
import { InstallationStatus } from "../../../services/websocket";
import { wsService } from "../../..";
import { getRootCurrentNonce, sendUserOpV07 } from "../userOps";
import { HttpResult, ok } from "../../apiResponse";
import { executeUserOp } from "./helper";
import { validateAddress } from "../dataValidation";


export async function handleExecuteDelegatedKeyRevoke(
  input: RevokeExecuteInput,
): Promise<HttpResult> {
    try {
        const { data, kernelAddress } = input;

        const isValid = validateAddress(kernelAddress);
        if (!isValid) {
            console.error(`[revoke] Invalid kernel address: ${kernelAddress}`);
            return ok({
                success: false,
                message: "Installation failed",
            });
        }

        const { isUpdated, txHash } = await executeUserOp(data.unpacked, kernelAddress as Address);

        return ok({
            success: true,
            data: txHash,
            message: "Data for signing to revoke delegated key prepared successfully",
        });
    } catch (err: any) {
        return ok({
            success: false,
            message: "Installation failed",
        });
    }

}
