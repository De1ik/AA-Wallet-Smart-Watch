import { Address } from "viem";
import { RevokeExecuteSuccess } from "../../../utils/native/types";
import { badRequest, ErrorResponse, HttpResult, internalError, ok } from "../../../shared/http/apiResponse";
import { executeUserOp } from "../helper";
import { revokeExecuteSchema } from "../schema";


export async function handleExecuteDelegatedKeyRevoke(
  input: unknown,
): Promise<HttpResult<RevokeExecuteSuccess | ErrorResponse>> {
    try {

        // validate input
        const parsed = revokeExecuteSchema.safeParse(input);
        if (!parsed.success) {
            return badRequest("Validation error", parsed.error.issues[0].message);
        }

        const { data, kernelAddress, revocationId } = parsed.data;
        const signedRevokeData = data?.signedRevokeData;
        if (!signedRevokeData) {
            return badRequest("signedRevokeData is required");
        }

        // send user operation 
        const { txHash } = await executeUserOp(signedRevokeData.unpacked, kernelAddress as Address);

        return ok({
            success: true,
            revocationId,
            txHash,
            message: "Delegated key revoked successfully",
        });
    } catch (err: any) {
        return internalError("Failed to execute delegated key revocation", err);
    }

}
