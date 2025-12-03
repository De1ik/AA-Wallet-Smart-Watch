import { Address } from "viem";
import { sepolia } from "viem/chains";

// RPC URLs
export const ZERO_DEV_RPC = `https://rpc.zerodev.app/api/v3/${process.env.ZERODEV_API_KEY}/chain/11155111`;
export const BUNDLER_RPC_URL = `https://api.pimlico.io/v2/11155111/rpc?apikey=${process.env.PIMLICIO_API_KEY}`;
export const ETH_RPC_URL = `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`;

// Network
export const CHAIN_ID = 11155111; // Sepolia Testnet
export const NETWORK = sepolia;

// Kernel account required cotracts
export const FACTORY: Address = "0x2577507b78c2008Ff367261CB6285d44ba5eF2E9";
export const VALIDATOR: Address = "0x845ADb2C711129d4f3966735eD98a9F09fC4cE57";
export const ENTRY_POINT: Address = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
export const ECDSA_SIGNER: Address = "0x6A6F069E2a08c2468e7724Ab3250CdBFBA14D4FF";
export const SUDO_POLICY: Address = "0x67b436caD8a6D025DF6C82C5BB43fbF11fC5B9B7";
export const CALL_POLICY: Address = "0x632b00A0B72C6929694C40A59a64D37EBA80FeAf"; 
export const HOOK_SENTINEL: Address = "0x0000000000000000000000000000000000000001";


// Gas fee constants
export const FEE_MULTIPLIER = 12n;
export const MIN_FEE_PER_GAS = 1n * 10n ** 9n;
export const MAX_FEE_PER_GAS_LIMIT = 200n * 10n ** 9n;
export const MIN_PRIORITY_FEE = 1n * 10n ** 8n;
export const MAX_PRIORITY_FEE_LIMIT = 20n * 10n ** 9n;
export const FALLBACK_MAX_FEE_PER_GAS = 5n * 10n ** 9n; // 5 gwei fallback
export const FALLBACK_MAX_PRIORITY_FEE = 1n * 10n ** 9n; // 1 gwei fallback




// Constant for the execute function selector (defined by kernel contract)
export const EXECUTE_SELECTOR = "0xe9ae5c53" as Address;

// supported selector for policy installation
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




// mocked token info
export const TOKEN_METADATA = [
  {
    address: "0x0000000000000000000000000000000000000000" as Address,
    symbol: "ETH",
    name: "Ether",
    decimals: 18,
    color: "#627EEA",
  },
  {
    address: "0xff34b3d4aee8ddcd6f9afffb6fe49bd371b8a357" as Address,
    symbol: "DAI",
    name: "Dai Stablecoin",
    decimals: 18,
    color: "#F5AC37",
  },
  {
    address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984" as Address,
    symbol: "UNI",
    name: "Uniswap",
    decimals: 18,
    color: "#FF007A",
  },
  {
    address: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14" as Address,
    symbol: "WETH",
    name: "Wrapped Ether",
    decimals: 18,
    color: "#627EEA",
  },
  {
    address: "0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0" as Address,
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    color: "#26a17b",
  },
  {
    address: "0x94a9d9ac8a22534e3faca9f4e7f2e2cf85d5e4c8" as Address,
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    color: "#2775CA",
  },
];

export const KNOWN_TOKEN_DECIMALS: Record<string, number> = {
  "0x0000000000000000000000000000000000000000": 18, // native
  "0xff34b3d4aee8ddcd6f9afffb6fe49bd371b8a357": 18, // DAI
  "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984": 18, // UNI
  "0xfff9976782d46cc05630d1f6ebab18b2324d6b14": 18, // WETH
  "0xaa8e23fb1079ea71e0a56f48a2aa51851d8433d0": 6,  // USDT
  "0x94a9d9ac8a22534e3faca9f4e7f2e2cf85d5e4c8": 6,  // USDC
};

