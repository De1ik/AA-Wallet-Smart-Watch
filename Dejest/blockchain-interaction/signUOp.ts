import { loadPrivateKey } from "@/utils/secureStorage"
import { UnpackedUserOperationV07, PackedUserOperation } from "./types" 
import { Address, privateKeyToAccount } from "viem/accounts";
import { Hex } from "viem";
import { publicClient, ENTRY_POINT_V7, entryPointAbi } from "./config";


// validate and sign income user op
export async function validateAndSign(packed: PackedUserOperation, unpacked: UnpackedUserOperationV07, userOpHash: Hex) {
    if (!(await validateUserOperation(packed, userOpHash))) return {}
    return await signUserOperation(packed, unpacked, userOpHash);
}

// compare recalculated UserOpHash and provided
export async function validateUserOperation(packed: PackedUserOperation, userOpHash: Hex) {
    const userOpHashCalculated = await getUserOpStructHash(packed);
    if (userOpHash !== userOpHashCalculated) return false;
    return true;
}

// sign User Op with the root private key
export async function signUserOperation(packed: PackedUserOperation, unpacked: UnpackedUserOperationV07, userOpHash: Hex)  {
    const privateKey = await loadPrivateKey() as Address;
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