import { createPublicClient, http, parseAbi } from "viem"
import { sepolia } from "viem/chains"

const SEPOLIA_RPC_URL = "https://sepolia.infura.io/v3/7df085afafad4becaad36c48fb162932";
export const ENTRY_POINT_V7: `0x${string}` = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";


export const entryPointAbi = parseAbi([
  "function getUserOpHash((address sender,uint256 nonce,bytes initCode,bytes callData,bytes32 accountGasLimits,uint256 preVerificationGas,bytes32 gasFees,bytes paymasterAndData,bytes signature) userOp) view returns (bytes32)",
]);

export const publicClient  = createPublicClient({ chain: sepolia, transport: http(SEPOLIA_RPC_URL) })