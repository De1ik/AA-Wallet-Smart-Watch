import { isAddress, parseAbi, parseEther } from "viem";
import { z } from "zod";

import type { HttpResult, ErrorResponse } from "../../../shared/http/apiResponse";
import { badRequest, internalError, ok } from "../../../shared/http/apiResponse";
import { buildSendRootUoUnsigned, buildSendTokenUoUnsigned } from "../../../utils/native-code";
import { sepoliaClient } from "../../../shared/clients/sepoliaClient";
import type { SendResponse } from "../types";
import { debugLog } from "../../../shared/helpers/helper";
import { sendSchema } from "./schema";


const erc20Abi = parseAbi(["function decimals() view returns (uint8)"]);


export async function handleSend(input: unknown): Promise<HttpResult<SendResponse | ErrorResponse>> {
  try {
    const parsed = sendSchema.safeParse(input);
    if (!parsed.success) {
      return badRequest("Validation error", parsed.error.issues[0].message);
    }

    const { to, amount, tokenAddress, kernelAddress } = parsed.data;

    debugLog(`[Send] Sending ${tokenAddress ? "token" : "ETH"} to ${to}:`, amount);

    let packed, unpacked, userOpHash;

    if (tokenAddress) {
      const decimals = (await sepoliaClient.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "decimals",
      })) as number;

      const amountInWei = BigInt(Math.floor(amount * 10 ** decimals));

      debugLog(`[Send] Building ERC20 transfer: ${amount} * 10^${decimals} = ${amountInWei.toString()}`);

      const result = await buildSendTokenUoUnsigned(
        tokenAddress,
        to,
        amountInWei,
        kernelAddress,
        0
      );
      ({ packed, unpacked, userOpHash } = result);
    } else {
      const amountInWei = parseEther(amount.toString());

      debugLog(`[Send] Building ETH transfer: ${amount} ETH = ${amountInWei.toString()} wei`);

      const result = await buildSendRootUoUnsigned(to, amountInWei, "0x", kernelAddress, 0);
      ({ packed, unpacked, userOpHash } = result);
    }

    return ok({
      success: true,
      data: {
        packed,
        unpacked,
        userOpHash,
      },
      message: tokenAddress ? "Token transfer initiated" : "ETH transfer initiated",
    });
  } catch (err: any) {
    console.error("[/send] error:", err);
    return internalError("Failed to send transaction", err);
  }
}
