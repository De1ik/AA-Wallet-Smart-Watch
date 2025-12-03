import { Address } from "viem";
import { badRequest, ErrorResponse, HttpResult, ok } from "../../../shared/http/apiResponse";
import { checkPrefundSafe } from "../../../utils/native/helpers";
import { RevokePrepareSuccess } from "../../../utils/native/types";
import { buildUninstallPermissionUoUnsigned } from "../../../utils/native/userOps";
import { revokePrepareSchema } from "../schema";
import { debugLog } from "../../../shared/helpers/helper";

export async function handlePrepareDelegatedKeyRevoke(input: unknown): Promise<HttpResult<RevokePrepareSuccess | ErrorResponse>> {
  try {

    // validate input
    const parsed = revokePrepareSchema.safeParse(input);
    if (!parsed.success) {
      return badRequest("Validation error", parsed.error.issues[0].message);
    }

    const { delegatedEOA, kernelAddress } = parsed.data;

    debugLog(`[revoke] -> Revoking delegated key: ${delegatedEOA}`);

    // check prefund
    const prefund = await checkPrefundSafe(kernelAddress as Address, "[revoke]");
    if (prefund.error) return badRequest(prefund.message);

    // build data for signing
    const result = await buildUninstallPermissionUoUnsigned(kernelAddress as Address, delegatedEOA as Address);

    return ok({
      success: true,
      data: result,
      message: "Data for signing to revoke delegated key prepared successfully",
    });
  } catch (err: any) {
    return ok({
      success: false,
      message: "Data for signing to revoke delegated key preparation failed",
      error: err.message,
    });
  }
}
