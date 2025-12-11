import { Address, http, parseAbi, parseEther } from "viem";

import { getCurrentGasPrices, getOptimizedGasLimits } from "../../utils/native-code";
import { ENTRY_POINT } from "../../shared/constants/constants";
import { sepoliaClient } from "../../shared/clients/sepoliaClient";

export interface PrefundStatus {
  hasPrefund: boolean;
  message: string;
  depositWei: string;
  requiredPrefundWei: string;
  shortfallWei: string;
  kernelAddress: string;
  entryPointAddress: string;
}

const entryPointAbi = parseAbi(["function balanceOf(address account) view returns (uint256)"]);

// Check prefund for the given kernel address
export async function checkPrefundSimple(kernelAddress: Address): Promise<PrefundStatus> {
  try {

    // Fetch deposit from EntryPoint contract
    const deposit = (await sepoliaClient.readContract({
      address: ENTRY_POINT,
      abi: entryPointAbi,
      functionName: "balanceOf",
      args: [kernelAddress],
    })) as bigint;

    console.log(`[Prefund Check] Kernel deposit: ${deposit.toString()} wei`);

    // Calculate required prefund
    const { maxFeePerGas } = await getCurrentGasPrices();
    const { verificationGasLimit, callGasLimit, preVerificationGas } = getOptimizedGasLimits("install");

    const requiredPrefund = (preVerificationGas + verificationGasLimit + callGasLimit) * maxFeePerGas;
    const minRequiredPrefund = parseEther("0.001");
    const finalRequiredPrefund = requiredPrefund > minRequiredPrefund ? requiredPrefund : minRequiredPrefund;

    console.log(
      `[Prefund Check] Required prefund: ${finalRequiredPrefund.toString()} wei (${
        Number(finalRequiredPrefund) / 1e18
      } ETH)`
    );

    const depositStr = deposit.toString();
    const requiredStr = finalRequiredPrefund.toString();
    const shortfall = deposit >= finalRequiredPrefund ? 0n : finalRequiredPrefund - deposit;
    const shortfallStr = shortfall.toString();

    if (deposit >= finalRequiredPrefund) {
      return {
        hasPrefund: true,
        message: "Sufficient prefund available",
        depositWei: depositStr,
        requiredPrefundWei: requiredStr,
        shortfallWei: shortfallStr,
        kernelAddress,
        entryPointAddress: ENTRY_POINT,
      };
    }

    return {
      hasPrefund: false,
      message: `Insufficient prefund: Account has ${depositStr} wei but needs at least ${requiredStr} wei deposited in EntryPoint. Shortfall: ${shortfallStr} wei`,
      depositWei: depositStr,
      requiredPrefundWei: requiredStr,
      shortfallWei: shortfallStr,
      kernelAddress,
      entryPointAddress: ENTRY_POINT,
    };
  } catch (error: any) {
    console.error(`[Prefund Check] Error:`, error);
    return {
      hasPrefund: false,
      message: `Prefund check failed: ${error.message}`,
      depositWei: "0",
      requiredPrefundWei: "0",
      shortfallWei: "0",
      kernelAddress,
      entryPointAddress: ENTRY_POINT,
    };
  }
}
