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
    address delegatedKey;
    bytes4 selector;
    ParamRule[] rules;
}

struct StoredPermission {
    ParamRule[] rules;
    address delegatedKey;
    bool exists;
}

struct TokenLimit {
    bool enabled;
    uint256 txLimit;
    uint256 dailyLimit;
}

contract CallPolicy is PolicyBase {
    /// @dev Helper for safe decoding in case payload includes a leading permissionId
    function _decodePermissions(bytes calldata data) external pure returns (Permission[] memory) {
        return abi.decode(data, (Permission[]));
    }

    // ---------------- ERRORS ----------------
    
    error InvalidCallType();
    error InvalidCallData();
    error InvalidSelector();
    error InvalidDelegatedKey();
    error EmptyPermissions();
    error InconsistentDelegatedKey();
    error CallViolatesParamRule();
    error NotWallet();
    error NotLive();
    error PolicyAlreadyInstalled(bytes32 id, address wallet);
    error DuplicatePermission();
    error PermissionNotFound();
    error TokenNotAllowed(address asset);
    error TokenTxLimitExceeded(address asset, uint256 amount, uint256 limit);
    error TokenDailyLimitExceeded(address asset, uint256 amount, uint256 used, uint256 limit);
    error RecipientNotAllowed(address asset, address recipient);
    error LengthMismatch();
    error OnlyAssetTransfersAllowed();

    // ---------------- STORAGE ----------------

    // [wallet][id] -> Status
    mapping(address => mapping(bytes32 => Status)) public status;

    // [wallet][id] -> delegatedKey
    mapping(address => mapping(bytes32 => address)) public delegatedKeys;

    // [wallet][id][permissionHash] -> StoredPermission
    mapping(address => mapping(bytes32 => mapping(bytes32 => StoredPermission))) public storedPermissions;

    // [wallet][id] -> [permissionHash1, permissionHash2, ...]
    mapping(address => mapping(bytes32 => bytes32[])) public permissionHashes;

    // [wallet][id] -> [token1, token2, ...]
    mapping(address => mapping(bytes32 => address[])) public allowedTokens;
    
    // [wallet][id][token] -> index+1 (for efficient removal)
    mapping(address => mapping(bytes32 => mapping(address => uint256))) private tokenIndexPlusOne;
    
    // [wallet][id][token] -> TokenLimit
    mapping(address => mapping(bytes32 => mapping(address => TokenLimit))) public tokenLimits;
    
    // [wallet][id][token][day] -> amount used
    mapping(address => mapping(bytes32 => mapping(address => mapping(uint256 => uint256)))) public tokenDailyUsed;

    // [wallet][id] -> [recipient1, recipient2, ...]
    mapping(address => mapping(bytes32 => address[])) public recipientList;
    
    // [wallet][id][recipient] -> index+1
    mapping(address => mapping(bytes32 => mapping(address => uint256))) private recipientIndexPlusOne;
    
    // [wallet][id][recipient] -> bool
    mapping(address => mapping(bytes32 => mapping(address => bool))) public recipientAllowed;

    // ---------------- EVENTS ----------------

    event PermissionInstalled(
        bytes32 indexed id,
        address indexed wallet,
        address indexed delegatedKey,
        bytes32 permissionHash
    );

    event PermissionRemoved(
        bytes32 indexed id,
        address indexed wallet,
        bytes32 indexed permissionHash
    );

    event TokenLimitSet(
        bytes32 indexed id,
        address indexed wallet,
        address indexed token,
        bool enabled,
        uint256 txLimit,
        uint256 dailyLimit
    );

    event RecipientAllowed(
        bytes32 indexed id,
        address indexed wallet,
        address indexed recipient,
        bool allowed
    );

    // ---------------- MODIFIERS ----------------

    modifier onlyWallet(address wallet) {
        if (msg.sender != wallet) revert NotWallet();
        _;
    }

    modifier onlyLive(bytes32 id, address wallet) {
        if (status[wallet][id] != Status.Live) revert NotLive();
        _;
    }

    // ---------------- INSTALL ----------------

    function isInitialized(address wallet) external view override returns (bool) {
        // Check if there's at least one active policy ID
        return status[wallet][bytes32(0)] != Status.NA;
    }

    function _policyOninstall(bytes32 id, bytes calldata data) internal override {
        if (status[msg.sender][id] != Status.NA) {
            revert PolicyAlreadyInstalled(id, msg.sender);
        }

        Permission[] memory permissions;
        if (data.length >= 32) {
            // Try decoding after stripping a leading permissionId (bytes32) if present; fallback otherwise.
            try CallPolicy(address(this))._decodePermissions(data[32:]) returns (Permission[] memory decoded) {
                permissions = decoded;
            } catch {
                permissions = abi.decode(data, (Permission[]));
            }
        } else {
            permissions = abi.decode(data, (Permission[]));
        }
        if (permissions.length == 0) revert EmptyPermissions();

        address delegatedKey = permissions[0].delegatedKey;
        if (delegatedKey == address(0)) revert InvalidDelegatedKey();

        // Save delegated key
        delegatedKeys[msg.sender][id] = delegatedKey;

        for (uint256 i; i < permissions.length; ++i) {
            if (permissions[i].delegatedKey != delegatedKey) revert InconsistentDelegatedKey();

            bytes32 permissionHash = keccak256(
                abi.encodePacked(
                    permissions[i].callType,
                    permissions[i].target,
                    permissions[i].selector,
                    delegatedKey
                )
            );

            if (storedPermissions[msg.sender][id][permissionHash].exists) {
                revert DuplicatePermission();
            }

            StoredPermission storage sp = storedPermissions[msg.sender][id][permissionHash];
            sp.delegatedKey = delegatedKey;
            sp.exists = true;

            uint256 rulesLength = permissions[i].rules.length;
            for (uint256 j; j < rulesLength; ++j) {
                sp.rules.push(permissions[i].rules[j]);
            }

            permissionHashes[msg.sender][id].push(permissionHash);

            emit PermissionInstalled(id, msg.sender, delegatedKey, permissionHash);
        }

        status[msg.sender][id] = Status.Live;
    }

    // ---------------- TOKEN LIMITS & RECIPIENTS ----------------

    /**
     * @notice Set token limits for multiple tokens
     * @dev Only wallet itself can call this
     * @param id Policy ID
     * @param wallet Wallet address
     * @param tokens Array of token addresses (address(0) for native ETH)
     * @param enabled Array of enabled flags
     * @param txLimit Array of per-transaction limits
     * @param dailyLimit Array of daily limits
     */
    function setTokenLimit(
        bytes32 id,
        address wallet,
        address[] calldata tokens,
        bool[] calldata enabled,
        uint256[] calldata txLimit,
        uint256[] calldata dailyLimit
    ) external onlyWallet(wallet) {
        if (
            tokens.length != enabled.length ||
            tokens.length != txLimit.length ||
            tokens.length != dailyLimit.length
        ) revert LengthMismatch();

        for (uint256 i; i < tokens.length; ++i) {
            address token = tokens[i];
            bool en = enabled[i];

            if (en) {
                // Add token to list if not already there
                if (tokenIndexPlusOne[wallet][id][token] == 0) {
                    allowedTokens[wallet][id].push(token);
                    tokenIndexPlusOne[wallet][id][token] = allowedTokens[wallet][id].length;
                }
                
                TokenLimit storage tl = tokenLimits[wallet][id][token];
                tl.enabled = true;
                tl.txLimit = txLimit[i];
                tl.dailyLimit = dailyLimit[i];
            } else {
                // Remove token from list if exists
                if (tokenIndexPlusOne[wallet][id][token] != 0) {
                    _removeToken(id, wallet, token);
                }
                delete tokenLimits[wallet][id][token];
            }

            emit TokenLimitSet(id, wallet, token, en, txLimit[i], dailyLimit[i]);
        }
    }

    /**
     * @notice Set allowed recipients for asset transfers
     * @dev Only wallet itself can call this
     * @param id Policy ID
     * @param wallet Wallet address
     * @param recipients Array of recipient addresses
     * @param allowed Array of allowed flags
     */
    function setRecipientAllowed(
        bytes32 id,
        address wallet,
        address[] calldata recipients,
        bool[] calldata allowed
    ) external onlyWallet(wallet) {
        if (recipients.length != allowed.length) revert LengthMismatch();

        for (uint256 i; i < recipients.length; ++i) {
            address rec = recipients[i];
            bool isAllowed = allowed[i];

            if (isAllowed) {
                if (!recipientAllowed[wallet][id][rec]) {
                    recipientList[wallet][id].push(rec);
                    recipientIndexPlusOne[wallet][id][rec] = recipientList[wallet][id].length;
                    recipientAllowed[wallet][id][rec] = true;
                }
            } else {
                if (recipientAllowed[wallet][id][rec]) {
                    _removeRecipient(id, wallet, rec);
                    recipientAllowed[wallet][id][rec] = false;
                }
            }
            
            emit RecipientAllowed(id, wallet, rec, isAllowed);
        }
    }

    // ---------------- UNINSTALL ----------------

    function _policyOnUninstall(bytes32 id, bytes calldata /* data */) internal override {
        if (status[msg.sender][id] != Status.Live) revert NotLive();

        bytes32[] storage hashes = permissionHashes[msg.sender][id];
        uint256 length = hashes.length;
        
        for (uint256 i; i < length; ++i) {
            bytes32 permissionHash = hashes[i];
            if (storedPermissions[msg.sender][id][permissionHash].exists) {
                delete storedPermissions[msg.sender][id][permissionHash];
                emit PermissionRemoved(id, msg.sender, permissionHash);
            }
        }
        
        delete permissionHashes[msg.sender][id];
        delete delegatedKeys[msg.sender][id];
        status[msg.sender][id] = Status.Deprecated;
    }

    // ---------------- INTERNAL HELPERS ----------------

    function _removeToken(bytes32 id, address wallet, address token) internal {
        uint256 idxPlus = tokenIndexPlusOne[wallet][id][token];
        if (idxPlus == 0) return;

        address[] storage list = allowedTokens[wallet][id];
        uint256 idx = idxPlus - 1;
        uint256 lastIdx = list.length - 1;
        
        if (idx != lastIdx) {
            address last = list[lastIdx];
            list[idx] = last;
            tokenIndexPlusOne[wallet][id][last] = idx + 1;
        }
        
        list.pop();
        delete tokenIndexPlusOne[wallet][id][token];
    }

    function _removeRecipient(bytes32 id, address wallet, address recipient) internal {
        uint256 idxPlus = recipientIndexPlusOne[wallet][id][recipient];
        if (idxPlus == 0) return;

        address[] storage list = recipientList[wallet][id];
        uint256 idx = idxPlus - 1;
        uint256 lastIdx = list.length - 1;
        
        if (idx != lastIdx) {
            address last = list[lastIdx];
            list[idx] = last;
            recipientIndexPlusOne[wallet][id][last] = idx + 1;
        }
        
        list.pop();
        delete recipientIndexPlusOne[wallet][id][recipient];
    }

    /**
     * @notice Decode asset transfer details from calldata
     * @dev Supports native ETH and ERC20 transfers
     * @return asset Token address (address(0) for ETH)
     * @return amount Transfer amount
     * @return recipient Real recipient address
     * @return isAssetTransfer True if this is an asset transfer
     */
    function _decodeAssetAndAmount(
        CallType callType,
        address target,
        bytes calldata data,
        uint256 value
    )
        internal
        pure
        returns (address asset, uint256 amount, address recipient, bool isAssetTransfer)
    {
        if (CallType.unwrap(callType) != CallType.unwrap(CALLTYPE_SINGLE)) {
            return (address(0), 0, address(0), false);
        }

        // Native ETH transfer: empty calldata + value > 0
        if (data.length == 0 && value > 0) {
            return (address(0), value, target, true);
        }

        if (data.length < 4) {
            return (address(0), 0, address(0), false);
        }

        bytes4 selector = bytes4(data[0:4]);

        // ERC20 transfer(address to, uint256 amount)
        if (selector == 0xa9059cbb && data.length >= 68) {
            asset = target;
            recipient = address(uint160(uint256(bytes32(data[4:36]))));
            amount = uint256(bytes32(data[36:68]));
            return (asset, amount, recipient, true);
        }

        // ERC20 transferFrom(address from, address to, uint256 amount)
        if (selector == 0x23b872dd && data.length >= 100) {
            asset = target;
            recipient = address(uint160(uint256(bytes32(data[36:68]))));
            amount = uint256(bytes32(data[68:100]));
            return (asset, amount, recipient, true);
        }

        return (address(0), 0, address(0), false);
    }

    /**
     * @notice Check token limits for asset transfer
     * @dev Checks both per-transaction and daily limits
     */
    function _checkTokenLimits(bytes32 id, address wallet, address asset, uint256 amount) internal {
        TokenLimit storage tl = tokenLimits[wallet][id][asset];

        if (!tl.enabled) revert TokenNotAllowed(asset);

        // Per-transaction limit check
        if (tl.txLimit > 0 && amount > tl.txLimit) {
            revert TokenTxLimitExceeded(asset, amount, tl.txLimit);
        }

        // Daily limit check
        if (tl.dailyLimit > 0) {
            uint256 day = block.timestamp / 1 days;
            uint256 used = tokenDailyUsed[wallet][id][asset][day];
            if (used + amount > tl.dailyLimit) {
                revert TokenDailyLimitExceeded(asset, amount, used, tl.dailyLimit);
            }
            tokenDailyUsed[wallet][id][asset][day] = used + amount;
        }
    }

    /**
     * @notice Check if recipient is allowed
     */
    function _checkRecipient(bytes32 id, address wallet, address recipient) internal view {
        if (!recipientAllowed[wallet][id][recipient]) {
            revert RecipientNotAllowed(address(0), recipient);
        }
    }

    // ---------------- POLICY CHECKS ----------------

    function checkUserOpPolicy(bytes32 id, PackedUserOperation calldata userOp)
        external
        payable
        override
        returns (uint256)
    {
        if (bytes4(userOp.callData[0:4]) != IERC7579Account.execute.selector) {
            revert InvalidSelector();
        }
        
        ExecMode mode = ExecMode.wrap(bytes32(userOp.callData[4:36]));
        (CallType callType,,,) = ExecLib.decode(mode);

        bytes calldata executionCallData = userOp.callData;
        assembly {
            executionCallData.offset := add(
                add(executionCallData.offset, 0x24), 
                calldataload(add(executionCallData.offset, 0x24))
            )
            executionCallData.length := calldataload(sub(executionCallData.offset, 0x20))
        }

        if (callType == CALLTYPE_SINGLE) {
            (address target, uint256 value, bytes calldata callData) = ExecLib.decodeSingle(executionCallData);
            if (!_checkPermission(msg.sender, id, callType, target, callData, value)) {
                revert CallViolatesParamRule();
            }
        } else if (callType == CALLTYPE_BATCH) {
            Execution[] calldata exec = ExecLib.decodeBatch(executionCallData);
            uint256 execLength = exec.length;
            for (uint256 i; i < execLength; ++i) {
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

        return 0;
    }

    function _checkPermission(
        address wallet,
        bytes32 id,
        CallType callType,
        address target,
        bytes calldata data,
        uint256 value
    ) internal returns (bool) {
        bytes4 selector = data.length >= 4 ? bytes4(data[0:4]) : bytes4(0);
        address delegatedKey = delegatedKeys[wallet][id];
        
        bytes32 permissionHash = keccak256(abi.encodePacked(callType, target, selector, delegatedKey));
        StoredPermission storage sp = storedPermissions[wallet][id][permissionHash];

        // Try wildcard if exact permission not found
        if (!sp.exists) {
            bytes32 wildcardHash = keccak256(abi.encodePacked(callType, address(0), selector, delegatedKey));
            sp = storedPermissions[wallet][id][wildcardHash];
            if (!sp.exists) revert InvalidCallData();
        }

        // Decode and check if this is an asset transfer
        (address asset, uint256 amount, address recipient, bool isAssetTransfer) = 
            _decodeAssetAndAmount(callType, target, data, value);

        // Only asset transfers are allowed
        if (!isAssetTransfer) {
            revert OnlyAssetTransfersAllowed();
        }

        // Check token limits and recipient
        _checkTokenLimits(id, wallet, asset, amount);
        _checkRecipient(id, wallet, recipient);

        // Check parameter rules (optional additional constraints)
        uint256 rulesLength = sp.rules.length;
        for (uint256 i; i < rulesLength; ++i) {
            ParamRule memory rule = sp.rules[i];
            bytes32 param = (data.length >= 4 + rule.offset + 32) 
                ? bytes32(data[4 + rule.offset:4 + rule.offset + 32]) 
                : bytes32(0);

            if (rule.condition == ParamCondition.EQUAL) {
                if (param != rule.params[0]) return false;
            } else if (rule.condition == ParamCondition.GREATER_THAN) {
                if (param <= rule.params[0]) return false;
            } else if (rule.condition == ParamCondition.LESS_THAN) {
                if (param >= rule.params[0]) return false;
            } else if (rule.condition == ParamCondition.GREATER_THAN_OR_EQUAL) {
                if (param < rule.params[0]) return false;
            } else if (rule.condition == ParamCondition.LESS_THAN_OR_EQUAL) {
                if (param > rule.params[0]) return false;
            } else if (rule.condition == ParamCondition.NOT_EQUAL) {
                if (param == rule.params[0]) return false;
            } else if (rule.condition == ParamCondition.ONE_OF) {
                bool found;
                uint256 paramsLength = rule.params.length;
                for (uint256 j; j < paramsLength; ++j) {
                    if (param == rule.params[j]) {
                        found = true;
                        break;
                    }
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
        if (status[msg.sender][id] != Status.Live) revert NotLive();
        return 0;
    }
}
