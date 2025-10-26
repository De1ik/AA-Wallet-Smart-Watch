// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Script.sol";
import "../src/CallPolicy.sol";
import "kernel/types/Constants.sol";

contract DeployCallPolicyWithPermissions is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying CallPolicy with permissions with account:", deployer);
        console.log("Account balance:", deployer.balance);
        
        vm.startBroadcast(deployerPrivateKey);
        
        CallPolicy callPolicy = new CallPolicy();
        
        vm.stopBroadcast();
        
        console.log("CallPolicy deployed at:", address(callPolicy));
        
        // Example: Install policy with sample permissions
        bytes32 policyId = keccak256("SAMPLE_POLICY");
        
        // Create sample permissions
        Permission[] memory permissions = new Permission[](2);
        
        // Permission 1: Allow calling transfer function on any ERC20 token
        permissions[0] = Permission({
            callType: CALLTYPE_SINGLE,
            target: address(0), // address(0) means any address
            selector: bytes4(keccak256("transfer(address,uint256)")),
            valueLimit: 0,
            dailyLimit: 0, // No daily limit for legacy compatibility
            rules: new ParamRule[](0)
        });
        
        // Permission 2: Allow calling approve function with value limit
        permissions[1] = Permission({
            callType: CALLTYPE_SINGLE,
            target: address(0), // address(0) means any address
            selector: bytes4(keccak256("approve(address,uint256)")),
            valueLimit: 0,
            dailyLimit: 0, // No daily limit for legacy compatibility
            rules: new ParamRule[](0)
        });
        
        // Encode permissions for installation
        bytes memory installData = abi.encode(policyId, permissions);
        
        console.log("Policy ID:", vm.toString(policyId));
        console.log("Install data length:", installData.length);
        
        // Note: The actual installation would be done by the wallet/module system
        // This is just showing how to prepare the data
        
        console.log("Deployment successful!");
        console.log("To install this policy, use the installData with the wallet's module system");
    }
}
