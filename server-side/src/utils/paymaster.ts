// import { PackedUserOperation } from "viem/_types/account-abstraction";
import { ENTRY_POINT, ZERO_DEV_RPC } from "../shared/constants/constants";
import { debugLog } from "../shared/helpers/helper";

import { createPaymasterClient } from 'viem/account-abstraction'
import { http } from "viem";
import { sepolia } from "viem/chains";
import { PackedUserOperation, UnpackedUserOperationV07 } from "./native-code";




export async function applyZeroDevPaymaster(unpacked: UnpackedUserOperationV07) {
    const paymasterClient = createPaymasterClient({ 
        name: "dejest",
        transport: http(ZERO_DEV_RPC), 
    });

    const uoForPaymaster = {
        callData: unpacked.callData,
        callGasLimit: BigInt(unpacked.callGasLimit),
        factory: undefined,
        factoryData: undefined,
        maxPriorityFeePerGas: BigInt(unpacked.maxPriorityFeePerGas),
        maxFeePerGas: BigInt(unpacked.maxFeePerGas),
        nonce: BigInt(unpacked.nonce),                  // from "0x156" -> 342n
        sender: unpacked.sender,
        preVerificationGas: BigInt(unpacked.preVerificationGas),
        verificationGasLimit: BigInt(unpacked.verificationGasLimit),
        paymasterPostOpGasLimit: undefined,
        paymasterVerificationGasLimit: undefined,
    };

    const paymasterData = await paymasterClient.getPaymasterData({
        ...uoForPaymaster,
        chainId: sepolia.id,
        entryPointAddress: ENTRY_POINT,
    });



    debugLog("[Paymaster] Sponsorship successful:", paymasterData);

    const sponsor = paymasterData;

    return sponsor;

//   return {
//     ...userOp,
//     paymasterAndData: sponsor.paymasterAndData,
//     preVerificationGas: sponsor.preVerificationGas ?? userOp.preVerificationGas,
//     verificationGasLimit: sponsor.verificationGasLimit ?? decodeVerGas(userOp.accountGasLimits),
//     callGasLimit: sponsor.callGasLimit ?? decodeCallGas(userOp.accountGasLimits),
//   };
}
