import { encodeFunctionData, parseAbi } from "viem";

import {
  buildDelegatedSendUO,
  getPermissionId,
  sendUserOpV07,
  UnpackedUserOperationV07,
} from "../../utils/native-code";
import { buildBroadcastErrorResponse, ensureSufficientNativeBalance } from "../../shared/errors/routeErrors";
import { prepareSchema, broadcastSchema, sendUopSchema } from "./schema";

export async function handlePrepare(reqBody: unknown) {
  try {
    const parsed = prepareSchema.safeParse(reqBody);
    if (!parsed.success) {
      return { status: 400, body: { error: parsed.error.issues[0].message } };
    }
    const { to, amountWei, data, delegatedEOA, kernelAddress, tokenAddress } = parsed.data;

    const permissionId = getPermissionId(kernelAddress, delegatedEOA);
    if (!permissionId) {
      return { status: 400, body: { error: "permissionId is required" } };
    }

    const callData = data ?? "0x";
    let targetAddress = to;
    let finalCallData = callData as `0x${string}`;
    let valueToSend = amountWei;

    if (tokenAddress) {
      const erc20Abi = parseAbi(["function transfer(address to, uint256 amount)"]);
      finalCallData = encodeFunctionData({
        abi: erc20Abi,
        functionName: "transfer",
        args: [to, amountWei],
      });
      targetAddress = tokenAddress;
      valueToSend = 0n; // Token transfers should not send native value to the token contract
    }

    const { userOpHash } = await buildDelegatedSendUO(
      kernelAddress,
      permissionId,
      targetAddress,
      valueToSend,
      finalCallData
    );

    return {
      status: 200,
      body: {
        userOpHash,
        echo: { permissionId, to, amountWei: valueToSend.toString(), data: callData, tokenAddress: tokenAddress ?? null },
      },
    };
  } catch (err: any) {
    console.error("[/userOp/prepare] error:", err);
    return { status: 500, body: { error: err?.message ?? "internal error" } };
  }
}

export async function handleBroadcast(reqBody: unknown) {
  let amtWei: bigint | null = null;
  let normalizedKernelAddress: string | null = null;

  try {
    const parsed = broadcastSchema.safeParse(reqBody);
    if (!parsed.success) {
      return { status: 400, body: { error: parsed.error.issues[0].message } };
    }
    const { to, amountWei, data, delegatedEOA, signature, opHash, kernelAddress, tokenAddress } = parsed.data;

    const permissionId = getPermissionId(kernelAddress, delegatedEOA);
    if (!permissionId) {
      return { status: 400, body: { error: "permissionId is required" } };
    }

    amtWei = amountWei;
    const callData = data ?? "0x";

    if (!tokenAddress && normalizedKernelAddress && amtWei > 0n) {
      const { ok, availableWei } = await ensureSufficientNativeBalance(kernelAddress, amtWei);
      if (!ok) {
        return {
          status: 400,
          body: {
            error: "Insufficient balance for this transaction.",
            details: {
              requestedWei: amtWei.toString(),
              availableWei: availableWei.toString(),
            },
          },
        };
      }
    }

    let targetAddress = to;
    let finalCallData = callData as `0x${string}`;
    let valueToSend = amtWei as bigint;

    if (tokenAddress) {
      const erc20Abi = parseAbi(["function transfer(address to, uint256 amount)"]);
      finalCallData = encodeFunctionData({
        abi: erc20Abi,
        functionName: "transfer",
        args: [to, amtWei],
      });
      targetAddress = tokenAddress;
      valueToSend = 0n; // avoid sending native value to ERC20 contracts
    }

    const { unpacked, userOpHash } = await buildDelegatedSendUO(
      kernelAddress,
      permissionId,
      targetAddress,
      valueToSend,
      finalCallData,
      signature as `0x${string}`
    );

    if (userOpHash !== opHash) {
      return { status: 400, body: { error: "userOpHash does not match opHash" } };
    }

    const { txHash } = await sendUserOpV07(unpacked as UnpackedUserOperationV07);
    return { status: 200, body: { txHash } };
  } catch (err: any) {
    console.error("[/userOp/broadcast] error:", err);
    const { status, body } = await buildBroadcastErrorResponse(err, normalizedKernelAddress as any, amtWei);
    return { status, body };
  }
}

export async function handleSendUop(reqBody: unknown) {
  try {
    const parsed = sendUopSchema.safeParse(reqBody);
    if (!parsed.success) {
      return { status: 400, body: { error: parsed.error.issues[0].message } };
    }

    const { signature, unpacked } = parsed.data;

    if (signature !== unpacked?.signature) {
      return { status: 400, body: { error: "signature in unpacked data is not the same" } };
    }

    const { txHash } = await sendUserOpV07(unpacked);

    return { status: 200, body: { txHash } };
  } catch (err: any) {
    return { status: 400, body: { error: "Error during transaction sending" } };
  }
}
