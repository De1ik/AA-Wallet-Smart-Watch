import type { Hex } from "viem";
import { sepolia } from "viem/chains";

// // Kernel v3.3 addresses (provided)
// export const KERNEL_FACTORY_V33: Hex = "0x2577507b78c2008Ff367261CB6285d44ba5eF2E9";
// export const KERNEL_IMPLEMENTATION: Hex = "0xd6CEDDe84be40893d153Be9d467CD6aD37875b28";
// export const ECDSA_VALIDATOR_V33: Hex = "0xd703aaE79538628d27099B8c4f621bE4CCd142d5";
// export const ENTRY_POINT: Hex = "0x0000000071727de22e5e9db8af0edac6f37da032";

// // ZeroDev Project ID
// const ZERODEV_PROJECT_ID = "230f95ae-5463-4783-a0f0-d907619f9bee";

// // ZeroDev использует единый endpoint для bundler и paymaster
// // В v3 они объединили все в один URL: /api/v3/{projectId}/chain/{chainId}
// export const ZERODEV_RPC_URL = 
//   `https://rpc.zerodev.app/api/v3/${ZERODEV_PROJECT_ID}/chain/11155111`;

// // Для удобства создадим алиасы
// export const ZERODEV_BUNDLER_URL = ZERODEV_RPC_URL;
// export const ZERODEV_PAYMASTER_URL = ZERODEV_RPC_URL;

// export const CHAIN = sepolia;
// export const CHAIN_ID = BigInt(11155111);

// // Public RPC for readContract (avoid bundler endpoint issues)
// export const PUBLIC_RPC_URL = "https://sepolia.infura.io/v3/7df085afafad4becaad36c48fb162932";


export const ZERO_DEV_RPC = 'https://rpc.zerodev.app/api/v3/230f95ae-5463-4783-a0f0-d907619f9bee/chain/11155111';

