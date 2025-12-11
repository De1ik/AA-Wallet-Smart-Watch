// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Test.sol";
import {CallPolicy, Permission, ParamRule, ParamCondition, Status} from "../src/CallPolicy_v3.sol";
import {ExecLib} from "kernel/utils/ExecLib.sol";
import {Execution} from "kernel/types/Structs.sol";
import {ExecMode, ExecModePayload, CallType} from "kernel/types/Types.sol";
import {
    CALLTYPE_SINGLE,
    CALLTYPE_BATCH,
    CALLTYPE_DELEGATECALL,
    EXECTYPE_DEFAULT,
    EXEC_MODE_DEFAULT
} from "kernel/types/Constants.sol";
import {PackedUserOperation} from "kernel/interfaces/PackedUserOperation.sol";
import {IERC7579Account} from "kernel/interfaces/IERC7579Account.sol";

contract CallPolicyTest is Test {
    CallPolicy internal policy;
    bytes32 internal policyId = keccak256("CALL_POLICY_TEST");
    address internal wallet = makeAddr("wallet");
    address internal recipient = makeAddr("recipient");
    address internal otherRecipient = makeAddr("otherRecipient");
    address internal token = makeAddr("token");
    address internal tokenB = makeAddr("tokenB");
    address internal fallbackTarget = makeAddr("fallbackTarget");
    address internal delegatedKey = makeAddr("delegatedKey");

    bytes4 internal constant TRANSFER_SELECTOR = 0xa9059cbb;
    bytes4 internal constant TRANSFER_FROM_SELECTOR = 0x23b872dd;
    bytes4 internal constant FALLBACK_SELECTOR = bytes4(keccak256("doSomething(uint256)"));
    bytes32 internal constant policyIdWithRule = keccak256("CALL_POLICY_WITH_RULE");

    function setUp() public {
        policy = new CallPolicy();
        _installPolicy();

        // Default limits/recipients
        vm.prank(wallet);
        policy.setTokenLimit(
            policyId,
            wallet,
            _toArray(address(0)),
            _toArray(true),
            _toArray(10 ether),
            _toArray(50 ether)
        );
        vm.prank(wallet);
        policy.setTokenLimit(
            policyId,
            wallet,
            _toArray(token),
            _toArray(true),
            _toArray(100 ether),
            _toArray(150 ether)
        );
        vm.prank(wallet);
        policy.setRecipientAllowed(policyId, wallet, _toArray(recipient), _toArray(true));
    }

    // --- happy paths ---

    function testNativeTransferPassesLimitsAndRecipient() public {
        PackedUserOperation memory op = _buildSingleUserOp(recipient, 1 ether, "");

        vm.prank(wallet);
        uint256 result = policy.checkUserOpPolicy(policyId, op);
        assertEq(result, 0);
    }

    function testErc20TransferPassesLimitsAndRecipient() public {
        bytes memory callData = abi.encodeWithSelector(TRANSFER_SELECTOR, recipient, 50 ether);
        PackedUserOperation memory op = _buildSingleUserOp(token, 0, callData);

        vm.prank(wallet);
        uint256 result = policy.checkUserOpPolicy(policyId, op);
        assertEq(result, 0);
    }

    function testBatchUsesSamePermissionChecks() public {
        Execution[] memory exec = new Execution[](2);
        exec[0] = Execution({target: token, value: 0, callData: abi.encodeWithSelector(TRANSFER_SELECTOR, recipient, 1 ether)});
        exec[1] = Execution({target: token, value: 0, callData: abi.encodeWithSelector(TRANSFER_SELECTOR, recipient, 2 ether)});

        ExecMode mode = ExecLib.encodeSimpleBatch();

        bytes memory execution = ExecLib.encodeBatch(exec);
        bytes memory accountCallData = abi.encodeWithSelector(IERC7579Account.execute.selector, mode, execution);
        PackedUserOperation memory op = _buildUserOp(accountCallData);

        vm.prank(wallet);
        uint256 result = policy.checkUserOpPolicy(policyId, op);
        assertEq(result, 0);
    }

    // --- limit/restriction failures ---

    function testNativeTransferTxLimitExceeded() public {
        vm.prank(wallet);
        policy.setTokenLimit(
            policyId,
            wallet,
            _toArray(address(0)),
            _toArray(true),
            _toArray(0.5 ether),
            _toArray(50 ether)
        );

        PackedUserOperation memory op = _buildSingleUserOp(recipient, 1 ether, "");

        vm.prank(wallet);
        vm.expectRevert(abi.encodeWithSelector(CallPolicy.TokenTxLimitExceeded.selector, address(0), 1 ether, 0.5 ether));
        policy.checkUserOpPolicy(policyId, op);
    }

    function testNativeTransferRecipientNotAllowed() public {
        PackedUserOperation memory op = _buildSingleUserOp(otherRecipient, 1 ether, "");

        vm.prank(wallet);
        vm.expectRevert(abi.encodeWithSelector(CallPolicy.RecipientNotAllowed.selector, address(0), otherRecipient));
        policy.checkUserOpPolicy(policyId, op);
    }

    function testErc20TransferTokenNotAllowed() public {
        // tokenB not enabled -> should revert
        bytes memory callData = abi.encodeWithSelector(TRANSFER_SELECTOR, recipient, 1 ether);
        PackedUserOperation memory op = _buildSingleUserOp(tokenB, 0, callData);

        vm.prank(wallet);
        vm.expectRevert(abi.encodeWithSelector(CallPolicy.TokenNotAllowed.selector, tokenB));
        policy.checkUserOpPolicy(policyId, op);
    }

    function testErc20TransferDailyLimitExceeded() public {
        vm.prank(wallet);
        policy.setTokenLimit(
            policyId,
            wallet,
            _toArray(token),
            _toArray(true),
            _toArray(100 ether),
            _toArray(60 ether)
        );

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

    function testOnlyAssetTransfersAllowed() public {
        bytes memory callData = abi.encodeWithSelector(FALLBACK_SELECTOR, uint256(1));
        PackedUserOperation memory op = _buildSingleUserOp(fallbackTarget, 0, callData);

        vm.prank(wallet);
        vm.expectRevert(CallPolicy.OnlyAssetTransfersAllowed.selector);
        policy.checkUserOpPolicy(policyId, op);
    }

    // --- validation on setters and status ---

    function testInstallEmptyPermissionsReverts() public {
        vm.expectRevert(CallPolicy.EmptyPermissions.selector);
        policy.onInstall(abi.encodePacked(bytes32("ID"), abi.encode(new Permission[](0))));
    }

    function testInstallInvalidDelegatedKeyReverts() public {
        Permission[] memory perms = new Permission[](1);
        perms[0] = Permission({
            callType: CALLTYPE_SINGLE,
            target: address(0),
            delegatedKey: address(0),
            selector: bytes4(0),
            rules: new ParamRule[](0)
        });

        vm.expectRevert(CallPolicy.InvalidDelegatedKey.selector);
        policy.onInstall(abi.encodePacked(bytes32("ID"), abi.encode(perms)));
    }

    function testInstallInconsistentDelegatedKeyReverts() public {
        Permission[] memory perms = new Permission[](2);
        perms[0] = Permission({
            callType: CALLTYPE_SINGLE,
            target: address(0),
            delegatedKey: delegatedKey,
            selector: bytes4(0),
            rules: new ParamRule[](0)
        });
        perms[1] = Permission({
            callType: CALLTYPE_SINGLE,
            target: address(0),
            delegatedKey: makeAddr("otherKey"),
            selector: TRANSFER_SELECTOR,
            rules: new ParamRule[](0)
        });

        vm.expectRevert(CallPolicy.InconsistentDelegatedKey.selector);
        policy.onInstall(abi.encodePacked(bytes32("ID2"), abi.encode(perms)));
    }

    function testInstallDuplicatePermissionReverts() public {
        // Duplicate permission within the same install payload
        Permission[] memory perms = new Permission[](2);
        perms[0] = Permission({
            callType: CALLTYPE_SINGLE,
            target: address(0),
            delegatedKey: delegatedKey,
            selector: bytes4(0),
            rules: new ParamRule[](0)
        });
        perms[1] = Permission({
            callType: CALLTYPE_SINGLE,
            target: address(0),
            delegatedKey: delegatedKey,
            selector: bytes4(0),
            rules: new ParamRule[](0)
        });

        vm.expectRevert(CallPolicy.DuplicatePermission.selector);
        policy.onInstall(abi.encodePacked(bytes32("DUPLICATE"), abi.encode(perms)));
    }

    function testInstallPolicyAlreadyInstalledReverts() public {
        Permission[] memory perms = new Permission[](1);
        perms[0] = Permission({
            callType: CALLTYPE_SINGLE,
            target: address(0),
            delegatedKey: delegatedKey,
            selector: bytes4(0),
            rules: new ParamRule[](0)
        });

        vm.prank(wallet);
        vm.expectRevert();
        policy.onInstall(abi.encodePacked(policyId, abi.encode(perms)));
    }

    function testSetTokenLimitLengthMismatch() public {
        vm.prank(wallet);
        vm.expectRevert(CallPolicy.LengthMismatch.selector);
        policy.setTokenLimit(policyId, wallet, _toArray(token), _toArray(true), new uint256[](0), new uint256[](0));
    }

    function testSetTokenLimitDoesNotRequireLivePolicy() public {
        // Contract does not gate this call on status; a new wallet can set limits for its id.
        address newWallet = makeAddr("newWallet");
        vm.prank(newWallet);
        policy.setTokenLimit(policyId, newWallet, _toArray(token), _toArray(true), _toArray(1), _toArray(1));

        (bool enabled, uint256 txLimit, uint256 dailyLimit) = policy.tokenLimits(newWallet, policyId, token);
        assertTrue(enabled);
        assertEq(txLimit, 1);
        assertEq(dailyLimit, 1);
    }

    function testSetTokenLimitOnlyWallet() public {
        vm.expectRevert(CallPolicy.NotWallet.selector);
        policy.setTokenLimit(policyId, wallet, _toArray(token), _toArray(true), _toArray(1), _toArray(1));
    }

    function testSetTokenLimitDisableRemovesAllowance() public {
        vm.prank(wallet);
        policy.setTokenLimit(policyId, wallet, _toArray(token), _toArray(false), _toArray(uint256(0)), _toArray(uint256(0)));
        (bool enabled,,) = policy.tokenLimits(wallet, policyId, token);
        assertFalse(enabled);
    }

    function testSetTokenLimitRemovalDisablesRemovedToken() public {
        // enable two tokens then disable one; removed token should revert on use
        address tokenC = makeAddr("tokenC");
        address[] memory tokens = new address[](2);
        tokens[0] = token;
        tokens[1] = tokenC;
        bool[] memory enabled = new bool[](2);
        enabled[0] = true;
        enabled[1] = true;
        uint256[] memory txLimits = new uint256[](2);
        txLimits[0] = 5;
        txLimits[1] = 5;
        uint256[] memory dailyLimits = new uint256[](2);
        dailyLimits[0] = 10;
        dailyLimits[1] = 10;

        vm.prank(wallet);
        policy.setTokenLimit(policyId, wallet, tokens, enabled, txLimits, dailyLimits);

        enabled[1] = false;
        vm.prank(wallet);
        policy.setTokenLimit(policyId, wallet, tokens, enabled, txLimits, dailyLimits);

        bytes memory callData = abi.encodeWithSelector(TRANSFER_SELECTOR, recipient, 1 ether);
        PackedUserOperation memory op = _buildSingleUserOp(tokenC, 0, callData);
        vm.prank(wallet);
        vm.expectRevert(abi.encodeWithSelector(CallPolicy.TokenNotAllowed.selector, tokenC));
        policy.checkUserOpPolicy(policyId, op);
    }

    function testSetTokenLimitMultipleTokens() public {
        address tokenC = makeAddr("tokenC");
        address[] memory tokens = new address[](2);
        tokens[0] = token;
        tokens[1] = tokenC;
        bool[] memory enabled = new bool[](2);
        enabled[0] = true;
        enabled[1] = true;
        uint256[] memory txLimits = new uint256[](2);
        txLimits[0] = 5 ether;
        txLimits[1] = 7 ether;
        uint256[] memory dailyLimits = new uint256[](2);
        dailyLimits[0] = 10 ether;
        dailyLimits[1] = 14 ether;

        vm.prank(wallet);
        policy.setTokenLimit(policyId, wallet, tokens, enabled, txLimits, dailyLimits);

        (bool enabledA, uint256 txA, uint256 dailyA) = policy.tokenLimits(wallet, policyId, token);
        (bool enabledB, uint256 txB, uint256 dailyB) = policy.tokenLimits(wallet, policyId, tokenC);
        assertTrue(enabledA);
        assertEq(txA, 5 ether);
        assertEq(dailyA, 10 ether);
        assertTrue(enabledB);
        assertEq(txB, 7 ether);
        assertEq(dailyB, 14 ether);
    }

    function testSetRecipientAllowedOnlyWallet() public {
        vm.expectRevert(CallPolicy.NotWallet.selector);
        policy.setRecipientAllowed(policyId, wallet, _toArray(recipient), _toArray(true));
    }

    function testSetRecipientAllowedLengthMismatch() public {
        vm.prank(wallet);
        vm.expectRevert(CallPolicy.LengthMismatch.selector);
        policy.setRecipientAllowed(policyId, wallet, new address[](0), new bool[](1));
    }

    function testCheckUserOpWithoutPermissionsRevertsInvalidCallData() public {
        // Uninstall clears permissions; policy does not gate by status when checking userOps.
        vm.prank(wallet);
        policy.onUninstall(abi.encodePacked(policyId, bytes("")));

        PackedUserOperation memory op = _buildSingleUserOp(recipient, 1 ether, "");
        vm.prank(wallet);
        vm.expectRevert(CallPolicy.InvalidCallData.selector);
        policy.checkUserOpPolicy(policyId, op);
    }

    function testCheckUserOpInvalidSelector() public {
        PackedUserOperation memory op = _buildUserOp(hex"deadbeef");
        vm.prank(wallet);
        vm.expectRevert(CallPolicy.InvalidSelector.selector);
        policy.checkUserOpPolicy(policyId, op);
    }

    function testCheckUserOpInvalidCallTypeReverts() public {
        // Craft ExecMode with invalid callType (0xff)
        ExecMode mode = ExecLib.encode(
            CallType.wrap(0xff),
            EXECTYPE_DEFAULT,
            EXEC_MODE_DEFAULT,
            ExecModePayload.wrap(bytes22(0))
        );
        bytes memory accountCallData = abi.encodeWithSelector(IERC7579Account.execute.selector, mode, bytes(""));
        PackedUserOperation memory op = _buildUserOp(accountCallData);

        vm.prank(wallet);
        vm.expectRevert(); // some clients drop revert data on malformed mode
        policy.checkUserOpPolicy(policyId, op);
    }

    function testCheckUserOpDelegateCallReverts() public {
        bytes memory delegateData = abi.encodeWithSelector(FALLBACK_SELECTOR, uint256(1));
        bytes memory execution = abi.encodePacked(fallbackTarget, delegateData);
        ExecMode mode = ExecLib.encode(
            CALLTYPE_DELEGATECALL,
            EXECTYPE_DEFAULT,
            EXEC_MODE_DEFAULT,
            ExecModePayload.wrap(bytes22(0))
        );
        bytes memory accountCallData = abi.encodeWithSelector(IERC7579Account.execute.selector, mode, execution);
        PackedUserOperation memory op = _buildUserOp(accountCallData);

        vm.prank(wallet);
        vm.expectRevert(CallPolicy.InvalidCallData.selector);
        policy.checkUserOpPolicy(policyId, op);
    }

    function testParamRuleEqualMustMatch() public {
        // New policy id with a rule enforcing amount == 1 ether
        Permission[] memory perms = new Permission[](1);
        ParamRule[] memory rules = new ParamRule[](1);
        rules[0] = ParamRule({condition: ParamCondition.EQUAL, offset: 32, params: _toArray(bytes32(uint256(1 ether)))});
        perms[0] = Permission({
            callType: CALLTYPE_SINGLE,
            target: token,
            delegatedKey: delegatedKey,
            selector: TRANSFER_SELECTOR,
            rules: rules
        });

        bytes memory installData = abi.encodePacked(policyIdWithRule, abi.encode(perms));
        vm.prank(wallet);
        policy.onInstall(installData);

        vm.prank(wallet);
        policy.setTokenLimit(policyIdWithRule, wallet, _toArray(token), _toArray(true), _toArray(100 ether), _toArray(150 ether));
        vm.prank(wallet);
        policy.setRecipientAllowed(policyIdWithRule, wallet, _toArray(recipient), _toArray(true));

        // wrong amount should fail rule
        bytes memory callData = abi.encodeWithSelector(TRANSFER_SELECTOR, recipient, 2 ether);
        PackedUserOperation memory op = _buildSingleUserOp(token, 0, callData);
        vm.prank(wallet);
        vm.expectRevert(CallPolicy.CallViolatesParamRule.selector);
        policy.checkUserOpPolicy(policyIdWithRule, op);

        // correct amount passes
        bytes memory okCalldata = abi.encodeWithSelector(TRANSFER_SELECTOR, recipient, 1 ether);
        PackedUserOperation memory okOp = _buildSingleUserOp(token, 0, okCalldata);
        vm.prank(wallet);
        uint256 result = policy.checkUserOpPolicy(policyIdWithRule, okOp);
        assertEq(result, 0);
    }

    function testParamRuleOneOfMustMatch() public {
        Permission[] memory perms = new Permission[](1);
        ParamRule[] memory rules = new ParamRule[](1);
        bytes32[] memory options = new bytes32[](2);
        options[0] = bytes32(uint256(1 ether));
        options[1] = bytes32(uint256(2 ether));
        rules[0] = ParamRule({condition: ParamCondition.ONE_OF, offset: 32, params: options});
        perms[0] = Permission({
            callType: CALLTYPE_SINGLE,
            target: token,
            delegatedKey: delegatedKey,
            selector: TRANSFER_SELECTOR,
            rules: rules
        });

        bytes32 idOneOf = keccak256("ONE_OF");
        vm.prank(wallet);
        policy.onInstall(abi.encodePacked(idOneOf, abi.encode(perms)));
        vm.prank(wallet);
        policy.setTokenLimit(idOneOf, wallet, _toArray(token), _toArray(true), _toArray(100 ether), _toArray(150 ether));
        vm.prank(wallet);
        policy.setRecipientAllowed(idOneOf, wallet, _toArray(recipient), _toArray(true));

        // 3 ether not allowed
        bytes memory badCalldata = abi.encodeWithSelector(TRANSFER_SELECTOR, recipient, 3 ether);
        PackedUserOperation memory badOp = _buildSingleUserOp(token, 0, badCalldata);
        vm.prank(wallet);
        vm.expectRevert(CallPolicy.CallViolatesParamRule.selector);
        policy.checkUserOpPolicy(idOneOf, badOp);

        // 2 ether allowed
        bytes memory okCalldata = abi.encodeWithSelector(TRANSFER_SELECTOR, recipient, 2 ether);
        PackedUserOperation memory okOp = _buildSingleUserOp(token, 0, okCalldata);
        vm.prank(wallet);
        uint256 result = policy.checkUserOpPolicy(idOneOf, okOp);
        assertEq(result, 0);
    }

    function testWildcardPermissionAllowsAnyTarget() public {
        Permission[] memory perms = new Permission[](1);
        perms[0] = Permission({
            callType: CALLTYPE_SINGLE,
            target: address(0), // wildcard
            delegatedKey: delegatedKey,
            selector: TRANSFER_SELECTOR,
            rules: new ParamRule[](0)
        });

        bytes32 wildcardId = keccak256("WILDCARD");
        vm.prank(wallet);
        policy.onInstall(abi.encodePacked(wildcardId, abi.encode(perms)));

        vm.prank(wallet);
        policy.setTokenLimit(wildcardId, wallet, _toArray(tokenB), _toArray(true), _toArray(100 ether), _toArray(150 ether));
        vm.prank(wallet);
        policy.setRecipientAllowed(wildcardId, wallet, _toArray(recipient), _toArray(true));

        bytes memory callData = abi.encodeWithSelector(TRANSFER_SELECTOR, recipient, 1 ether);
        PackedUserOperation memory op = _buildSingleUserOp(tokenB, 0, callData);
        vm.prank(wallet);
        uint256 result = policy.checkUserOpPolicy(wildcardId, op);
        assertEq(result, 0);
    }

    function testTransferFromUsesRecipientIndex() public {
        bytes memory callData = abi.encodeWithSelector(TRANSFER_FROM_SELECTOR, makeAddr("from"), recipient, 5 ether);
        PackedUserOperation memory op = _buildSingleUserOp(token, 0, callData);

        vm.prank(wallet);
        uint256 result = policy.checkUserOpPolicy(policyId, op);
        assertEq(result, 0);
    }

    function testCheckSignaturePolicyNotLiveReverts() public {
        vm.expectRevert(CallPolicy.NotLive.selector);
        policy.checkSignaturePolicy(policyId, address(0), bytes32(0), "");
    }

    function testCheckSignaturePolicyLiveOk() public {
        vm.prank(wallet);
        uint256 result = policy.checkSignaturePolicy(policyId, address(0), bytes32(0), "");
        assertEq(result, 0);
    }

    function testRecipientRemovalDisablesRecipient() public {
        vm.prank(wallet);
        policy.setRecipientAllowed(policyId, wallet, _toArray(recipient), _toArray(false));
        bool allowed = policy.recipientAllowed(wallet, policyId, recipient);
        assertFalse(allowed);
    }

    function testDelegatedKeysListAndUninstallClears() public {
        address[] memory keys = policy.delegatedKeysList(wallet);
        assertEq(keys.length, 1);
        assertEq(keys[0], delegatedKey);

        vm.prank(wallet);
        policy.onUninstall(abi.encodePacked(policyId, bytes("")));

        address[] memory keysAfter = policy.delegatedKeysList(wallet);
        assertEq(keysAfter.length, 0);
        assertEq(uint8(policy.status(wallet, policyId)), uint8(Status.Deprecated));
    }

    function testIsInitializedFalseForZeroId() public view {
        bool initialized = policy.isInitialized(wallet);
        assertFalse(initialized);
    }

    function testDecodePermissionsHelper() public view {
        Permission[] memory perms = new Permission[](1);
        perms[0] = Permission({
            callType: CALLTYPE_SINGLE,
            target: address(0),
            delegatedKey: delegatedKey,
            selector: TRANSFER_SELECTOR,
            rules: new ParamRule[](0)
        });
        Permission[] memory decoded = policy._decodePermissions(abi.encode(perms));
        assertEq(decoded.length, 1);
        assertEq(decoded[0].delegatedKey, delegatedKey);
        assertEq(decoded[0].selector, TRANSFER_SELECTOR);
    }

    function testTokenDailyUsageIsTracked() public {
        uint256 day = block.timestamp / 1 days;
        assertEq(policy.tokenDailyUsed(wallet, policyId, token, day), 0);

        bytes memory callData = abi.encodeWithSelector(TRANSFER_SELECTOR, recipient, 5 ether);
        PackedUserOperation memory op = _buildSingleUserOp(token, 0, callData);
        vm.prank(wallet);
        policy.checkUserOpPolicy(policyId, op);

        assertEq(policy.tokenDailyUsed(wallet, policyId, token, day), 5 ether);
    }

    // --- helpers ---

    function _installPolicy() internal {
        Permission[] memory permissions = new Permission[](4);
        permissions[0] = Permission({
            callType: CALLTYPE_SINGLE,
            target: address(0),
            delegatedKey: delegatedKey,
            selector: bytes4(0),
            rules: new ParamRule[](0)
        });
        permissions[1] = Permission({
            callType: CALLTYPE_SINGLE,
            target: address(0),
            delegatedKey: delegatedKey,
            selector: TRANSFER_SELECTOR,
            rules: new ParamRule[](0)
        });
        permissions[2] = Permission({
            callType: CALLTYPE_SINGLE,
            target: address(0),
            delegatedKey: delegatedKey,
            selector: TRANSFER_FROM_SELECTOR,
            rules: new ParamRule[](0)
        });
        permissions[3] = Permission({
            callType: CALLTYPE_SINGLE,
            target: fallbackTarget,
            delegatedKey: delegatedKey,
            selector: FALLBACK_SELECTOR,
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
        op = _buildUserOp(accountCallData);
    }

    function _buildUserOp(bytes memory accountCallData) internal pure returns (PackedUserOperation memory op) {
        op = PackedUserOperation({
            sender: address(0),
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

    function _toArray(address a) internal pure returns (address[] memory arr) {
        arr = new address[](1);
        arr[0] = a;
    }

    function _toArray(bool a) internal pure returns (bool[] memory arr) {
        arr = new bool[](1);
        arr[0] = a;
    }

    function _toArray(uint256 a) internal pure returns (uint256[] memory arr) {
        arr = new uint256[](1);
        arr[0] = a;
    }

    function _toArray(bytes32 a) internal pure returns (bytes32[] memory arr) {
        arr = new bytes32[](1);
        arr[0] = a;
    }
}
