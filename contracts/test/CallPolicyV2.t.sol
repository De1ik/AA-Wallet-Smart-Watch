// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "forge-std/Test.sol";
import {CallPolicy, Permission, ParamRule} from "../src/CallPolicy_v2.sol";
import {ExecLib} from "kernel/utils/ExecLib.sol";
import {ExecMode} from "kernel/types/Types.sol";
import {PackedUserOperation} from "kernel/interfaces/PackedUserOperation.sol";
import {IERC7579Account} from "kernel/interfaces/IERC7579Account.sol";
import {CALLTYPE_SINGLE} from "kernel/types/Constants.sol";

contract CallPolicyV2Test is Test {
    CallPolicy internal policy;
    bytes32 internal policyId = keccak256("CALL_POLICY_V2_TEST");
    address internal wallet = makeAddr("wallet");
    address internal recipient = makeAddr("recipient");
    address internal otherRecipient = makeAddr("otherRecipient");
    address internal token = makeAddr("token");
    address internal tokenB = makeAddr("tokenB");
    address internal fallbackTarget = makeAddr("fallbackTarget");

    bytes4 internal constant TRANSFER_SELECTOR = 0xa9059cbb;
    bytes4 internal constant TRANSFER_FROM_SELECTOR = 0x23b872dd;
    bytes4 internal constant FALLBACK_SELECTOR = bytes4(keccak256("doSomething(uint256)"));

    function setUp() public {
        vm.warp(1000);
        policy = new CallPolicy();

        _installPolicy();

        vm.prank(wallet);
        policy.setTokenLimit(policyId, wallet, address(0), true, 5 ether, 10 ether);
        vm.prank(wallet);
        policy.setTokenLimit(policyId, wallet, token, true, 100 ether, 150 ether);
        vm.prank(wallet);
        policy.setTokenLimit(policyId, wallet, tokenB, true, 100 ether, 150 ether);

        vm.prank(wallet);
        policy.setRecipientAllowed(policyId, wallet, recipient, true);
    }

    function testNativeTransferPassesLimitsAndRecipient() public {
        uint256 amount = 1 ether;
        PackedUserOperation memory op = _buildSingleUserOp(recipient, amount, "");

        vm.prank(wallet);
        uint256 result = policy.checkUserOpPolicy(policyId, op);
        assertEq(result, 0);
    }

    function testNativeTransferTxLimitExceeded() public {
        vm.prank(wallet);
        policy.setTokenLimit(policyId, wallet, address(0), true, 0.5 ether, 10 ether);

        PackedUserOperation memory op = _buildSingleUserOp(recipient, 1 ether, "");

        vm.prank(wallet);
        vm.expectRevert(
            abi.encodeWithSelector(CallPolicy.TokenTxLimitExceeded.selector, address(0), 1 ether, 0.5 ether)
        );
        policy.checkUserOpPolicy(policyId, op);
    }

    function testNativeTransferRecipientNotAllowed() public {
        PackedUserOperation memory op = _buildSingleUserOp(otherRecipient, 1 ether, "");

        vm.prank(wallet);
        vm.expectRevert(
            abi.encodeWithSelector(CallPolicy.RecipientNotAllowed.selector, address(0), otherRecipient)
        );
        policy.checkUserOpPolicy(policyId, op);
    }

    function testErc20TransferPassesLimitsAndRecipient() public {
        uint256 amount = 50 ether;
        bytes memory callData = abi.encodeWithSelector(TRANSFER_SELECTOR, recipient, amount);
        PackedUserOperation memory op = _buildSingleUserOp(token, 0, callData);

        vm.prank(wallet);
        uint256 result = policy.checkUserOpPolicy(policyId, op);
        assertEq(result, 0);
    }

    function testErc20TransferTxLimitExceeded() public {
        vm.prank(wallet);
        policy.setTokenLimit(policyId, wallet, token, true, 10 ether, 150 ether);

        uint256 amount = 50 ether;
        bytes memory callData = abi.encodeWithSelector(TRANSFER_SELECTOR, recipient, amount);
        PackedUserOperation memory op = _buildSingleUserOp(token, 0, callData);

        vm.prank(wallet);
        vm.expectRevert(
            abi.encodeWithSelector(CallPolicy.TokenTxLimitExceeded.selector, token, amount, 10 ether)
        );
        policy.checkUserOpPolicy(policyId, op);
    }

    function testErc20TransferDailyLimitExceeded() public {
        vm.prank(wallet);
        policy.setTokenLimit(policyId, wallet, token, true, 100 ether, 60 ether);

        bytes memory callData = abi.encodeWithSelector(TRANSFER_SELECTOR, recipient, 40 ether);
        PackedUserOperation memory op1 = _buildSingleUserOp(token, 0, callData);
        vm.prank(wallet);
        policy.checkUserOpPolicy(policyId, op1);

        bytes memory callData2 = abi.encodeWithSelector(TRANSFER_SELECTOR, recipient, 30 ether);
        PackedUserOperation memory op2 = _buildSingleUserOp(token, 0, callData2);

        vm.prank(wallet);
        vm.expectRevert(
            abi.encodeWithSelector(CallPolicy.TokenDailyLimitExceeded.selector, token, 30 ether, 40 ether, 60 ether)
        );
        policy.checkUserOpPolicy(policyId, op2);
    }

    function testErc20TransferRecipientNotAllowed() public {
        bytes memory callData = abi.encodeWithSelector(TRANSFER_SELECTOR, otherRecipient, 10 ether);
        PackedUserOperation memory op = _buildSingleUserOp(token, 0, callData);

        vm.prank(wallet);
        vm.expectRevert(
            abi.encodeWithSelector(CallPolicy.RecipientNotAllowed.selector, token, otherRecipient)
        );
        policy.checkUserOpPolicy(policyId, op);
    }

    function testErc20TransferTokenNotAllowed() public {
        vm.prank(wallet);
        policy.setTokenLimit(policyId, wallet, tokenB, false, 0, 0);

        bytes memory callData = abi.encodeWithSelector(TRANSFER_SELECTOR, recipient, 1 ether);
        PackedUserOperation memory op = _buildSingleUserOp(tokenB, 0, callData);

        vm.prank(wallet);
        vm.expectRevert(abi.encodeWithSelector(CallPolicy.TokenNotAllowed.selector, tokenB));
        policy.checkUserOpPolicy(policyId, op);
    }

    function testErc20TransferFromUsesRecipientAndAmount() public {
        bytes memory callData = abi.encodeWithSelector(
            TRANSFER_FROM_SELECTOR, makeAddr("from"), recipient, 25 ether
        );
        PackedUserOperation memory op = _buildSingleUserOp(token, 0, callData);

        vm.prank(wallet);
        uint256 result = policy.checkUserOpPolicy(policyId, op);
        assertEq(result, 0);

        // changing recipient should fail because whitelist is checked on the `to` parameter
        bytes memory badCalldata = abi.encodeWithSelector(
            TRANSFER_FROM_SELECTOR, makeAddr("from"), otherRecipient, 25 ether
        );
        PackedUserOperation memory badOp = _buildSingleUserOp(token, 0, badCalldata);

        vm.prank(wallet);
        vm.expectRevert(
            abi.encodeWithSelector(CallPolicy.RecipientNotAllowed.selector, token, otherRecipient)
        );
        policy.checkUserOpPolicy(policyId, badOp);
    }

    function testFallbackValueLimitIsEnforced() public {
        vm.prank(wallet);
        policy.updatePermissionLimits(policyId, wallet, CALLTYPE_SINGLE, fallbackTarget, FALLBACK_SELECTOR, 1 ether, 2 ether);

        bytes memory callData = abi.encodeWithSelector(FALLBACK_SELECTOR, uint256(1));
        PackedUserOperation memory op = _buildSingleUserOp(fallbackTarget, 2 ether, callData);

        vm.prank(wallet);
        vm.expectRevert(CallPolicy.CallViolatesValueRule.selector);
        policy.checkUserOpPolicy(policyId, op);
    }

    function testFallbackDailyLimitIsTracked() public {
        vm.prank(wallet);
        policy.updatePermissionLimits(policyId, wallet, CALLTYPE_SINGLE, fallbackTarget, FALLBACK_SELECTOR, 2 ether, 2 ether);

        bytes memory callData = abi.encodeWithSelector(FALLBACK_SELECTOR, uint256(1));
        PackedUserOperation memory op1 = _buildSingleUserOp(fallbackTarget, 1 ether, callData);
        vm.prank(wallet);
        policy.checkUserOpPolicy(policyId, op1);

        PackedUserOperation memory op2 = _buildSingleUserOp(fallbackTarget, 1.5 ether, callData);
        vm.prank(wallet);
        vm.expectRevert(CallPolicy.CallViolatesDailyLimit.selector);
        policy.checkUserOpPolicy(policyId, op2);
    }

    // ---------------- helpers ----------------

    function _installPolicy() internal {
        Permission[] memory permissions = new Permission[](4);
        permissions[0] = Permission({
            callType: CALLTYPE_SINGLE,
            target: address(0),
            selector: bytes4(0),
            valueLimit: 0,
            dailyLimit: 0,
            rules: new ParamRule[](0)
        });
        permissions[1] = Permission({
            callType: CALLTYPE_SINGLE,
            target: address(0),
            selector: TRANSFER_SELECTOR,
            valueLimit: 0,
            dailyLimit: 0,
            rules: new ParamRule[](0)
        });
        permissions[2] = Permission({
            callType: CALLTYPE_SINGLE,
            target: address(0),
            selector: TRANSFER_FROM_SELECTOR,
            valueLimit: 0,
            dailyLimit: 0,
            rules: new ParamRule[](0)
        });
        permissions[3] = Permission({
            callType: CALLTYPE_SINGLE,
            target: fallbackTarget,
            selector: FALLBACK_SELECTOR,
            valueLimit: 2 ether,
            dailyLimit: 2 ether,
            rules: new ParamRule[](0)
        });

        bytes memory installData = abi.encodePacked(policyId, abi.encode(permissions));
        vm.prank(wallet);
        policy.onInstall(installData);
    }

    function _buildSingleUserOp(address target, uint256 value, bytes memory callData)
        internal
        pure
        returns (PackedUserOperation memory op)
    {
        ExecMode mode = ExecLib.encodeSimpleSingle();
        bytes memory execution = ExecLib.encodeSingle(target, value, callData);
        bytes memory accountCallData = abi.encodeWithSelector(IERC7579Account.execute.selector, mode, execution);

        op = PackedUserOperation({
            sender: target,
            nonce: 0,
            initCode: "",
            callData: accountCallData,
            accountGasLimits: bytes32(0),
            preVerificationGas: 0,
            gasFees: bytes32(0),
            paymasterAndData: "",
            signature: ""
        });
    }
}
