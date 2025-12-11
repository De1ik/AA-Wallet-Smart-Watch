import { Address } from "viem";
import { badRequest, ErrorResponse, HttpResult, internalError, ok } from "../../../shared/http/apiResponse";
import { checkPrefundSafe, generateInstallationId } from "../../../utils/native/helpers";
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
    const revocationId = generateInstallationId();

    debugLog(`[revoke] -> Revoking delegated key: ${delegatedEOA}`);

    // check prefund
    const prefund = await checkPrefundSafe(kernelAddress as Address, revocationId);
    if (prefund.error) return badRequest(prefund.message);

    // build data for signing
    const { estimatedCostWei, ...prepareData } = await buildUninstallPermissionUoUnsigned(
      kernelAddress as Address,
      delegatedEOA as Address
    );

    const data = {
      ...prepareData,
      estimatedFeeWei: estimatedCostWei?.toString(),
    };

    return ok({
      success: true,
      revocationId,
      data,
      estimatedFeeWei: estimatedCostWei?.toString(),
      message: "Data for signing to revoke delegated key prepared successfully",
    });
  } catch (err: any) {
    return internalError("Failed to prepare delegated key revocation", err);
  }
}
