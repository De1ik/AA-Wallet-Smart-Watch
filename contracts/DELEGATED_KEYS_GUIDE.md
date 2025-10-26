# CallPolicy for Delegated Keys - Usage Guide

## 🎯 Your Deployed Contract

**Contract Address**: `0xFf2C5EEE1feb769B5fEE38F312Bf2418E6153655`  
**Network**: Sepolia Testnet  
**Etherscan**: https://sepolia.etherscan.io/address/0xff2c5eee1feb769b5fee38f312bf2418e6153655

## 🔐 How to Use CallPolicy with Delegated Keys

### 1. Understanding the Policy System

Your CallPolicy contract implements ERC-7579 policy modules that can be installed on compatible wallets to restrict what operations delegated keys can perform.

### 2. Installing the Policy on a Wallet

To install this policy on a wallet (like Kernel), you need to:

```solidity
// Example installation code
bytes32 policyId = keccak256("DELEGATED_KEYS_POLICY");

// Create permissions array
Permission[] memory permissions = new Permission[](2);

// Allow transfer with amount limit
permissions[0] = Permission({
    callType: CALLTYPE_SINGLE,
    target: address(0), // address(0) = any ERC20 token
    selector: bytes4(keccak256("transfer(address,uint256)")),
    valueLimit: 0,
    rules: new ParamRule[](1)
});

// Set amount limit rule (max 1000 tokens)
ParamRule[] memory rules = new ParamRule[](1);
rules[0] = ParamRule({
    condition: ParamCondition.LESS_THAN_OR_EQUAL,
    offset: 36, // amount parameter offset
    params: [bytes32(uint256(1000 * 10**18))] // 1000 tokens
});
permissions[0].rules = rules;

// Allow approve with limit
permissions[1] = Permission({
    callType: CALLTYPE_SINGLE,
    target: address(0),
    selector: bytes4(keccak256("approve(address,uint256)")),
    valueLimit: 0,
    rules: new ParamRule[](1)
});

// Set approval limit (max 100 tokens)
ParamRule[] memory approveRules = new ParamRule[](1);
approveRules[0] = ParamRule({
    condition: ParamCondition.LESS_THAN_OR_EQUAL,
    offset: 36,
    params: [bytes32(uint256(100 * 10**18))] // 100 tokens
});
permissions[1].rules = approveRules;

// Encode installation data
bytes memory installData = abi.encode(policyId, permissions);

// Install the policy
wallet.installModule(MODULE_TYPE_POLICY, address(callPolicy), installData);
```

### 3. Policy Configuration Examples

#### Example 1: Restrict Token Transfers
```solidity
Permission memory transferPermission = Permission({
    callType: CALLTYPE_SINGLE,
    target: address(0), // Any ERC20
    selector: bytes4(keccak256("transfer(address,uint256)")),
    valueLimit: 0,
    rules: new ParamRule[](1)
});

// Limit transfer amount to 1000 tokens
ParamRule[] memory transferRules = new ParamRule[](1);
transferRules[0] = ParamRule({
    condition: ParamCondition.LESS_THAN_OR_EQUAL,
    offset: 36, // amount parameter
    params: [bytes32(uint256(1000 * 10**18))]
});
transferPermission.rules = transferRules;
```

#### Example 2: Restrict to Specific Contracts
```solidity
Permission memory specificContractPermission = Permission({
    callType: CALLTYPE_SINGLE,
    target: 0x1234...5678, // Specific contract address
    selector: bytes4(keccak256("swapExactTokensForTokens(...)")),
    valueLimit: 0,
    rules: new ParamRule[](0)
});
```

#### Example 3: Block Dangerous Operations
```solidity
// This permission will be rejected by the policy logic
Permission memory dangerousPermission = Permission({
    callType: CALLTYPE_DELEGATECALL,
    target: address(0),
    selector: bytes4(0), // Any function
    valueLimit: 0,
    rules: new ParamRule[](0)
});
```

### 4. Parameter Rules Explained

The `ParamRule` struct allows you to validate function parameters:

```solidity
struct ParamRule {
    ParamCondition condition;  // How to compare
    uint64 offset;            // Byte offset in calldata (after function selector)
    bytes32[] params;         // Values to compare against
}

enum ParamCondition {
    EQUAL,                    // param == params[0]
    GREATER_THAN,            // param > params[0]
    LESS_THAN,               // param < params[0]
    GREATER_THAN_OR_EQUAL,   // param >= params[0]
    LESS_THAN_OR_EQUAL,      // param <= params[0]
    NOT_EQUAL,               // param != params[0]
    ONE_OF                   // param in params array
}
```

### 5. Common Use Cases for Delegated Keys

#### A. Trading Bot Restrictions
```solidity
// Allow only specific DEX interactions
Permission memory dexPermission = Permission({
    callType: CALLTYPE_SINGLE,
    target: address(uniswapRouter), // Specific DEX
    selector: bytes4(keccak256("swapExactTokensForTokens(...)")),
    valueLimit: 0,
    rules: new ParamRule[](1)
});

// Limit swap amount
ParamRule[] memory swapRules = new ParamRule[](1);
swapRules[0] = ParamRule({
    condition: ParamCondition.LESS_THAN_OR_EQUAL,
    offset: 4, // amountIn parameter
    params: [bytes32(uint256(1000 * 10**18))] // Max 1000 tokens
});
dexPermission.rules = swapRules;
```

#### B. Payment Processing
```solidity
// Allow only small payments
Permission memory paymentPermission = Permission({
    callType: CALLTYPE_SINGLE,
    target: address(0), // Any contract
    selector: bytes4(keccak256("transfer(address,uint256)")),
    valueLimit: 0,
    rules: new ParamRule[](1)
});

// Limit payment amount
ParamRule[] memory paymentRules = new ParamRule[](1);
paymentRules[0] = ParamRule({
    condition: ParamCondition.LESS_THAN_OR_EQUAL,
    offset: 36,
    params: [bytes32(uint256(100 * 10**18))] // Max 100 tokens
});
paymentPermission.rules = paymentRules;
```

### 6. Testing Your Policy

After installing the policy, test it by:

1. **Try allowed operations** - should succeed
2. **Try restricted operations** - should fail with `CallViolatesParamRule()`
3. **Try operations exceeding limits** - should fail with `CallViolatesValueRule()`

### 7. Monitoring and Management

- **Check policy status**: `callPolicy.status(policyId, walletAddress)`
- **View permissions**: `callPolicy.encodedPermissions(policyId, permissionHash, walletAddress)`
- **Uninstall policy**: Use wallet's module uninstallation function

### 8. Security Best Practices

1. **Start with restrictive policies** and gradually relax them
2. **Test thoroughly** on testnets before mainnet
3. **Monitor policy violations** through events
4. **Regularly review** and update permissions
5. **Use specific contract addresses** when possible instead of `address(0)`

## 🚀 Next Steps

1. **Deploy to mainnet** when ready: `forge script script/DeployCallPolicy.s.sol --rpc-url mainnet --broadcast --verify`
2. **Integrate with your wallet** using the installation code above
3. **Test with your delegated keys** to ensure proper restrictions
4. **Monitor and adjust** permissions as needed

Your CallPolicy contract is now ready to secure your delegated keys! 🔐
