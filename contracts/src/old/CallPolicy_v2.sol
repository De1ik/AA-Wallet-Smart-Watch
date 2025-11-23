// // SPDX-License-Identifier: MIT
// pragma solidity ^0.8.21;

// import "kernel/sdk/moduleBase/PolicyBase.sol";
// import "kernel/utils/ExecLib.sol";
// import "kernel/types/Constants.sol";
// import {IERC7579Account} from "kernel/interfaces/IERC7579Account.sol";

// enum ParamCondition {
//     EQUAL,
//     GREATER_THAN,
//     LESS_THAN,
//     GREATER_THAN_OR_EQUAL,
//     LESS_THAN_OR_EQUAL,
//     NOT_EQUAL,
//     ONE_OF
// }

// enum Status {
//     NA,
//     Live,
//     Deprecated
// }

// // verify callData attributes
// struct ParamRule {
//     ParamCondition condition;
//     uint64 offset;
//     bytes32[] params;
// }

// struct Permission {
//     CallType callType;
//     address target;
//     address delegatedKey;
//     bytes4 selector;
//     ParamRule[] rules;
// }

// struct StoredPermission {
//     ParamRule[] rules;
//     address owner;     
//     address delegatedKey;
//     bool exists;
// }

// struct TokenLimit {
//     bool enabled;      
//     uint256 txLimit;    
//     uint256 dailyLimit; 
// }

// contract CallPolicy is PolicyBase {
//     error InvalidCallType();
//     error InvalidCallData();
//     error CallViolatesParamRule();
//     error CallViolatesValueRule();
//     error CallViolatesDailyLimit();
//     error NotPermissionOwner();
//     error PolicyAlreadyInstalled(bytes32 id, address wallet);
//     error TokenNotAllowed(address asset);
//     error TokenTxLimitExceeded(address asset, uint256 amount, uint256 limit);
//     error TokenDailyLimitExceeded(address asset, uint256 amount, uint256 used, uint256 limit);
//     error RecipientNotAllowed(address asset, address recipient);

//     // ---------------- STORAGE ----------------

//     // [wallet] -> [pid1, pid2]
//     mapping(address => bytes32[]) public usedIds;

//     // [wallet][id] -> Status
//     mapping(address => mapping(bytes32 => Status)) public status;

//     // [wallet][id][permissionHash] -> StoredPermission{}
//     mapping(address => mapping(bytes32 => mapping(bytes32 => StoredPermission))) private storedPermissions;
    
//     // [wallet][id] -> [permissionHash1, permissionHash2, ...]
//     mapping(address => mapping(bytes32 => bytes32[])) private permissionHashesByOwner;

//     // [wallet][id] -> [token1, token2, ...] (only enabled tokens tracked)
//     mapping(address => mapping(bytes32 => address[])) private allowedTokens;
//     // [wallet][id][token1] -> TokenLimit{}
//     mapping(address => mapping(bytes32 => mapping(address => TokenLimit))) public tokenLimits;
//     // [wallet][id][token1][day] -> amount
//     mapping(address => mapping(bytes32 => mapping(address => mapping(uint256 => uint256)))) public tokenDailyUsed;

//     // [wallet][id] -> [recipient1, recipient2, ...] (only allowed recipients tracked)
//     mapping(address => mapping(bytes32 => address[])) private recipientList;

//     event PermissionInstalled(
//         bytes32 indexed id,
//         address indexed owner,
//         bytes32 indexed permissionHash,
//         uint256 valueLimit,
//         uint256 dailyLimit
//     );
//     event PermissionUpdated(
//         bytes32 indexed id,
//         address indexed owner,
//         bytes32 indexed permissionHash,
//         uint256 newValueLimit,
//         uint256 newDailyLimit
//     );
//     event PermissionRemoved(
//         bytes32 indexed id, 
//         address indexed owner, 
//         bytes32 indexed permissionHash
//     );

//     event TokenLimitSet(
//         bytes32 indexed id,
//         address indexed wallet,
//         address indexed token,
//         bool enabled,
//         uint256 txLimit,
//         uint256 dailyLimit
//     );

//     event RecipientAllowed(
//         bytes32 indexed id,
//         address indexed wallet,
//         address indexed recipient,
//         bool allowed
//     );

//     // ---------------- GETTERS ----------------

//     // return the amount of installed permission for specific delegated key
//     function getPermissionsCount(bytes32 id, address owner) external view returns (uint256) {
//         return permissionHashesByOwner[id][owner].length;
//     }

//     // return the StoredPermission details by index for specific delegated key
//     function getPermissionByIndex(bytes32 id, address owner, uint256 index)
//         external
//         view
//         returns (bytes32 permissionHash, uint256 valueLimit, uint256 dailyLimit, ParamRule[] memory rules)
//     {
//         require(index < permissionHashesByOwner[id][owner].length, "index OOB");
//         permissionHash = permissionHashesByOwner[id][owner][index];
//         StoredPermission storage sp = storedPermissions[id][owner][permissionHash];
//         require(sp.exists, "no perm");
//         return (permissionHash, sp.valueLimit, sp.dailyLimit, sp.rules);
//     }

//     // return the StoredPermission details by permission hash for specific delegated key
//     function getPermission(bytes32 id, bytes32 permissionHash, address owner)
//         external
//         view
//         returns (uint256 valueLimit, uint256 dailyLimit, ParamRule[] memory rules)
//     {
//         StoredPermission storage sp = storedPermissions[id][owner][permissionHash];
//         require(sp.exists, "no perm");
//         return (sp.valueLimit, sp.dailyLimit, sp.rules);
//     }

//     /// @notice Получить лимиты по конкретному токену (native = address(0))
//     function getTokenLimit(bytes32 id, address wallet, address token)
//         external
//         view
//         returns (bool enabled, uint256 txLimit, uint256 dailyLimit)
//     {
//         TokenLimit storage tl = tokenLimits[id][wallet][token];
//         return (tl.enabled, tl.txLimit, tl.dailyLimit);
//     }

//     /// @notice Получить список всех разрешённых токенов с лимитами (только включённые)
//     function getAllowedTokens(bytes32 id, address wallet)
//         external
//         view
//         returns (address[] memory tokens, TokenLimit[] memory limits)
//     {
//         address[] storage list = allowedTokens[id][wallet];
//         uint256 len = list.length;
//         tokens = new address[](len);
//         limits = new TokenLimit[](len);
//         for (uint256 i = 0; i < len; i++) {
//             address token = list[i];
//             TokenLimit storage tl = tokenLimits[id][wallet][token];
//             tokens[i] = token;
//             limits[i] = tl;
//         }
//     }

//     /// @notice Проверить, разрешён ли получатель
//     function isRecipientAllowed(bytes32 id, address wallet, address recipient) external view returns (bool) {
//         return recipientAllowed[id][wallet][recipient];
//     }

//     /// @notice Получить список всех разрешённых получателей
//     function getAllowedRecipients(bytes32 id, address wallet) external view returns (address[] memory recipients) {
//         recipients = recipientList[id][wallet];
//     }

//     /// @notice Получить лимиты по конкретному токену (native = address(0))
//     function getTokenLimit(bytes32 id, address wallet, address token)
//         external
//         view
//         returns (bool enabled, uint256 txLimit, uint256 dailyLimit)
//     {
//         TokenLimit storage tl = tokenLimits[id][wallet][token];
//         return (tl.enabled, tl.txLimit, tl.dailyLimit);
//     }

//     function getAllRestrictionsPerWallet(bytes32 id, address wallet)
//         external
//         view
//         returns (address[] memory allRecipients, address[] memory allAllowedTokens, TokenLimit[] memory allTokenLimits)
//     {
//         allRecipients = recipientList[wallet][id];
//         allAllowedTokens = allowedTokens[wallet][id];
        
//         uint256 tokenAmount = allAllowedTokens.length;
//         allTokenLimits = new TokenLimit[](tokenAmount);

//         for (uint256 i = 0; i < tokenAmount; i++) {
//             allTokenLimits[i] = tokenLimits[wallet][id][allAllowedTokens[i]];
//         }

//         return (allRecipients, allAllowedTokens, allTokenLimits);
//     }

//     // ---------------- INSTALL ----------------

//     function isInitialized(address wallet) external view override returns (bool) {
//         return usedIds[wallet] > 0;
//     }

//     // install new delegated key with permission sets for (id, wallet)
//     function _policyOninstall(bytes32 id, bytes calldata data) internal override {
//         //check that policy is not already installed for (id, wallet)
//         if (status[msg.sender][id] != Status.NA) revert PolicyAlreadyInstalled(id, msg.sender);

//         // decode input data into Permission[] structure
//         Permission[] memory permissions = abi.decode(data, (Permission[]));
//         for (uint256 i = 0; i < permissions.length; i++) {
            
//             // compute permission hash
//             bytes32 permissionHash = keccak256(
//                 abi.encodePacked(
//                     permissions[i].callType, 
//                     permissions[i].target, 
//                     permissions[i].selector,
//                     permissions[i].delegatedKey
//                 )
//             );

//             // check for duplicate permission
//             require(!storedPermissions[msg.sender][id][permissionHash].exists, "duplicate");

//             // save permission
//             StoredPermission storage sp = storedPermissions[msg.sender][id][permissionHash];
//             sp.owner = msg.sender;
//             sp.delegatedKey = permissions[i].delegatedKey;
//             for (uint256 j = 0; j < permissions[i].rules.length; j++) {
//                 sp.rules.push(permissions[i].rules[j]);
//             }
//             sp.exists = true;

//             // add permission to the index
//             permissionHashesByOwner[msg.sender][id].push(permissionHash);
            
//             // emit eventof success installation
//             emit PermissionInstalled(id, msg.sender, permissionHash, sp.valueLimit, sp.dailyLimit);
//         }

//         // set status to Live for the permission set
//         status[msg.sender][id] = Status.Live;
        
//         // increment installed delegated keys for current wallet
//         usedIds[msg.sender]++;
//     }

//     // ---------------- UPDATE LIMITS (Permission-level fallback) ----------------

//     function updatePermissionLimits(
//         bytes32 id,
//         address wallet,
//         CallType callType,
//         address target,
//         bytes4 selector,
//         uint256 newValueLimit,
//         uint256 newDailyLimit
//     ) external {
//         bytes32 permissionHash = keccak256(abi.encodePacked(callType, target, selector));
//         StoredPermission storage sp = storedPermissions[id][wallet][permissionHash];
//         require(sp.exists, "no such permission");
//         require(sp.owner == msg.sender, "NotPermissionOwner");

//         sp.valueLimit = newValueLimit;
//         sp.dailyLimit = newDailyLimit;

//         emit PermissionUpdated(id, msg.sender, permissionHash, newValueLimit, newDailyLimit);
//     }

//     // ---------------- UNINSTALL ----------------

//     function _policyOnUninstall(bytes32 id, bytes calldata /* data */) internal override {
        
//         // check that policy is installed and active for (id, wallet)
//         require(status[id][msg.sender] == Status.Live, "not live");

//         bytes32[] storage hashes = permissionHashesByOwner[id][msg.sender];
//         for (uint256 i = 0; i < hashes.length; i++) {
//             bytes32 permissionHash = hashes[i];
//             if (storedPermissions[id][msg.sender][permissionHash].exists) {
//                 delete storedPermissions[id][msg.sender][permissionHash];
//                 emit PermissionRemoved(id, msg.sender, permissionHash);
//             }
//         }
//         delete permissionHashesByOwner[id][msg.sender];

//         // set status to Deprecated for the delegated key
//         status[id][msg.sender] = Status.Deprecated;
        
//         // decrease amount of installed delegated keys for current wallet
//         usedIds[msg.sender]--;
//     }

//     // function _removePermissionIndex(bytes32 id, address owner, bytes32 permissionHash) internal {
//     //     bytes32[] storage arr = permissionHashesByOwner[id][owner];
//     //     for (uint256 i = 0; i < arr.length; i++) {
//     //         if (arr[i] == permissionHash) {
//     //             arr[i] = arr[arr.length - 1];
//     //             arr.pop();
//     //             break;
//     //         }
//     //     }
//     // }

//     // ---------------- ADMIN: TOKEN LIMITS & RECIPIENTS ----------------

//     // set per-token limits for asset transfers
//     function setTokenLimit(
//         bytes32 id,
//         address wallet,
//         address[] calldata tokens,
//         bool[] calldata enabled,
//         uint256[] calldata txLimit,
//         uint256[] calldata dailyLimit
//     ) external {
//         // Check that caller is the wallet itself
//         require(msg.sender == wallet, "sender do not have access to wallet");
        
//         // Check that input arrays have the same length
//         require(
//             tokens.length == enabled.length &&
//             tokens.length == txLimit.length &&
//             tokens.length == dailyLimit.length,
//             "length of attributes is mismatched"
//         );

//         // Update token limits
//         for (uint256 i = 0; i < tokens.length; i++) {
//             address token = tokens[i];
//             bool en = enabled[i];

//             if (en) {
//                 if (tokenIndexPlusOne[id][wallet][token] == 0) {
//                     allowedTokens[id][wallet].push(token);
//                     tokenIndexPlusOne[id][wallet][token] = allowedTokens[id][wallet].length; // index+1
//                 }
//                 TokenLimit storage tl = tokenLimits[id][wallet][token];
//                 tl.enabled = true;
//                 tl.txLimit = txLimit[i];
//                 tl.dailyLimit = dailyLimit[i];
//             } else {
//                 // disable/remove token
//                 if (tokenIndexPlusOne[id][wallet][token] != 0) {
//                     _removeToken(id, wallet, token);
//                 }
//                 delete tokenLimits[id][wallet][token];
//             }

//             emit TokenLimitSet(id, wallet, token, en, txLimit[i], dailyLimit[i]);
//         }
//     }

//     // update the allowed recipients for asset transfers
//     function setRecipientAllowed(bytes32 id, address wallet, address[] calldata recipients, bool[] calldata allowed) external {
//         // Check that caller is the wallet itself
//         require(msg.sender == wallet, "not wallet");
//         require(recipients.length == allowed.length, "length mismatch");

//         // Update allowed recipients
//         for (uint256 i = 0; i < recipients.length; i++) {
//             address rec = recipients[i];
//             bool isAllowed = allowed[i];

//             if (isAllowed) {
//                 if (!recipientAllowed[id][wallet][rec]) {
//                     recipientList[id][wallet].push(rec);
//                     recipientIndexPlusOne[id][wallet][rec] = recipientList[id][wallet].length; // index+1
//                 }
//                 recipientAllowed[id][wallet][rec] = true;
//             } else {
//                 if (recipientAllowed[id][wallet][rec]) {
//                     _removeRecipient(id, wallet, rec);
//                     recipientAllowed[id][wallet][rec] = false;
//                 }
//             }
//             emit RecipientAllowed(id, wallet, rec, isAllowed);
//         }
//     }

//     function _removeToken(bytes32 id, address wallet, address token) internal {
//         uint256 idxPlus = tokenIndexPlusOne[id][wallet][token];
//         if (idxPlus == 0) return;

//         address[] storage list = allowedTokens[id][wallet];
//         uint256 idx = idxPlus - 1;
//         uint256 lastIdx = list.length - 1;
//         if (idx != lastIdx) {
//             address last = list[lastIdx];
//             list[idx] = last;
//             tokenIndexPlusOne[id][wallet][last] = idx + 1;
//         }
//         list.pop();
//         delete tokenIndexPlusOne[id][wallet][token];
//     }

//     function _removeRecipient(bytes32 id, address wallet, address recipient) internal {
//         uint256 idxPlus = recipientIndexPlusOne[id][wallet][recipient];
//         if (idxPlus == 0) return;

//         address[] storage list = recipientList[id][wallet];
//         uint256 idx = idxPlus - 1;
//         uint256 lastIdx = list.length - 1;
//         if (idx != lastIdx) {
//             address last = list[lastIdx];
//             list[idx] = last;
//             recipientIndexPlusOne[id][wallet][last] = idx + 1;
//         }
//         list.pop();
//         delete recipientIndexPlusOne[id][wallet][recipient];
//     }

//     // ---------------- INTERNAL: DECODE ASSET & AMOUNT ----------------

//     // decode asset and amount from call data if it's an asset transfer
//     function _decodeAssetAndAmount(
//         CallType callType,
//         address target,
//         bytes calldata data,
//         uint256 value
//     )
//         internal
//         pure
//         returns (address asset, uint256 amount, address recipient, bool isAssetTransfer)
//     {
//         if (CallType.unwrap(callType) != CallType.unwrap(CALLTYPE_SINGLE)) {
//             return (address(0), 0, address(0), false);
//         }

//         // native ETH transfer: empty data + value > 0
//         if (callType == CALLTYPE_SINGLE && data.length == 0 && value > 0) {
//             asset = address(0);      // native ETH
//             amount = value;
//             recipient = target;      // recipient is the target (real address)
//             isAssetTransfer = true;
//             return (asset, amount, recipient, isAssetTransfer);
//         }

//         // no selector -> not erc-20 transfer
//         if (data.length < 4) {
//             return (address(0), 0, address(0), false);
//         }

//         // get function selector
//         bytes4 selector = bytes4(data[0:4]);

//         // erc-20 transfer(address to, uint256 amount)
//         if (selector == 0xa9059cbb && data.length >= 4 + 32 * 2) {
//             asset = target;                                                 // token address is the target
//             recipient = address(uint160(uint256(bytes32(data[4:36]))));     // first argument (to)
//             amount = uint256(bytes32(data[36:68]));                         // second argument (amount)
//             isAssetTransfer = true;
//             return (asset, amount, recipient, isAssetTransfer);
//         }

//         // erc-20 transferFrom(address from, address to, uint256 amount)
//         if (selector == 0x23b872dd && data.length >= 4 + 32 * 3) {
//             asset = target;                                                 // token address is the target 
//             recipient = address(uint160(uint256(bytes32(data[36:68]))));    // second argument (to)
//             amount = uint256(bytes32(data[68:100]));                        // third argument (amount)
//             isAssetTransfer = true;
//             return (asset, amount, recipient, isAssetTransfer);
//         }

//         // not an asset transfer, fallback
//         return (address(0), 0, address(0), false);
//     }


//     // check token limits for asset transfers
//     function _checkTokenLimits(bytes32 id, address wallet, address asset, uint256 amount) internal {
//         TokenLimit storage tl = tokenLimits[id][wallet][asset];
        
//         // check if token is allowed
//         if (!tl.enabled) revert TokenNotAllowed(asset);

//         // per-transaction limit
//         if (tl.txLimit > 0 && amount > tl.txLimit) {
//             revert TokenTxLimitExceeded(asset, amount, tl.txLimit);
//         }

//         // daily limit
//         if (tl.dailyLimit > 0) {
//             uint256 day = block.timestamp / 1 days;
//             uint256 used = tokenDailyUsed[id][wallet][asset][day];
//             if (used + amount > tl.dailyLimit) {
//                 revert TokenDailyLimitExceeded(asset, amount, used, tl.dailyLimit);
//             }
//             tokenDailyUsed[id][wallet][asset][day] = used + amount;
//         }
//     }

//     // check if recipient is allowed for asset transfers
//     function _checkRecipient(bytes32 id, address wallet, address asset, address recipient) internal view {
//         if (!recipientAllowed[id][wallet][recipient]) {
//             revert RecipientNotAllowed(asset, recipient);
//         }
//     }

//     // ---------------- CHECKS ----------------

//     // main function to check user operation against stored permissions
//     function checkUserOpPolicy(bytes32 id, PackedUserOperation calldata userOp)
//         external
//         payable
//         override
//         returns (uint256)
//     {
//         // decode selector and ExecMode from callData
//         require(bytes4(userOp.callData[0:4]) == IERC7579Account.execute.selector);
//         ExecMode mode = ExecMode.wrap(bytes32(userOp.callData[4:36]));
//         (CallType callType,,,) = ExecLib.decode(mode);

//         bytes calldata executionCallData = userOp.callData;
//         assembly {
//             // get pointer to executionCallData
//             executionCallData.offset :=
//                 add(
//                     add(executionCallData.offset, 0x24), calldataload(
//                         add(
//                             executionCallData.offset, 0x24
//                         )
//                     )
//                 )
            
//             // get length of executionCallData
//             executionCallData.length := calldataload(sub(executionCallData.offset, 0x20))
//         }

//         // perform checks based on callType
//         if (callType == CALLTYPE_SINGLE) {
//             (address target, uint256 value, bytes calldata callData) = ExecLib.decodeSingle(executionCallData);
//             if (!_checkPermission(msg.sender, id, callType, target, callData, value)) {
//                 revert CallViolatesParamRule();
//             }
//         } else if (callType == CALLTYPE_BATCH) {
//             Execution[] calldata exec = ExecLib.decodeBatch(executionCallData);
//             for (uint256 i = 0; i < exec.length; i++) {
//                 if (
//                     !_checkPermission(
//                         msg.sender, id, CALLTYPE_SINGLE, exec[i].target, exec[i].callData, exec[i].value
//                     )
//                 ) {
//                     revert CallViolatesParamRule();
//                 }
//             }
//         } else if (callType == CALLTYPE_DELEGATECALL) {
//             address target = address(bytes20(executionCallData[0:20]));
//             bytes calldata callData = executionCallData[20:];
//             if (!_checkPermission(msg.sender, id, callType, target, callData, 0)) {
//                 revert CallViolatesParamRule();
//             }
//         } else {
//             revert InvalidCallType();
//         }

//         return 0;
//     }

//     function _checkPermission(
//         address wallet,
//         bytes32 id,
//         CallType callType,
//         address target,
//         bytes calldata data,
//         uint256 value
//     ) internal returns (bool) {
//         // get selector of the operation
//         bytes4 selector = data.length == 0 ? bytes4(0x0) : bytes4(data[0:4]);
        
//         // compute permission hash
//         bytes32 permissionHash = keccak256(abi.encodePacked(callType, target, selector));

//         // get stored permission
//         StoredPermission storage sp = storedPermissions[id][wallet][permissionHash];
        
//         // wildcard by selector (in case when it is not eth transfer with exact address)
//         if (!sp.exists) {

//             // wildcard by target (address(0))
//             bytes32 wildcardHash = keccak256(abi.encodePacked(callType, address(0), selector));
//             sp = storedPermissions[id][wallet][wildcardHash];
            
//             // still not found -> error
//             if (!sp.exists) revert InvalidCallData();
//         }

//         // get asset transfer details
//         (address asset, uint256 amount, address recipient, bool isAssetTransfer) = _decodeAssetAndAmount(callType, target, data, value);

//         if (isAssetTransfer) {
//             // Check token and limits
//             _checkTokenLimits(id, wallet, asset, amount);

//             // Check recipient (real address)
//             _checkRecipient(id, wallet, asset, recipient);
//         } else {
//             // Fallback: old behavior for non-asset calls (e.g. some contract calls)
//             if (value > sp.valueLimit) revert CallViolatesValueRule();

//             if (sp.dailyLimit > 0) {
//                 uint256 day = block.timestamp / 1 days;
//                 uint256 used = dailyUsed[id][wallet][permissionHash][day];
//                 if (used + value > sp.dailyLimit) revert CallViolatesDailyLimit();
//                 dailyUsed[id][wallet][permissionHash][day] = used + value;
//             }
//         }

//         // Check ParamRule (offset-based rules on calldata)
//         for (uint256 i = 0; i < sp.rules.length; i++) {
//             ParamRule memory rule = sp.rules[i];
//             bytes32 param = bytes32(data.length >= 4 + rule.offset + 32 ? data[4 + rule.offset:4 + rule.offset + 32] : bytes(""));

//             if (rule.condition == ParamCondition.EQUAL && param != rule.params[0]) return false;
//             if (rule.condition == ParamCondition.GREATER_THAN && param <= rule.params[0]) return false;
//             if (rule.condition == ParamCondition.LESS_THAN && param >= rule.params[0]) return false;
//             if (rule.condition == ParamCondition.GREATER_THAN_OR_EQUAL && param < rule.params[0]) return false;
//             if (rule.condition == ParamCondition.LESS_THAN_OR_EQUAL && param > rule.params[0]) return false;
//             if (rule.condition == ParamCondition.NOT_EQUAL && param == rule.params[0]) return false;
//             if (rule.condition == ParamCondition.ONE_OF) {
//                 bool found;
//                 for (uint256 j = 0; j < rule.params.length; j++) {
//                     if (param == rule.params[j]) {
//                         found = true;
//                     }
//                 }
//                 if (!found) return false;
//             }
//         }
//         return true;
//     }

//     function checkSignaturePolicy(bytes32 id, address, bytes32, bytes calldata)
//         external
//         view
//         override
//         returns (uint256)
//     {
//         require(status[id][msg.sender] == Status.Live);
//         return 0;
//     }
// }
