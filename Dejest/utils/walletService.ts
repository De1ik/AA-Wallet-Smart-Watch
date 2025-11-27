import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseEther, Address, Hex, isAddress } from 'viem';
import { isTestMode, getKernelAddress, getPrivateKey } from './config';
import { buildSendRootUO, sendUserOpV07 } from './native-code';
import { loadPrivateKey } from './secureStorage';
import { createKernelWallet } from '@/app/kernel-factory';

/**
 * Get private key from secure storage or test environment
 */
export async function getPrivateKeyFromStorage(): Promise<`0x${string}`> {
  // Check if we're in test mode
  const testMode = isTestMode();
  
  if (testMode) {
    // Use test private key from environment
    const testPrivateKey = getPrivateKey();
    if (!testPrivateKey) {
      throw new Error('PRIVATE_KEY_TEST is true but PRIVATE_KEY is not set in environment');
    }
    return testPrivateKey as `0x${string}`;
  }
  
  // Use real user's private key from secure storage
  const storedPrivateKey = await loadPrivateKey();
  if (!storedPrivateKey) {
    throw new Error('No private key found in secure storage');
  }

  return storedPrivateKey as `0x${string}`;
}

/**
 * Get wallet address (either KERNEL in test mode or user's address in production)
 */
export async function getWalletAddress(): Promise<Address> {
  // Check if we're in test mode
  const testMode = isTestMode();
  
  if (testMode) {
    // Use KERNEL address from environment when in test mode
    const kernelAddress = getKernelAddress();
    if (!kernelAddress) {
      throw new Error('PRIVATE_KEY_TEST is true but KERNEL is not set in environment');
    }
    return kernelAddress as Address;
  }
  
  // Use real user's address from secure storage
  const storedWallet = await AsyncStorage.getItem('wallet');
  if (!storedWallet) {
    throw new Error('No wallet found in secure storage');
  }
  
  const wallet = JSON.parse(storedWallet);
  if (!wallet.address) {
    throw new Error('No address found in wallet');
  }
  if (!isAddress(wallet.address)) {
    throw new Error('incorrect address format stored in wallet')
  }

  return wallet.address as Address;
}

/**
 * Predict smart wallet address using the native implementation
 */
export async function predictSmartWalletAddress(privateKey: `0x${string}`): Promise<Address> {
  // Check if we're in test mode
  const testMode = isTestMode();
  
  if (testMode) {
    // Use KERNEL address from environment when in test mode
    const kernelAddress = getKernelAddress();
    if (!kernelAddress) {
      throw new Error('PRIVATE_KEY_TEST is true but KERNEL is not set in environment');
    }
    return kernelAddress as Address;
  }

  // Try stored smart wallet
  try {
    const storedWallet = await AsyncStorage.getItem('wallet');
    if (storedWallet) {
      const parsed = JSON.parse(storedWallet);
      if (parsed.smartWalletAddress) {
        return parsed.smartWalletAddress as Address;
      }
    }
  } catch (error) {
    console.warn('Could not read stored wallet for smart address:', error);
  }

  // Create Kernel natively and return its address
  const { kernelAccount, hash } = await createKernelWallet(privateKey as Hex);
  return kernelAccount.address;
}

/**
 * Send a transaction using the native implementation
 * @param to Recipient address
 * @param amount Amount (as string in ETH, will be converted to wei)
 * @param tokenAddress Optional ERC20 token address; if omitted, sends native ETH
 */
export async function sendTransaction({
  to,
  amount,
  tokenAddress,
}: {
  to: `0x${string}`;
  amount: string; // Amount in ETH as string
  tokenAddress?: `0x${string}`;
}): Promise<string> {
  try {
    // Convert amount from ETH to wei
    const amountInWei = parseEther(amount);

    console.log("[sendTransaction] -> Sending transaction:", {
        to,
        amount: amountInWei.toString(),
        tokenAddress,
    });

    const { unpacked: unp2, userOpHash: uoh2 } = await buildSendRootUO(to, amountInWei, '0x', 0)
    console.log('[sendTransaction] -> UOHASH:', uoh2);
    const txHash = await sendUserOpV07(unp2);
    console.log('[sendTransaction] -> txHash:', txHash);
    
    
    console.log("[sendTransaction] -> Transaction sent successfully:", txHash);
    return txHash;
    
  } catch (error) {
    console.error("Error sending transaction:", error);
    throw error;
  }
}
