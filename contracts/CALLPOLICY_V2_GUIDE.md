# CallPolicy Updated (v2) - Enhanced Delegated Keys Guide

## 🎯 **New Features in CallPolicy v2**

Your CallPolicy contract has been significantly enhanced with new features for better delegated key management:

### ✅ **New Features Added:**

1. **Daily Limits Support** - Set spending limits per day for each permission
2. **Easy Permission Enumeration** - Query permissions by count and index
3. **Permission Updates** - Modify limits after installation (owner-only)
4. **Enhanced Events** - Better transparency with detailed event logging
5. **Complete ParamCondition Support** - All parameter validation conditions now work
6. **Daily Usage Tracking** - Monitor how much has been used each day

## 🔐 **Enhanced Permission Structure**

```solidity
struct Permission {
    CallType callType;        // Type of call (SINGLE, BATCH, DELEGATECALL)
    address target;          // Target contract (address(0) = any)
    bytes4 selector;         // Function selector
    uint256 valueLimit;      // Max value per transaction
    uint256 dailyLimit;      // NEW: Max value per day
    ParamRule[] rules;       // Parameter validation rules
}
```

## 📊 **New API Endpoints**

### 1. **Get Permissions Count**
```bash
POST /callpolicy/count
{
  "policyId": "0x...",
  "owner": "0x..."
}
```

### 2. **Get Permission by Index**
```bash
POST /callpolicy/get-by-index
{
  "policyId": "0x...",
  "owner": "0x...",
  "index": 0
}
```

### 3. **Get Daily Usage**
```bash
POST /callpolicy/daily-usage
{
  "policyId": "0x...",
  "wallet": "0x...",
  "permissionHash": "0x...",
  "day": 19700  // Current day number
}
```

### 4. **Update Permission Limits**
```bash
POST /callpolicy/update-limits
{
  "policyId": "0x...",
  "wallet": "0x...",
  "callType": 0,
  "target": "0x...",
  "selector": "0xa9059cbb",
  "newValueLimit": "1000000000000000000",  // 1 ETH in wei
  "newDailyLimit": "5000000000000000000"   // 5 ETH in wei
}
```

## 🚀 **Deployment Instructions**

### **Deploy Updated Contract:**

```bash
# Deploy basic updated contract
forge script script/DeployCallPolicyUpdated.s.sol --rpc-url sepolia --broadcast --verify

# Deploy with sample permissions showcasing new features
forge script script/DeployCallPolicyUpdatedWithSamplePermissions.s.sol --rpc-url sepolia --broadcast --verify
```

### **Update Server Configuration:**

After deploying the new contract, update your server configuration:

```typescript
// In server-side/src/utils/native-code.ts
const CALL_POLICY: Address = '0xYourNewCallPolicyAddress'
```

## 💡 **Usage Examples**

### **Example 1: Transfer with Daily Limits**
```typescript
const permissions = [{
  callType: 0, // CALLTYPE_SINGLE
  target: "0x0000000000000000000000000000000000000000", // Any ERC20
  selector: "0xa9059cbb", // transfer(address,uint256)
  valueLimit: "1000000000000000000", // 1 ETH per transaction
  dailyLimit: "5000000000000000000", // 5 ETH per day
  rules: []
}];
```

### **Example 2: DEX Swap with Parameter Rules**
```typescript
const permissions = [{
  callType: 0,
  target: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D", // Uniswap Router
  selector: "0x7ff36ab5", // swapExactTokensForTokens
  valueLimit: "0",
  dailyLimit: "10000000000000000000", // 10 ETH daily limit
  rules: [{
    condition: 4, // LESS_THAN_OR_EQUAL
    offset: 4, // amountIn parameter
    params: ["0x0000000000000000000000000000000000000000000000000de0b6b3a7640000"] // 1 ETH
  }]
}];
```

### **Example 3: Query All Permissions**
```typescript
// Get count
const count = await getCallPolicyPermissionsCount(policyId, owner);

// Get each permission
for (let i = 0; i < count; i++) {
  const permission = await getCallPolicyPermissionByIndex(policyId, owner, i);
  console.log(`Permission ${i}:`, permission);
}
```

## 🔄 **Migration from v1 to v2**

### **Key Changes:**

1. **Permission Structure**: Added `dailyLimit` field
2. **Server API**: New endpoints for enumeration and updates
3. **Contract Functions**: New getter functions and update capabilities
4. **Events**: Enhanced event logging

### **Migration Steps:**

1. **Deploy v2 Contract**: Use the new deployment scripts
2. **Update Server**: Update `CALL_POLICY` address in server config
3. **Update Frontend**: Add support for daily limits in UI
4. **Migrate Existing Policies**: Reinstall policies with daily limits

## 📈 **Benefits of v2**

### **For Users:**
- **Better Control**: Daily spending limits prevent large losses
- **Easy Monitoring**: Query permissions and usage easily
- **Flexible Updates**: Modify limits without reinstalling
- **Transparency**: Enhanced events for better tracking

### **For Developers:**
- **Complete API**: All contract functions exposed via REST API
- **Better UX**: Easy permission enumeration and management
- **Enhanced Security**: Daily limits add extra protection layer
- **Future-Proof**: Extensible architecture for more features

## 🛡️ **Security Considerations**

1. **Daily Limits**: Reset at midnight UTC (block.timestamp / 1 days)
2. **Owner-Only Updates**: Only the original installer can modify limits
3. **Parameter Validation**: All ParamCondition types now supported
4. **Event Logging**: All changes are logged for audit trails

## 🔧 **Troubleshooting**

### **Common Issues:**

1. **Daily Limit Exceeded**: Check `dailyUsed` mapping for current usage
2. **Permission Not Found**: Verify policy ID and owner address
3. **Update Failed**: Ensure you're the original permission owner
4. **Gas Issues**: Daily limit checks add minimal gas overhead

### **Debug Commands:**

```bash
# Check daily usage
cast call $CALL_POLICY "dailyUsed(bytes32,address,bytes32,uint256)" $POLICY_ID $WALLET $PERMISSION_HASH $DAY

# Get permission count
cast call $CALL_POLICY "getPermissionsCount(bytes32,address)" $POLICY_ID $OWNER

# Get permission by index
cast call $CALL_POLICY "getPermissionByIndex(bytes32,address,uint256)" $POLICY_ID $OWNER 0
```

## 🎉 **Summary**

CallPolicy v2 provides a comprehensive solution for delegated key management with:

- ✅ **Daily spending limits** for enhanced security
- ✅ **Easy permission querying** for better UX
- ✅ **Owner-controlled updates** for flexibility
- ✅ **Complete parameter validation** for precise control
- ✅ **Enhanced transparency** through detailed events

Your delegated keys are now more secure and manageable than ever! 🔐
