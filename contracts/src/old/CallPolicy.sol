// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "kernel/sdk/moduleBase/PolicyBase.sol";
import "kernel/utils/ExecLib.sol";
import "kernel/types/Constants.sol";
import {IERC7579Account} from "kernel/interfaces/IERC7579Account.sol";

enum ParamCondition {
    EQUAL,
    GREATER_THAN,
    LESS_THAN,
    GREATER_THAN_OR_EQUAL,
    LESS_THAN_OR_EQUAL,
    NOT_EQUAL,
    ONE_OF
}

enum Status {
    NA,
    Live,
    Deprecated
}

struct ParamRule {
    ParamCondition condition;
    uint64 offset;
    bytes32[] params;
}

struct Permission {
    CallType callType;
    address target;
    bytes4 selector;
    uint256 valueLimit;
    uint256 dailyLimit;
    ParamRule[] rules;
}

struct StoredPermission {
    uint256 valueLimit;
    uint256 dailyLimit;
    ParamRule[] rules;
    address owner;     // кто установил ограничения
    bool exists;
}

contract CallPolicy is PolicyBase {
    error InvalidCallType();
    error InvalidCallData();
    error CallViolatesParamRule();
    error CallViolatesValueRule();
    error CallViolatesDailyLimit();
    error NotPermissionOwner();

    mapping(address => uint256) public usedIds;
    mapping(bytes32 => mapping(address => Status)) public status;

    mapping(bytes32 => mapping(address => mapping(bytes32 => StoredPermission))) private storedPermissions;
    mapping(bytes32 => mapping(address => bytes32[])) private permissionHashesByOwner;
    mapping(bytes32 => mapping(address => mapping(bytes32 => mapping(uint256 => uint256)))) public dailyUsed;

    event PermissionInstalled(bytes32 indexed id, address indexed owner, bytes32 indexed permissionHash, uint256 valueLimit, uint256 dailyLimit);
    event PermissionUpdated(bytes32 indexed id, address indexed owner, bytes32 indexed permissionHash, uint256 newValueLimit, uint256 newDailyLimit);
    event PermissionRemoved(bytes32 indexed id, address indexed owner, bytes32 indexed permissionHash);

    // ---------------- GETTERS ----------------

    function getPermissionsCount(bytes32 id, address owner) external view returns (uint256) {
        return permissionHashesByOwner[id][owner].length;
    }

    function getPermissionByIndex(bytes32 id, address owner, uint256 index)
        external
        view
        returns (bytes32 permissionHash, uint256 valueLimit, uint256 dailyLimit, ParamRule[] memory rules)
    {
        require(index < permissionHashesByOwner[id][owner].length, "index OOB");
        permissionHash = permissionHashesByOwner[id][owner][index];
        StoredPermission storage sp = storedPermissions[id][owner][permissionHash];
        require(sp.exists, "no perm");
        return (permissionHash, sp.valueLimit, sp.dailyLimit, sp.rules);
    }

    function getPermission(bytes32 id, bytes32 permissionHash, address owner)
        external
        view
        returns (uint256 valueLimit, uint256 dailyLimit, ParamRule[] memory rules)
    {
        StoredPermission storage sp = storedPermissions[id][owner][permissionHash];
        require(sp.exists, "no perm");
        return (sp.valueLimit, sp.dailyLimit, sp.rules);
    }

    // ---------------- INSTALL ----------------

    function isInitialized(address wallet) external view override returns (bool) {
        return usedIds[wallet] > 0;
    }

    function _policyOninstall(bytes32 id, bytes calldata data) internal override {
        require(status[id][msg.sender] == Status.NA);

        Permission[] memory permissions = abi.decode(data, (Permission[]));
        for (uint256 i = 0; i < permissions.length; i++) {
            bytes32 permissionHash =
                keccak256(abi.encodePacked(permissions[i].callType, permissions[i].target, permissions[i].selector));

            require(!storedPermissions[id][msg.sender][permissionHash].exists, "duplicate");

            StoredPermission storage sp = storedPermissions[id][msg.sender][permissionHash];
            sp.valueLimit = permissions[i].valueLimit;
            sp.dailyLimit = permissions[i].dailyLimit;
            sp.owner = msg.sender;
            for (uint256 j = 0; j < permissions[i].rules.length; j++) {
                sp.rules.push(permissions[i].rules[j]);
            }
            sp.exists = true;

            permissionHashesByOwner[id][msg.sender].push(permissionHash);
            emit PermissionInstalled(id, msg.sender, permissionHash, sp.valueLimit, sp.dailyLimit);
        }

        status[id][msg.sender] = Status.Live;
        usedIds[msg.sender]++;
    }

    // ---------------- UPDATE LIMITS ----------------

    /// @notice Обновить valueLimit и/или dailyLimit для уже существующего разрешения
    /// @dev Доступно только владельцу, который изначально установил ограничения
    function updatePermissionLimits(
        bytes32 id,
        address wallet,
        CallType callType,
        address target,
        bytes4 selector,
        uint256 newValueLimit,
        uint256 newDailyLimit
    ) external {
        bytes32 permissionHash = keccak256(abi.encodePacked(callType, target, selector));
        StoredPermission storage sp = storedPermissions[id][wallet][permissionHash];
        require(sp.exists, "no such permission");
        require(sp.owner == msg.sender, "NotPermissionOwner");

        sp.valueLimit = newValueLimit;
        sp.dailyLimit = newDailyLimit;

        emit PermissionUpdated(id, msg.sender, permissionHash, newValueLimit, newDailyLimit);
    }

    // ---------------- UNINSTALL ----------------

    function _policyOnUninstall(bytes32 id, bytes calldata data) internal override {
        require(status[id][msg.sender] == Status.Live);
        Permission[] memory permissions = abi.decode(data, (Permission[]));

        for (uint256 i = 0; i < permissions.length; i++) {
            bytes32 permissionHash =
                keccak256(abi.encodePacked(permissions[i].callType, permissions[i].target, permissions[i].selector));
            if (storedPermissions[id][msg.sender][permissionHash].exists) {
                delete storedPermissions[id][msg.sender][permissionHash];
                _removePermissionIndex(id, msg.sender, permissionHash);
                emit PermissionRemoved(id, msg.sender, permissionHash);
            }
        }
        status[id][msg.sender] = Status.Deprecated;
        usedIds[msg.sender]--;
    }

    function _removePermissionIndex(bytes32 id, address owner, bytes32 permissionHash) internal {
        bytes32[] storage arr = permissionHashesByOwner[id][owner];
        for (uint256 i = 0; i < arr.length; i++) {
            if (arr[i] == permissionHash) {
                arr[i] = arr[arr.length - 1];
                arr.pop();
                break;
            }
        }
    }

    // ---------------- CHECKS ----------------

    function checkUserOpPolicy(bytes32 id, PackedUserOperation calldata userOp)
        external
        payable
        override
        returns (uint256)
    {
        require(bytes4(userOp.callData[0:4]) == IERC7579Account.execute.selector);
        ExecMode mode = ExecMode.wrap(bytes32(userOp.callData[4:36]));
        (CallType callType, ExecType execType,,) = ExecLib.decode(mode);

        bytes calldata executionCallData = userOp.callData;
        assembly {
            executionCallData.offset :=
                add(add(executionCallData.offset, 0x24), calldataload(add(executionCallData.offset, 0x24)))
            executionCallData.length := calldataload(sub(executionCallData.offset, 0x20))
        }

        if (callType == CALLTYPE_SINGLE) {
            (address target, uint256 value, bytes calldata callData) = ExecLib.decodeSingle(executionCallData);
            if (!_checkPermission(msg.sender, id, callType, target, callData, value)) {
                revert CallViolatesParamRule();
            }
        } else if (callType == CALLTYPE_BATCH) {
            Execution[] calldata exec = ExecLib.decodeBatch(executionCallData);
            for (uint256 i = 0; i < exec.length; i++) {
                if (!_checkPermission(msg.sender, id, CALLTYPE_SINGLE, exec[i].target, exec[i].callData, exec[i].value)) {
                    revert CallViolatesParamRule();
                }
            }
        } else if (callType == CALLTYPE_DELEGATECALL) {
            address target = address(bytes20(executionCallData[0:20]));
            bytes calldata callData = executionCallData[20:];
            if (!_checkPermission(msg.sender, id, callType, target, callData, 0)) {
                revert CallViolatesParamRule();
            }
        } else {
            revert InvalidCallType();
        }
    }

    function _checkPermission(
        address wallet,
        bytes32 id,
        CallType callType,
        address target,
        bytes calldata data,
        uint256 value
    ) internal returns (bool) {
        bytes4 selector = data.length == 0 ? bytes4(0x0) : bytes4(data[0:4]);
        bytes32 permissionHash = keccak256(abi.encodePacked(callType, target, selector));

        StoredPermission storage sp = storedPermissions[id][wallet][permissionHash];
        if (!sp.exists) {
            bytes32 wildcardHash = keccak256(abi.encodePacked(callType, address(0), selector));
            sp = storedPermissions[id][wallet][wildcardHash];
            if (!sp.exists) revert InvalidCallData();
        }

        if (value > sp.valueLimit) revert CallViolatesValueRule();

        if (sp.dailyLimit > 0) {
            uint256 day = block.timestamp / 1 days;
            uint256 used = dailyUsed[id][wallet][permissionHash][day];
            if (used + value > sp.dailyLimit) revert CallViolatesDailyLimit();
            dailyUsed[id][wallet][permissionHash][day] = used + value;
        }

        for (uint256 i = 0; i < sp.rules.length; i++) {
            ParamRule memory rule = sp.rules[i];
            bytes32 param = bytes32(data[4 + rule.offset:4 + rule.offset + 32]);
            
            if (rule.condition == ParamCondition.EQUAL && param != rule.params[0]) return false;
            if (rule.condition == ParamCondition.GREATER_THAN && param <= rule.params[0]) return false;
            if (rule.condition == ParamCondition.LESS_THAN && param >= rule.params[0]) return false;
            if (rule.condition == ParamCondition.GREATER_THAN_OR_EQUAL && param < rule.params[0]) return false;
            if (rule.condition == ParamCondition.LESS_THAN_OR_EQUAL && param > rule.params[0]) return false;
            if (rule.condition == ParamCondition.NOT_EQUAL && param == rule.params[0]) return false;
            if (rule.condition == ParamCondition.ONE_OF) {
                bool found;
                for (uint256 j = 0; j < rule.params.length; j++) {
                    if (param == rule.params[j]) found = true;
                }
                if (!found) return false;
            }
        }
        return true;
    }

    function checkSignaturePolicy(bytes32 id, address, bytes32, bytes calldata)
        external
        view
        override
        returns (uint256)
    {
        require(status[id][msg.sender] == Status.Live);
        return 0;
    }
}