import { Address } from "viem";
import { RevokeExecuteSuccess } from "../../../utils/native/types";
import { badRequest, ErrorResponse, HttpResult, ok } from "../../../shared/http/apiResponse";
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

        const { data, kernelAddress } = parsed.data;

        // send user operation 
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
