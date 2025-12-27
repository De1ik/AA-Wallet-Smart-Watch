import { Address } from 'viem';
import { getPimlicoRpc } from '@/config/env';

export const DEFAULT_KERNEL: Address = '0xB115dc375D7Ad88D7c7a2180D0E548Cb5B83D86A';
export const DEFAULT_BUNDLER_RPC_URL =
  getPimlicoRpc() ?? '';

export const MAX_FEE_PER_GAS = 5n * 10n ** 9n; // 5 gwei
export const MAX_PRIORITY_FEE = 1n * 10n ** 9n; // 1 gwei
