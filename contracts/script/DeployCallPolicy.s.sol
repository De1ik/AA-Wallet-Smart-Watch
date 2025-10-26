// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Script.sol";
import "../src/CallPolicy.sol";

contract DeployCallPolicy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying CallPolicy with account:", deployer);
        console.log("Account balance:", deployer.balance);
        
        vm.startBroadcast(deployerPrivateKey);
        
        CallPolicy callPolicy = new CallPolicy();
        
        vm.stopBroadcast();
        
        console.log("CallPolicy deployed at:", address(callPolicy));
        
        // Verify deployment
        require(address(callPolicy) != address(0), "Deployment failed");
        console.log("Deployment successful!");
    }
}
