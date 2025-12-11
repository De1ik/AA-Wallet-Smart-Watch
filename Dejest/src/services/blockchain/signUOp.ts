import { loadPrivateKey } from "@/services/storage/secureStorage"
import { UnpackedUserOperationV07, PackedUserOperation } from "./types" 
import { Address, privateKeyToAccount } from "viem/accounts";
import { Hex } from "viem";
import { publicClient, ENTRY_POINT_V7, entryPointAbi } from "./config";
import { debugLog } from "@/services/api/helpers";


// validate and sign income user op
export async function validateAndSign(packed: PackedUserOperation, unpacked: UnpackedUserOperationV07, userOpHash: Hex): Promise<{unpacked: UnpackedUserOperationV07; signature: string} | undefined> {
    if (!(await validateUserOperation(packed, userOpHash))) return undefined
    return await signUserOperation(packed, unpacked, userOpHash);
}

// compare recalculated UserOpHash and provided
export async function validateUserOperation(packed: PackedUserOperation, userOpHash: Hex) {
    const userOpHashCalculated = await getUserOpStructHash(packed);
    debugLog("Provided userOpHash: ", userOpHash);
    debugLog("Calculated userOpHash: ", userOpHashCalculated);
    if (userOpHash !== userOpHashCalculated) return false;
    return true;
}

// sign User Op with the root private key
export async function signUserOperation(packed: PackedUserOperation, unpacked: UnpackedUserOperationV07, userOpHash: Hex)  {
    const privateKey = await loadPrivateKey() as Address;
    debugLog("Loaded private key for signing:", privateKey);
    if (!privateKey) throw new Error()
    const rootAccount = privateKeyToAccount(privateKey);

    const signature = await rootAccount.signMessage({ message: { raw: userOpHash } }) as Hex;
    unpacked.signature = signature;

    return {unpacked, signature}
}


// recalculate the userOpHash based on the income packed data 
export async function getUserOpStructHash(packed: PackedUserOperation) {
    const userOpHash = (await publicClient.readContract({
        address: ENTRY_POINT_V7,
        abi: entryPointAbi,
        functionName: "getUserOpHash",
        args: [packed],
    })) as Hex;

    return userOpHash;
}


// helper for processing unsigned data for delegate installation
export async function processUnsigned(block: any, name: string): Promise<{unpacked: UnpackedUserOperationV07; signature: string} | undefined>  {
    if (!block) {
        throw new Error(`${name} is missing`);
    }

    // Some responses wrap the payload under .data
    const payload = block?.packed ? block : block?.data;
    if (!payload?.packed || !payload?.unpacked || !payload?.userOpHash) {
        throw new Error(`${name} is malformed`);
    }

    const normalizedPacked: PackedUserOperation = {
        ...payload.packed,
        // Convert numeric strings coming from JSON back to bigint
        nonce: typeof payload.packed.nonce === "string" ? BigInt(payload.packed.nonce) : payload.packed.nonce,
        preVerificationGas:
            typeof payload.packed.preVerificationGas === "string"
                ? BigInt(payload.packed.preVerificationGas)
                : payload.packed.preVerificationGas,
    };

    return await validateAndSign(normalizedPacked, payload.unpacked, payload.userOpHash);
};
