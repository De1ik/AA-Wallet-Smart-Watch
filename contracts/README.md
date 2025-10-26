# CallPolicy Contract Deployment Guide (v2)

This guide will help you deploy the **enhanced CallPolicy v2** contract using Foundry (Forge).

## 🆕 **What's New in v2**

- ✅ **Daily Limits Support** - Set spending limits per day
- ✅ **Easy Permission Enumeration** - Query permissions by count and index  
- ✅ **Permission Updates** - Modify limits after installation
- ✅ **Enhanced Events** - Better transparency and logging
- ✅ **Complete ParamCondition Support** - All validation conditions work
- ✅ **Daily Usage Tracking** - Monitor daily spending

## Prerequisites

1. **Install Foundry**:
   ```bash
   curl -L https://foundry.paradigm.xyz | bash
   foundryup
   ```

2. **Set up environment variables**:
   Create a `.env` file in the contracts directory:
   ```bash
   PRIVATE_KEY=your_private_key_here
   ALCHEMY_API_KEY=your_alchemy_api_key
   ETHERSCAN_API_KEY=your_etherscan_api_key
   POLYGONSCAN_API_KEY=your_polygonscan_api_key
   ```

## Project Structure

```
contracts/
├── src/
│   └── CallPolicy.sol                    # Enhanced v2 contract
├── script/
│   ├── DeployCallPolicyUpdated.s.sol      # Basic v2 deployment
│   ├── DeployCallPolicyUpdatedWithSamplePermissions.s.sol # v2 with samples
│   ├── DeployCallPolicy.s.sol            # Legacy v1 deployment
│   └── DeployCallPolicyWithPermissions.s.sol # Legacy v1 with samples
├── lib/
│   └── kernel_v3/                       # Kernel dependencies
├── foundry.toml                         # Foundry configuration
├── CALLPOLICY_V2_GUIDE.md              # Detailed v2 guide
└── package.json                        # Node.js dependencies
```

## Deployment Steps

### 1. Install Dependencies

```bash
cd contracts
forge install foundry-rs/forge-std
```

### 2. Build the Contract

```bash
forge build
```

### 3. Deploy to Testnet (Sepolia)

```bash
# Deploy enhanced v2 contract (RECOMMENDED)
forge script script/DeployCallPolicyUpdated.s.sol --rpc-url sepolia --broadcast --verify

# Deploy v2 with sample permissions showcasing new features
forge script script/DeployCallPolicyUpdatedWithSamplePermissions.s.sol --rpc-url sepolia --broadcast --verify

# Legacy v1 deployment (for compatibility)
forge script script/DeployCallPolicy.s.sol --rpc-url sepolia --broadcast --verify
```

### 4. Deploy to Mainnet

```bash
# Deploy enhanced v2 contract (RECOMMENDED)
forge script script/DeployCallPolicyUpdated.s.sol --rpc-url mainnet --broadcast --verify

# Legacy v1 deployment
forge script script/DeployCallPolicy.s.sol --rpc-url mainnet --broadcast --verify
```

### 5. Deploy to Polygon

```bash
# Deploy enhanced v2 contract (RECOMMENDED)
forge script script/DeployCallPolicyUpdated.s.sol --rpc-url polygon --broadcast --verify
```

## Contract Usage

The CallPolicy contract is designed to work with ERC-7579 compatible wallets. Here's how to use it:

### 1. Deploy the Contract
First, deploy the CallPolicy contract using the scripts above.

### 2. Install Policy on Wallet
To install this policy on a wallet, you need to:

1. Create permission data:
```solidity
Permission[] memory permissions = new Permission[](1);
permissions[0] = Permission({
    callType: CallType.CALLTYPE_SINGLE,
    target: address(0), // address(0) means any address
    selector: bytes4(keccak256("transfer(address,uint256)")),
    valueLimit: 0,
    rules: new ParamRule[](0)
});
```

2. Encode the installation data:
```solidity
bytes32 policyId = keccak256("MY_POLICY");
bytes memory installData = abi.encode(policyId, permissions);
```

3. Call the wallet's module installation function with the CallPolicy address and installData.

### 3. Policy Configuration

The CallPolicy supports various permission types:

- **CallType**: `CALLTYPE_SINGLE`, `CALLTYPE_BATCH`, `CALLTYPE_DELEGATECALL`
- **Target**: Specific contract address or `address(0)` for any address
- **Selector**: Function selector (first 4 bytes of function signature)
- **ValueLimit**: Maximum ETH value that can be sent
- **Rules**: Parameter validation rules

### 4. Parameter Rules

You can set up parameter validation rules:

```solidity
ParamRule[] memory rules = new ParamRule[](1);
rules[0] = ParamRule({
    condition: ParamCondition.EQUAL,
    offset: 0, // offset in calldata (after function selector)
    params: [bytes32(uint256(uint160(allowedAddress)))]
});
```

## Verification

After deployment, the contract will be automatically verified on Etherscan/Polygonscan if you have the API keys set up.

## Troubleshooting

1. **Import errors**: Make sure the kernel dependencies are properly copied to `lib/kernel_v3/`
2. **Compilation errors**: Check that all imports are resolved correctly
3. **Deployment failures**: Ensure you have sufficient ETH for gas fees
4. **Verification failures**: Double-check your API keys and network settings

## Security Notes

- Never commit your private key to version control
- Use testnets for testing before mainnet deployment
- Review all permissions carefully before installation
- Consider using a multisig wallet for mainnet deployments

## Support

For issues related to:
- Foundry: Check the [Foundry documentation](https://book.getfoundry.sh/)
- ERC-7579: Check the [ERC-7579 specification](https://eips.ethereum.org/EIPS/eip-7579)
- Kernel: Check the [Kernel documentation](https://docs.kernel.community/)
