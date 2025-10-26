# CallPolicy Deployment Instructions

## Prerequisites ✅
- Foundry is installed and working
- Contract compiles successfully
- Dependencies are installed

## Next Steps:

### 1. Configure Environment Variables
Edit your `.env` file with real values:

```bash
# Replace these with your actual values:
PRIVATE_KEY=0x1234567890abcdef...  # Your wallet private key
ALCHEMY_API_KEY=your_actual_alchemy_key
ETHERSCAN_API_KEY=your_actual_etherscan_key
```

### 2. Deploy to Testnet (Recommended First)

```bash
# Deploy to Sepolia testnet
forge script script/DeployCallPolicy.s.sol --rpc-url sepolia --broadcast --verify

# Or deploy with sample permissions
forge script script/DeployCallPolicyWithPermissions.s.sol --rpc-url sepolia --broadcast --verify
```

### 3. Deploy to Mainnet (After Testing)

```bash
# Deploy to Ethereum mainnet
forge script script/DeployCallPolicy.s.sol --rpc-url mainnet --broadcast --verify
```

### 4. Deploy to Polygon

```bash
# Deploy to Polygon mainnet
forge script script/DeployCallPolicy.s.sol --rpc-url polygon --broadcast --verify
```

## What Each Command Does:
- `--rpc-url sepolia`: Uses Sepolia testnet
- `--broadcast`: Actually sends the transaction (without this, it's just a simulation)
- `--verify`: Automatically verifies the contract on Etherscan

## Getting Testnet ETH:
- Sepolia: Use [Sepolia Faucet](https://sepoliafaucet.com/)
- Mumbai: Use [Polygon Faucet](https://faucet.polygon.technology/)

## Expected Output:
After successful deployment, you'll see:
```
CallPolicy deployed at: 0x1234567890123456789012345678901234567890
Deployment successful!
```

## Troubleshooting:
- **"insufficient funds"**: Get testnet ETH from faucets
- **"invalid private key"**: Check your private key format
- **"RPC error"**: Verify your API keys are correct

Your contract is ready to deploy! Just update the .env file with your actual values.
