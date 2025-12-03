import type { HttpResult, ErrorResponse } from "../../../shared/http/apiResponse";
import { badRequest, internalError, ok } from "../../../shared/http/apiResponse";
import { fetchAllTokenBalances } from "../../../utils/native/balances";
import { debugLog } from "../../../shared/helpers/helper";
import type { BalancesResponse } from "../types";
import { balancesSchema } from "./schema";

export async function handleGetBalances(
  query: unknown
): Promise<HttpResult<BalancesResponse | ErrorResponse>> {
  try {
    const parsed = balancesSchema.safeParse(query);

    if (!parsed.success) {
      return badRequest("Validation error", parsed.error.issues[0].message);
    }

    const { address } = parsed.data;

    debugLog(`[Balance] Fetching balances for address: ${address}`);

    const balances = await fetchAllTokenBalances(address);

    debugLog(`[Balance] Found ${balances.tokens.length} tokens with non-zero balance`);

    return ok({
      success: true,
      ethBalance: balances.ethBalance,
      tokens: balances.tokens,
      message: `Found ${balances.tokens.length} tokens with balance`,
    });
  } catch (err: any) {
    console.error("[/balances] error:", err);
    return internalError("Failed to fetch balances", err);
  }
}
