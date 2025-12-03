import { createPublicClient, http } from "viem";
import { ETH_RPC_URL, NETWORK, ZERO_DEV_RPC } from "../constants/constants";


export const sepoliaClient = createPublicClient({
  chain: NETWORK,
  transport: http(ETH_RPC_URL),
});

export const publicClient = createPublicClient({ 
    chain: NETWORK, 
    transport: http(ETH_RPC_URL) });

export const bundlerClient = createPublicClient({ 
    transport: http(ZERO_DEV_RPC) 
});
