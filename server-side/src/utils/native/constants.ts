import { Address, Hex, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export const FACTORY: `0x${string}` = "0x2577507b78c2008Ff367261CB6285d44ba5eF2E9";
export const VALIDATOR: `0x${string}` = "0x845ADb2C711129d4f3966735eD98a9F09fC4cE57";
export const ENTRY_POINT_V7: `0x${string}` = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";


export const ENTRY_POINT: Address = (process.env.ENTRY_POINT ?? ENTRY_POINT_V7) as Address;

export const ZERO_DEV_RPC = 'https://rpc.zerodev.app/api/v3/230f95ae-5463-4783-a0f0-d907619f9bee/chain/11155111';

export const BUNDLER_RPC_URL = "https://api.pimlico.io/v2/11155111/rpc?apikey=pim_TSXZcxdAYixqPvzchXp64f";
export const ETH_RPC_URL = "https://sepolia.infura.io/v3/7df085afafad4becaad36c48fb162932";

export const ECDSA_SIGNER: Address = "0x6A6F069E2a08c2468e7724Ab3250CdBFBA14D4FF";
export const SUDO_POLICY: Address = "0x67b436caD8a6D025DF6C82C5BB43fbF11fC5B9B7";
// export const CALL_POLICY: Address = "0x715694426fA58D76EC00CB803af84ff6D6Cbe415"; // CallPolicy_v1
// export const CALL_POLICY: Address = "0x493270eDC9b725B1519Ccc52E9347ea2dcA9D0Bf"; // CallPolicy_v2_old
// export const CALL_POLICY: Address = "0x64bc09827E93cE6C7Ed353f2B48c81d7CeaCF805"; // CallPolicy_v2
// export const CALL_POLICY: Address = "0x37e90150a6d663b75632E85e7b9Ea6C5895685Ec"; // CallPolicy_v3
export const CALL_POLICY: Address = "0x632b00A0B72C6929694C40A59a64D37EBA80FeAf"; // CallPolicy_v3

export const HOOK_SENTINEL: Address = "0x0000000000000000000000000000000000000001";

export const FALLBACK_MAX_FEE_PER_GAS = 5n * 10n ** 9n; // 5 gwei fallback
export const FALLBACK_MAX_PRIORITY_FEE = 1n * 10n ** 9n; // 1 gwei fallback
export const DEPOSIT_AMOUNT = parseEther("0.003");

export const FEE_MULTIPLIER = 12n;
export const MIN_FEE_PER_GAS = 1n * 10n ** 9n;
export const MAX_FEE_PER_GAS_LIMIT = 200n * 10n ** 9n;
export const MIN_PRIORITY_FEE = 1n * 10n ** 8n;
export const MAX_PRIORITY_FEE_LIMIT = 20n * 10n ** 9n;

export const TARGET: Address = "0xe069d36Fe1f7B41c7B8D4d453d99D4D86d620c15";
export const TARGET_AMOUNT = parseEther("0.00001");
export const TARGET_DATA: Hex = "0x";


export const KNOWN_TOKEN_DECIMALS: Record<string, number> = {
  "0x0000000000000000000000000000000000000000": 18, // native
  "0xff34b3d4aee8ddcd6f9afffb6fe49bd371b8a357": 18, // DAI
  "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984": 18, // UNI
  "0xfff9976782d46cc05630d1f6ebab18b2324d6b14": 18, // WETH
  "0xaa8e23fb1079ea71e0a56f48a2aa51851d8433d0": 6,  // USDT
  "0x94a9d9ac8a22534e3faca9f4e7f2e2cf85d5e4c8": 6,  // USDC
};


// Constant for the execute function selector (defined by kernel contract)
export const EXECUTE_SELECTOR = "0xe9ae5c53" as `0x${string}`;

export const SELECTOR_NAMES: Record<string, string> = {
  "0x00000000": "ETH Transfer",
  "0xa9059cbb": "Transfer",
  "0x095ea7b3": "Approve",
  "0x23b872dd": "Transfer From",
  "0x38ed1739": "Swap",
  "0xa694fc3a": "Stake",
  "0x2e17de78": "Unstake",
  "0x379607f5": "Claim Rewards",
  "0x47e7ef24": "Deposit",
  "0x2e1a7d4d": "Withdraw",
};
