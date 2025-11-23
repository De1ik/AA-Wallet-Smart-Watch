import { Address, Hex, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export const FACTORY: `0x${string}` = "0x2577507b78c2008Ff367261CB6285d44ba5eF2E9";
export const VALIDATOR: `0x${string}` = "0x845ADb2C711129d4f3966735eD98a9F09fC4cE57";
export const ENTRY_POINT_V7: `0x${string}` = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

const DEFAULT_KERNEL: Address = "0xB115dc375D7Ad88D7c7a2180D0E548Cb5B83D86A";

export const ENTRY_POINT: Address = (process.env.ENTRY_POINT ?? ENTRY_POINT_V7) as Address;
export const KERNEL: Address = (process.env.KERNEL ?? DEFAULT_KERNEL) as Address;

export const BUNDLER_RPC_URL = "https://api.pimlico.io/v2/11155111/rpc?apikey=pim_TSXZcxdAYixqPvzchXp64f";
export const ETH_RPC_URL = "https://sepolia.infura.io/v3/7df085afafad4becaad36c48fb162932";

export const ROOT_PRIV = process.env.PRIVATE_KEY ?? "0x5b90e4bb58e7731445eb523f9409e4b47f29f5356cf7df6873559623e60761e0";
export const DELEGATED_PK =
  process.env.DELEGATED_PRIVATE_KEY ?? "0xeb020020f40c89748cfbcd6f455d3251ee5aa201237553c31bc7353a8b6dadfa";

export const delegated = privateKeyToAccount(DELEGATED_PK as Hex);
export const root = privateKeyToAccount(ROOT_PRIV as Hex);

export const ECDSA_SIGNER: Address = "0x6A6F069E2a08c2468e7724Ab3250CdBFBA14D4FF";
export const SUDO_POLICY: Address = "0x67b436caD8a6D025DF6C82C5BB43fbF11fC5B9B7";
// export const CALL_POLICY: Address = "0x715694426fA58D76EC00CB803af84ff6D6Cbe415"; // CallPolicy_v1
// export const CALL_POLICY: Address = "0x493270eDC9b725B1519Ccc52E9347ea2dcA9D0Bf"; // CallPolicy_v2_old
// export const CALL_POLICY: Address = "0x64bc09827E93cE6C7Ed353f2B48c81d7CeaCF805"; // CallPolicy_v2
export const CALL_POLICY: Address = "0x37e90150a6d663b75632E85e7b9Ea6C5895685Ec"; // CallPolicy_v3

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
