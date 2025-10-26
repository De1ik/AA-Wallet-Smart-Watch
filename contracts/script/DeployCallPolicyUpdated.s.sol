// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "forge-std/Script.sol";
import "../src/CallPolicy.sol";

contract DeployCallPolicyUpdated is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying CallPolicy Updated (v2) with account:", deployer);
        console.log("Account balance:", deployer.balance);
        
        vm.startBroadcast(deployerPrivateKey);
        
        CallPolicy callPolicy = new CallPolicy();
        
        vm.stopBroadcast();
        
        console.log("CallPolicy Updated deployed at:", address(callPolicy));
        
        // Verify deployment
        require(address(callPolicy) != address(0), "Deployment failed");
        console.log("Deployment successful!");
        
        // Log new features
        console.log("\n=== NEW FEATURES IN V2 ===");
        console.log("Daily limits support");
        console.log("Easy permission enumeration");
        console.log("Permission updates by owner");
        console.log("Enhanced events and transparency");
        console.log("Complete ParamCondition support");
        
        console.log("\n=== USAGE EXAMPLES ===");
        console.log("1. Install policy with daily limits");
        console.log("2. Query permissions: getPermissionsCount(), getPermissionByIndex()");
        console.log("3. Update limits: updatePermissionLimits()");
        console.log("4. Monitor daily usage: dailyUsed()");
    }
}
