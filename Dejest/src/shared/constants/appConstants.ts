import { PredefinedAction, TokenOption } from "@/modules/delegated-keys/services/delegatedKeys";



export const PREDEFINED_ACTIONS: PredefinedAction[] = [
    { id: 'transfer', name: 'Transfer', description: 'Send tokens to any address', selector: '0xa9059cbb', category: 'transfer' },
    { id: 'approve', name: 'Approve', description: 'Approve token spending', selector: '0x095ea7b3', category: 'approve' },
    { id: 'transferFrom', name: 'Transfer From', description: 'Transfer tokens on behalf of another', selector: '0x23b872dd', category: 'transfer' },
    { id: 'swap', name: 'Swap', description: 'Exchange tokens via DEX', selector: '0x38ed1739', category: 'swap' },
    { id: 'stake', name: 'Stake', description: 'Stake tokens for rewards', selector: '0xa694fc3a', category: 'stake' },
    { id: 'unstake', name: 'Unstake', description: 'Unstake tokens', selector: '0x2e17de78', category: 'stake' },
    { id: 'claim', name: 'Claim Rewards', description: 'Claim staking rewards', selector: '0x379607f5', category: 'stake' },
    { id: 'deposit', name: 'Deposit', description: 'Deposit tokens to protocol', selector: '0x47e7ef24', category: 'other' },
    { id: 'withdraw', name: 'Withdraw', description: 'Withdraw tokens from protocol', selector: '0x2e1a7d4d', category: 'other' }
];

export const SUPPORTED_TOKENS: TokenOption[] = [
    {
      address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
      symbol: 'UNI',
      name: 'Uniswap',
      decimals: 18,
      color: '#FF007A',
    },
    {
      address: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
      symbol: 'WETH',
      name: 'Wrapped Ether',
      decimals: 18,
      color: '#627EEA',
    },
    {
      address: '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      color: '#26a17b',
    },
    {
      address: '0x94a9d9ac8a22534e3faca9f4e7f2e2cf85d5e4c8',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      color: '#2775CA',
    },
    {
      address: '0xff34b3d4aee8ddcd6f9afffb6fe49bd371b8a357',
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      decimals: 18,
      color: '#F5AC37',
    },
  ];