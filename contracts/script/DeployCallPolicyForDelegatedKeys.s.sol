// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Script.sol";
import "../src/CallPolicy.sol";
import "kernel/types/Constants.sol";

contract DeployCallPolicyForDelegatedKeys is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying CallPolicy for Delegated Keys with account:", deployer);
        console.log("Account balance:", deployer.balance);
        
        vm.startBroadcast(deployerPrivateKey);
        
        CallPolicy callPolicy = new CallPolicy();
        
        vm.stopBroadcast();
        
        console.log("CallPolicy deployed at:", address(callPolicy));
        
        // Create policy specifically for delegated keys restrictions
        bytes32 policyId = keccak256("DELEGATED_KEYS_POLICY");
        
        // Create restrictive permissions for delegated keys
        Permission[] memory permissions = new Permission[](4);
        
        // Permission 1: Allow only specific function calls (like transfer with limits)
        permissions[0] = Permission({
            callType: CALLTYPE_SINGLE,
            target: address(0), // Any ERC20 token
            selector: bytes4(keccak256("transfer(address,uint256)")),
            valueLimit: 0, // No ETH value
            dailyLimit: 1000 * 10**18, // Max 1000 tokens per day
            rules: new ParamRule[](1)
        });
        
        // Add amount limit rule for transfer (max 1000 tokens)
        ParamRule[] memory transferRules = new ParamRule[](1);
        bytes32[] memory transferParams = new bytes32[](1);
        transferParams[0] = bytes32(uint256(1000 * 10**18)); // 1000 tokens (assuming 18 decimals)
        transferRules[0] = ParamRule({
            condition: ParamCondition.LESS_THAN_OR_EQUAL,
            offset: 36, // amount parameter offset in transfer(address,uint256)
            params: transferParams
        });
        permissions[0].rules = transferRules;
        
        // Permission 2: Allow approve with strict limits
        permissions[1] = Permission({
            callType: CALLTYPE_SINGLE,
            target: address(0), // Any ERC20 token
            selector: bytes4(keccak256("approve(address,uint256)")),
            valueLimit: 0,
            dailyLimit: 500 * 10**18, // Max 500 tokens per day
            rules: new ParamRule[](1)
        });
        
        // Add approval limit rule (max 100 tokens)
        ParamRule[] memory approveRules = new ParamRule[](1);
        bytes32[] memory approveParams = new bytes32[](1);
        approveParams[0] = bytes32(uint256(100 * 10**18)); // 100 tokens
        approveRules[0] = ParamRule({
            condition: ParamCondition.LESS_THAN_OR_EQUAL,
            offset: 36, // amount parameter offset in approve(address,uint256)
            params: approveParams
        });
        permissions[1].rules = approveRules;
        
        // Permission 3: Allow specific contract interactions (example: DEX swaps)
        permissions[2] = Permission({
            callType: CALLTYPE_SINGLE,
            target: address(0), // Any contract
            selector: bytes4(keccak256("swapExactTokensForTokens(uint256,uint256,address[],address,uint256)")),
            valueLimit: 0,
            dailyLimit: 2000 * 10**18, // Max 2000 tokens per day
            rules: new ParamRule[](0) // No additional rules for now
        });
        
        // Permission 4: Block dangerous functions (like selfdestruct, delegatecall)
        permissions[3] = Permission({
            callType: CALLTYPE_DELEGATECALL,
            target: address(0), // Any contract
            selector: bytes4(0), // Any function
            valueLimit: 0,
            dailyLimit: 0, // No daily limit for blocked functions
            rules: new ParamRule[](0) // This will be blocked by the policy logic
        });
        
        // Encode permissions for installation
        bytes memory installData = abi.encode(policyId, permissions);
        
        console.log("Policy ID:", vm.toString(policyId));
        console.log("Install data length:", installData.length);
        console.log("Number of permissions:", permissions.length);
        
        // Log the permissions for reference
        for (uint256 i = 0; i < permissions.length; i++) {
            console.log("Permission", i, ":");
            console.log("  CallType:", uint256(uint8(CallType.unwrap(permissions[i].callType))));
            console.log("  Target:", permissions[i].target);
            console.log("  Selector:", vm.toString(permissions[i].selector));
            console.log("  ValueLimit:", permissions[i].valueLimit);
            console.log("  Rules count:", permissions[i].rules.length);
        }
        
        console.log("Deployment successful!");
        console.log("To install this policy on a wallet:");
        console.log("1. Use the wallet's module installation function");
        console.log("2. Pass the CallPolicy address:", address(callPolicy));
        console.log("3. Pass the installData with the encoded permissions");
        console.log("4. This will restrict delegated keys to only allowed operations");
    }
}
