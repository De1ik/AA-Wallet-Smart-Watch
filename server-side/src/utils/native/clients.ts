import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";

import { BUNDLER_RPC_URL, ETH_RPC_URL, ZERO_DEV_RPC } from "./constants";

export const publicClient = createPublicClient({ chain: sepolia, transport: http(ETH_RPC_URL) });
export const bundlerClient = createPublicClient({ transport: http(ZERO_DEV_RPC) });
