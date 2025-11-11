import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";

export const DEFAULT_KERNEL_ADDRESS = "0xB115dc375D7Ad88D7c7a2180D0E548Cb5B83D86A";
export const DEFAULT_ENTRY_POINT_ADDRESS = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

export const KERNEL_ADDRESS = (process.env.KERNEL ?? DEFAULT_KERNEL_ADDRESS) as `0x${string}`;
export const ENTRY_POINT_ADDRESS = (process.env.ENTRY_POINT ?? DEFAULT_ENTRY_POINT_ADDRESS) as `0x${string}`;
export const ETH_RPC_URL =
  process.env.ETH_RPC_URL ?? "https://sepolia.infura.io/v3/7df085afafad4becaad36c48fb162932";

export const sepoliaClient = createPublicClient({
  chain: sepolia,
  transport: http(ETH_RPC_URL),
});
