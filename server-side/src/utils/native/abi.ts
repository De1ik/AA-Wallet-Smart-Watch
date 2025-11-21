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
]);

export const stakeAbi = parseAbi(["function depositTo(address account) payable"]);

export const callPolicyAbi = [
  {
    inputs: [{ name: "wallet", type: "address" }],
    name: "isInitialized",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "id", type: "bytes32" },
      { name: "owner", type: "address" },
    ],
    name: "getPermissionsCount",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "id", type: "bytes32" },
      { name: "owner", type: "address" },
      { name: "index", type: "uint256" },
    ],
    name: "getPermissionByIndex",
    outputs: [
      { name: "permissionHash", type: "bytes32" },
      { name: "valueLimit", type: "uint256" },
      { name: "dailyLimit", type: "uint256" },
      {
        name: "rules",
        type: "tuple[]",
        components: [
          { name: "condition", type: "uint8" },
          { name: "offset", type: "uint64" },
          { name: "params", type: "bytes32[]" },
        ],
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "id", type: "bytes32" },
      { name: "permissionHash", type: "bytes32" },
      { name: "owner", type: "address" },
    ],
    name: "getPermission",
    outputs: [
      { name: "valueLimit", type: "uint256" },
      { name: "dailyLimit", type: "uint256" },
      {
        name: "rules",
        type: "tuple[]",
        components: [
          { name: "condition", type: "uint8" },
          { name: "offset", type: "uint64" },
          { name: "params", type: "bytes32[]" },
        ],
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "id", type: "bytes32" },
      { name: "wallet", type: "address" },
      { name: "callType", type: "uint8" },
      { name: "target", type: "address" },
      { name: "selector", type: "bytes4" },
      { name: "newValueLimit", type: "uint256" },
      { name: "newDailyLimit", type: "uint256" },
    ],
    name: "updatePermissionLimits",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "id", type: "bytes32" },
      { name: "wallet", type: "address" },
      { name: "permissionHash", type: "bytes32" },
      { name: "day", type: "uint256" },
    ],
    name: "dailyUsed",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        name: "id",
        type: "bytes32",
      },
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
] as const;
