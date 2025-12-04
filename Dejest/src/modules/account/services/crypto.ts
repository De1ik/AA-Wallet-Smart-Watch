import 'react-native-get-random-values';
import {
  generateMnemonic,
  validateMnemonic as scureValidate,
} from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { mnemonicToAccount } from 'viem/accounts';
import { TxType } from '@/domain/types';

// 128 bits entropy = 12 words; 256 bits = 24 words
const STRENGTH = 128;

/**
 * Convert Uint8Array to hex string with 0x prefix
 */
function toHex(bytes: Uint8Array): string {
  return (
    '0x' +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  );
}

/**
 * Generate a random seed phrase (12 words)
 */
export function generateSeedPhrase(): string[] {
  const mnemonic = generateMnemonic(wordlist, STRENGTH);
  return mnemonic.split(' ');
}

/**
 * Validate seed phrase
 */
export function validateSeedPhrase(seedPhrase: string[]): boolean {
  if (seedPhrase.length !== 12 && seedPhrase.length !== 24) return false;
  const mnemonic = seedPhrase.join(' ');
  return scureValidate(mnemonic, wordlist);
}

/**
 * Generate wallet account from seed phrase using viem
 */
export function generateWalletAccount(seedPhrase: string[]) {
  const mnemonic = seedPhrase.join(' ');
  return mnemonicToAccount(mnemonic);
}

/**
 * Generate wallet address from seed phrase using viem
 */
export function generateWalletAddress(seedPhrase: string[]): string {
  return generateWalletAccount(seedPhrase).address;
}

/**
 * Generate private key from seed phrase using viem
 */
export function generatePrivateKey(seedPhrase: string[]): string {
  const mnemonic = seedPhrase.join(' ');
  const account = mnemonicToAccount(mnemonic);

  const hdKey = account.getHdKey();
  if (!hdKey.privateKey) {
    throw new Error('No private key available');
  }

  return toHex(hdKey.privateKey);
}

/**
 * Helper: get private key from account object
 */
export function getPrivateKeyFromAccount(account: any): string {
  const hdKey = account.getHdKey();
  if (!hdKey.privateKey) {
    throw new Error('No private key available');
  }
  return toHex(hdKey.privateKey);
}

/**
 * Mock crypto data for demo
 */
export const mockCryptoData = {
  totalBalance: 12525.0, // 7525 (ETH) + 5000 (USDC)
  change24h: 0,
  portfolio: [
    {
      id: 'ethereum',
      name: 'Ethereum',
      symbol: 'ETH',
      amount: 2.15,
      value: 7525.0, // 2.15 * 3500
      change24h: -0.8,
      color: '#627EEA',
    },
    {
      id: 'usdc',
      name: 'USD Coin',
      symbol: 'USDC',
      amount: 5000,
      value: 5000.0, // Stablecoin 1:1 with USD
      change24h: 0,
      color: '#2775CA',
    },
  ],
  transactions: [
    {
      id: '1',
      type: TxType.SENT,
      from: 'John Doe',
      amount: 0.5,
      symbol: 'ETH',
      value: 1750.0, // 0.5 * 3500
      timestamp: new Date(Date.now() - 2 * 60 * 1000), // 2 minutes ago
    },
    {
      id: '2',
      type: TxType.SENT,
      to: 'Sarah Wilson',
      amount: 150,
      symbol: 'USDC',
      value: 150.0, // Stablecoin 1:1 with USD
      timestamp: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
    },
    {
      id: '3',
      type: TxType.RECEIVED,
      from: 'Mike Chen',
      amount: 2.5,
      symbol: 'ETH',
      value: 8750.0, // 2.5 * 3500
      timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
    },
  ],
};