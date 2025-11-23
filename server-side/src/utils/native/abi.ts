import { parseAbi } from "viem";

export const kernelAbi = parseAbi([
  "function execute(bytes32 mode, bytes execCalldata) payable",
  "function rootValidator() view returns (bytes21)",
  "function currentNonce() view returns (uint32)",
  "function validationConfig(bytes21 vId) view returns (uint32 nonce, address hook)",
  "function isAllowedSelector(bytes21 vId, bytes4 selector) view returns (bool)",
  "function grantAccess(bytes21 vId, bytes4 selector, bool allow) payable",
]);

export const kernelAbiGrant = parseAbi([
  "function grantAccess(bytes21 vId, bytes4 selector, bool allow) payable",
]);

export const kernelInstallValidationsAbi = parseAbi([
  "function installValidations(bytes21[] vIds, (uint32 nonce,address hook)[] configs, bytes[] validationData, bytes[] hookData)",
  "function uninstallValidation(bytes21 vIds, bytes deinitData, bytes hookDeinitData)",
]);

export const entryPointAbi = parseAbi([
  "function getNonce(address sender, uint192 key) view returns (uint256)",
  "function getUserOpHash((address sender,uint256 nonce,bytes initCode,bytes callData,bytes32 accountGasLimits,uint256 preVerificationGas,bytes32 gasFees,bytes paymasterAndData,bytes signature) userOp) view returns (bytes32)",
  "function simulateHandleOp((address sender,uint256 nonce,bytes initCode,bytes callData,bytes32 accountGasLimits,uint256 preVerificationGas,bytes32 gasFees,bytes paymasterAndData,bytes signature) op, address target, bytes signature) view returns (uint256, uint256)"
]);

export const stakeAbi = parseAbi(["function depositTo(address account) payable"]);

export const callPolicyAbi = [
  // ---------------- VIEW FUNCTIONS (PUBLIC MAPPINGS) ----------------
  {
    inputs: [{ name: "wallet", type: "address" }],
    name: "isInitialized",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "wallet", type: "address" },
      { name: "id", type: "bytes32" },
    ],
    name: "status",
    outputs: [{ name: "", type: "uint8" }], // 0 = NA, 1 = Live, 2 = Deprecated
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "wallet", type: "address" },
      { name: "id", type: "bytes32" },
    ],
    name: "delegatedKeys",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "wallet", type: "address" },
      { name: "id", type: "bytes32" },
      { name: "permissionHash", type: "bytes32" },
    ],
    name: "storedPermissions",
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          {
            name: "rules",
            type: "tuple[]",
            components: [
              { name: "condition", type: "uint8" },
              { name: "offset", type: "uint64" },
              { name: "params", type: "bytes32[]" },
            ],
          },
          { name: "delegatedKey", type: "address" },
          { name: "exists", type: "bool" },
        ],
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "wallet", type: "address" },
      { name: "id", type: "bytes32" },
      { name: "index", type: "uint256" },
    ],
    name: "permissionHashes",
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "wallet", type: "address" },
      { name: "id", type: "bytes32" },
      { name: "index", type: "uint256" },
    ],
    name: "allowedTokens",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "wallet", type: "address" },
      { name: "id", type: "bytes32" },
      { name: "token", type: "address" },
    ],
    name: "tokenLimits",
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "enabled", type: "bool" },
          { name: "txLimit", type: "uint256" },
          { name: "dailyLimit", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "wallet", type: "address" },
      { name: "id", type: "bytes32" },
      { name: "token", type: "address" },
      { name: "day", type: "uint256" },
    ],
    name: "tokenDailyUsed",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "wallet", type: "address" },
      { name: "id", type: "bytes32" },
      { name: "index", type: "uint256" },
    ],
    name: "recipientList",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "wallet", type: "address" },
      { name: "id", type: "bytes32" },
      { name: "recipient", type: "address" },
    ],
    name: "recipientAllowed",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },

  // ---------------- STATE-CHANGING FUNCTIONS ----------------
  {
    inputs: [
      { name: "id", type: "bytes32" },
      { name: "wallet", type: "address" },
      { name: "tokens", type: "address[]" },
      { name: "enabled", type: "bool[]" },
      { name: "txLimit", type: "uint256[]" },
      { name: "dailyLimit", type: "uint256[]" },
    ],
    name: "setTokenLimit",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "id", type: "bytes32" },
      { name: "wallet", type: "address" },
      { name: "recipients", type: "address[]" },
      { name: "allowed", type: "bool[]" },
    ],
    name: "setRecipientAllowed",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  // ---------------- POLICY CHECK FUNCTIONS ----------------
  {
    inputs: [
      { name: "id", type: "bytes32" },
      {
        name: "userOp",
        type: "tuple",
        components: [
          { name: "sender", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "initCode", type: "bytes" },
          { name: "callData", type: "bytes" },
          { name: "accountGasLimits", type: "bytes32" },
          { name: "preVerificationGas", type: "uint256" },
          { name: "gasFees", type: "bytes32" },
          { name: "paymasterAndData", type: "bytes" },
          { name: "signature", type: "bytes" },
        ],
      },
    ],
    name: "checkUserOpPolicy",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      { name: "id", type: "bytes32" },
      { name: "sender", type: "address" },
      { name: "hash", type: "bytes32" },
      { name: "sig", type: "bytes" },
    ],
    name: "checkSignaturePolicy",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },

  // ---------------- EVENTS ----------------
  {
    type: "event",
    name: "PermissionInstalled",
    inputs: [
      { name: "id", type: "bytes32", indexed: true },
      { name: "wallet", type: "address", indexed: true },
      { name: "delegatedKey", type: "address", indexed: true },
      { name: "permissionHash", type: "bytes32", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PermissionRemoved",
    inputs: [
      { name: "id", type: "bytes32", indexed: true },
      { name: "wallet", type: "address", indexed: true },
      { name: "permissionHash", type: "bytes32", indexed: true },
    ],
  },
  {
    type: "event",
    name: "TokenLimitSet",
    inputs: [
      { name: "id", type: "bytes32", indexed: true },
      { name: "wallet", type: "address", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "enabled", type: "bool", indexed: false },
      { name: "txLimit", type: "uint256", indexed: false },
      { name: "dailyLimit", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "RecipientAllowed",
    inputs: [
      { name: "id", type: "bytes32", indexed: true },
      { name: "wallet", type: "address", indexed: true },
      { name: "recipient", type: "address", indexed: true },
      { name: "allowed", type: "bool", indexed: false },
    ],
  },

  // ---------------- CUSTOM ERRORS ----------------
  {
    type: "error",
    name: "InvalidCallType",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidCallData",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidSelector",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidDelegatedKey",
    inputs: [],
  },
  {
    type: "error",
    name: "EmptyPermissions",
    inputs: [],
  },
  {
    type: "error",
    name: "InconsistentDelegatedKey",
    inputs: [],
  },
  {
    type: "error",
    name: "CallViolatesParamRule",
    inputs: [],
  },
  {
    type: "error",
    name: "NotWallet",
    inputs: [],
  },
  {
    type: "error",
    name: "NotLive",
    inputs: [],
  },
  {
    type: "error",
    name: "PolicyAlreadyInstalled",
    inputs: [
      { name: "id", type: "bytes32" },
      { name: "wallet", type: "address" },
    ],
  },
  {
    type: "error",
    name: "DuplicatePermission",
    inputs: [],
  },
  {
    type: "error",
    name: "PermissionNotFound",
    inputs: [],
  },
  {
    type: "error",
    name: "TokenNotAllowed",
    inputs: [{ name: "asset", type: "address" }],
  },
  {
    type: "error",
    name: "TokenTxLimitExceeded",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "limit", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "TokenDailyLimitExceeded",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "used", type: "uint256" },
      { name: "limit", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "RecipientNotAllowed",
    inputs: [
      { name: "asset", type: "address" },
      { name: "recipient", type: "address" },
    ],
  },
  {
    type: "error",
    name: "LengthMismatch",
    inputs: [],
  },
  {
    type: "error",
    name: "OnlyAssetTransfersAllowed",
    inputs: [],
  },
] as const;