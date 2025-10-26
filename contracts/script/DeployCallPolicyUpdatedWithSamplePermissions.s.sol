// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "forge-std/Script.sol";
import "../src/CallPolicy.sol";

contract DeployCallPolicyUpdatedWithSamplePermissions is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying CallPolicy Updated with sample permissions with account:", deployer);
        console.log("Account balance:", deployer.balance);
        
        vm.startBroadcast(deployerPrivateKey);
        
        CallPolicy callPolicy = new CallPolicy();
        
        vm.stopBroadcast();
        
        console.log("CallPolicy Updated deployed at:", address(callPolicy));
        
        // Create policy with enhanced permissions showcasing new features
        bytes32 policyId = keccak256("ENHANCED_DELEGATED_KEYS_POLICY");
        
        // Create enhanced permissions with daily limits
        Permission[] memory permissions = new Permission[](3);
        
        // Permission 1: Transfer with both value and daily limits
        permissions[0] = Permission({
            callType: CALLTYPE_SINGLE,
            target: address(0), // Any ERC20 token
            selector: bytes4(keccak256("transfer(address,uint256)")),
            valueLimit: 1000 * 10**18, // Max 1000 tokens per transaction
            dailyLimit: 5000 * 10**18, // Max 5000 tokens per day
            rules: new ParamRule[](0)
        });
        
        // Permission 2: Approve with strict daily limits
        permissions[1] = Permission({
            callType: CALLTYPE_SINGLE,
            target: address(0), // Any ERC20 token
            selector: bytes4(keccak256("approve(address,uint256)")),
            valueLimit: 500 * 10**18, // Max 500 tokens per approval
            dailyLimit: 2000 * 10**18, // Max 2000 tokens per day
            rules: new ParamRule[](0)
        });
        
        // Permission 3: DEX swap with parameter rules and daily limits
        permissions[2] = Permission({
            callType: CALLTYPE_SINGLE,
            target: address(0), // Any DEX contract
            selector: bytes4(keccak256("swapExactTokensForTokens(uint256,uint256,address[],address,uint256)")),
            valueLimit: 0, // No ETH value
            dailyLimit: 10000 * 10**18, // Max 10000 tokens swapped per day
            rules: new ParamRule[](1)
        });
        
        // Add parameter rule for swap amount limit
        ParamRule[] memory swapRules = new ParamRule[](1);
        bytes32[] memory swapParams = new bytes32[](1);
        swapParams[0] = bytes32(uint256(1000 * 10**18)); // Max 1000 tokens per swap
        swapRules[0] = ParamRule({
            condition: ParamCondition.LESS_THAN_OR_EQUAL,
            offset: 4, // amountIn parameter offset
            params: swapParams
        });
        permissions[2].rules = swapRules;
        
        // Encode permissions for installation
        bytes memory installData = abi.encode(permissions);
        
        console.log("\n=== ENHANCED POLICY CONFIGURATION ===");
        console.log("Policy ID:", vm.toString(policyId));
        console.log("Install data length:", installData.length);
        console.log("Number of permissions:", permissions.length);
        
        // Log detailed permission information
        for (uint256 i = 0; i < permissions.length; i++) {
            console.log("\n--- Permission", i + 1, "---");
            console.log("CallType:", uint256(uint8(CallType.unwrap(permissions[i].callType))));
            console.log("Target:", permissions[i].target);
            console.log("Selector:", vm.toString(permissions[i].selector));
            console.log("Value Limit:", permissions[i].valueLimit);
            console.log("Daily Limit:", permissions[i].dailyLimit);
            console.log("Rules count:", permissions[i].rules.length);
            
            // Log parameter rules if any
            for (uint256 j = 0; j < permissions[i].rules.length; j++) {
                console.log("  Rule", j + 1, ":");
                console.log("    Condition:", uint256(uint8(permissions[i].rules[j].condition)));
                console.log("    Offset:", permissions[i].rules[j].offset);
                console.log("    Params count:", permissions[i].rules[j].params.length);
            }
        }
        
        console.log("\n=== NEW FEATURES DEMONSTRATED ===");
        console.log("Daily limits: Each permission has daily spending limits");
        console.log("Enhanced parameter rules: Complete ParamCondition support");
        console.log("Easy enumeration: Use getPermissionsCount() and getPermissionByIndex()");
        console.log("Owner updates: Use updatePermissionLimits() to modify limits");
        console.log("Daily tracking: Monitor usage with dailyUsed() mapping");
        
        console.log("\n=== USAGE INSTRUCTIONS ===");
        console.log("1. Install this policy on your wallet using the installData");
        console.log("2. Query permissions: callPolicy.getPermissionsCount(policyId, walletAddress)");
        console.log("3. Get specific permission: callPolicy.getPermissionByIndex(policyId, walletAddress, index)");
        console.log("4. Update limits: callPolicy.updatePermissionLimits(...)");
        console.log("5. Monitor daily usage: callPolicy.dailyUsed(policyId, walletAddress, permissionHash, day)");
        
        console.log("\nDeployment successful!");
    }
}
