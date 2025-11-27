import { http, createPublicClient, Address } from 'viem'
import { createBundlerClient } from 'viem/account-abstraction'
import { toKernelSmartAccount } from 'permissionless/accounts'
import { sepolia } from 'viem/chains'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

import { createPaymasterClient } from 'viem/account-abstraction'

import { ZERO_DEV_RPC } from './constants'
 

export async function createKernelWallet(privateKey: Address) {
    const pkAccount = privateKeyToAccount(privateKey)

    const client = createPublicClient({
        chain: sepolia,
        transport: http(),
    })

    const paymasterClient = createPaymasterClient({ 
        name: "dejest",
        transport: http(ZERO_DEV_RPC), 
    }) 

    const bundlerClient = createBundlerClient({ 
        client, 
        transport: http(ZERO_DEV_RPC), 
    }) 

    const kernelAccount = await toKernelSmartAccount({ 
        client, 
        owners: [pkAccount], 
        version: '0.3.1', 
    }) 

    console.log("Kernel Address: ", kernelAccount.address);

    const hash = await bundlerClient.sendUserOperation({
        account: kernelAccount,
        calls: [
            { to: pkAccount.address, value: 0n, data: '0x' }, // EOA no-op
        ],
        paymaster: {
            getPaymasterData: paymasterClient.getPaymasterData,
            getPaymasterStubData: paymasterClient.getPaymasterStubData,
        },
    })

    console.log("hash:", hash)
    return {kernelAccount, hash}
}
