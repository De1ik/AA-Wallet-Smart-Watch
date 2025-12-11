// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "forge-std/Script.sol";
import "../src/CallPolicy_v3.sol";

/// @dev Simple deployment script for CallPolicy v3.
///      Expects PRIVATE_KEY to be set in the environment.
contract DeployCallPolicyV3 is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        console.log("Deploying CallPolicy_v3 with account:", deployer);
        console.log("Account balance:", deployer.balance);

        vm.startBroadcast(deployerKey);
        CallPolicy policy = new CallPolicy();
        vm.stopBroadcast();

        console.log("CallPolicy_v3 deployed at:", address(policy));
    }
}
