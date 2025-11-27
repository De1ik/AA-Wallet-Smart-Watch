import { Address } from "viem";
import { badRequest, HttpResult, internalError, ok, rateLimit } from "../../apiResponse";
import { validateAddress } from "../dataValidation";
import { checkPrefundSafe } from "../helpers";
import { RevokePrepareInput } from "../types";
import { buildUninstallPermissionUoUnsigned } from "../userOps";

export async function handlePrepareDelegatedKeyRevoke(input: RevokePrepareInput): Promise<HttpResult> {
  try {
    const { delegatedEOA, kernelAddress } = input;

    // --- VALIDATION BLOCK ---
    const kernelValidation = validateAddress(kernelAddress);
    if (kernelValidation) return badRequest(kernelValidation);

    const delegatedValidation = validateAddress(delegatedEOA);
    if (delegatedValidation) return badRequest(delegatedValidation);

    console.log(`[revoke] -> Revoking delegated key: ${delegatedEOA}`);

    // --- PREFUND CHECK ---
    const prefund = await checkPrefundSafe(kernelAddress as Address, "[revoke]");
    if (prefund.error) return badRequest(prefund.message);

    // --- BUILD UNSIGNED USER OP WITH RETRIES ---
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
