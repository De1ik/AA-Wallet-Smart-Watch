import {
  Address,
  Hex,
  concat,
  createPublicClient,
  encodeFunctionData,
  getFunctionSelector,
  http,
  pad,
  parseAbi,
  toHex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getEntryPointAddress, getKernelAddress, getPrivateKey, getZeroDevRpc } from '@/config/env';
import { publicClient, ENTRY_POINT_V7 } from '@/services/blockchain/config';
import {
  DEFAULT_BUNDLER_RPC_URL,
  DEFAULT_KERNEL,
  MAX_FEE_PER_GAS,
  MAX_PRIORITY_FEE,
} from './constants';

const resolveEnvAddress = (value: string | undefined, fallback: Address): Address => {
  if (value && value.trim().length > 0) {
    return value as Address;
  }
  return fallback;
};

const resolveEnvUrl = (value: string | undefined, fallback: string): string => {
  if (value && value.trim().length > 0) {
    return value;
  }
  return fallback;
};

const ENTRY_POINT: Address = resolveEnvAddress(getEntryPointAddress(), ENTRY_POINT_V7 as Address);
const KERNEL: Address = resolveEnvAddress(getKernelAddress(), DEFAULT_KERNEL);

const bundlerRpcUrl = resolveEnvUrl(getZeroDevRpc(), DEFAULT_BUNDLER_RPC_URL);
const bundlerClient = createPublicClient({ transport: http(bundlerRpcUrl) });

const kernelAbi = parseAbi([
  'function execute(bytes32 mode, bytes execCalldata) payable',
  'function rootValidator() view returns (bytes21)',
  'function validationConfig(bytes21 vId) view returns (uint32 nonce, address hook)',
]);

const entryPointAbi = parseAbi([
  'function getNonce(address sender, uint192 key) view returns (uint256)',
  'function getUserOpHash((address sender,uint256 nonce,bytes initCode,bytes callData,bytes32 accountGasLimits,uint256 preVerificationGas,bytes32 gasFees,bytes paymasterAndData,bytes signature) userOp) view returns (bytes32)',
]);

const EXECUTE_USER_OP_SELECTOR: Hex =
  getFunctionSelector('function executeUserOp((address,uint256,bytes,bytes,bytes32,uint256,bytes32,bytes,bytes) userOp, bytes32 userOpHash)');

const EXEC_MODE_SIMPLE_SINGLE: Hex = ('0x' + '00' + '00' + '00000000' + '00000000' + '00'.repeat(22)) as Hex;

type PackedUserOperation = {
  sender: Address;
  nonce: bigint;
  initCode: Hex;
  callData: Hex;
  accountGasLimits: Hex;
  preVerificationGas: bigint;
  gasFees: Hex;
  paymasterAndData: Hex;
  signature: Hex;
};

type UnpackedUserOperationV07 = {
  sender: Address;
  nonce: Hex;
  callData: Hex;
  callGasLimit: Hex;
  verificationGasLimit: Hex;
  preVerificationGas: Hex;
  maxPriorityFeePerGas: Hex;
  maxFeePerGas: Hex;
  signature: Hex;
};

const getRootAccount = () => {
  const privateKey = getPrivateKey();
  if (!privateKey) {
    throw new Error('PRIVATE_KEY is not set in environment');
  }
  return privateKeyToAccount(privateKey as Hex);
};

const packAccountGasLimits = (verificationGasLimit: bigint, callGasLimit: bigint): Hex => {
  const hi = pad(toHex(verificationGasLimit), { size: 16 }).slice(2);
  const lo = pad(toHex(callGasLimit), { size: 16 }).slice(2);
  return ('0x' + hi + lo) as Hex;
};

const packGasFees = (maxPriorityFeePerGas: bigint, maxFeePerGas: bigint): Hex => {
  const hi = pad(toHex(maxPriorityFeePerGas), { size: 16 }).slice(2);
  const lo = pad(toHex(maxFeePerGas), { size: 16 }).slice(2);
  return ('0x' + hi + lo) as Hex;
};

const encodeSingle = (target: Address, value: bigint, callData: Hex): Hex => {
  const addr20 = target.toLowerCase().replace(/^0x/, '');
  const value32 = pad(toHex(value), { size: 32 }).slice(2);
  return ('0x' + addr20 + value32 + callData.slice(2)) as Hex;
};

const rootHookRequiresPrefix = async (): Promise<boolean> => {
  const vId = (await publicClient.readContract({
    address: KERNEL,
    abi: kernelAbi,
    functionName: 'rootValidator',
  })) as Hex;

  const [, hook] = (await publicClient.readContract({
    address: KERNEL,
    abi: kernelAbi,
    functionName: 'validationConfig',
    args: [vId],
  })) as readonly [number, Address];

  const sentinel = ('0x' + '0'.repeat(39) + '1') as Address;
  return hook.toLowerCase() !== sentinel.toLowerCase();
};

const buildExecuteCallData = (execMode: Hex, execData: Hex, prefix: boolean): Hex => {
  const inner = encodeFunctionData({
    abi: kernelAbi,
    functionName: 'execute',
    args: [execMode, execData],
  });
  return prefix ? concat([EXECUTE_USER_OP_SELECTOR, inner]) : inner;
};

export async function sendUserOpV07(unpacked: UnpackedUserOperationV07) {
  const uoHash = (await (bundlerClient as any).request({
    method: 'eth_sendUserOperation',
    params: [unpacked, ENTRY_POINT],
  })) as Hex;
  return uoHash;
}

export async function buildSendRootUO(target: Address, value: bigint, data: Hex = '0x') {
  const root = getRootAccount();

  const execData = encodeSingle(target, value, data);
  const callData = buildExecuteCallData(EXEC_MODE_SIMPLE_SINGLE, execData, await rootHookRequiresPrefix());

  const verificationGasLimit = 350_000n;
  const callGasLimit = 600_000n;
  const preVerificationGas = 100_000n;
  const accountGasLimits = packAccountGasLimits(verificationGasLimit, callGasLimit);
  const gasFees = packGasFees(MAX_PRIORITY_FEE, MAX_FEE_PER_GAS);

  const key192 = '0x' + '00'.repeat(24);
  const nonce64 = (await publicClient.readContract({
    address: ENTRY_POINT,
    abi: entryPointAbi,
    functionName: 'getNonce',
    args: [KERNEL, BigInt(key192)],
  })) as bigint;

  const packed: PackedUserOperation = {
    sender: KERNEL,
    nonce: nonce64,
    initCode: '0x',
    callData,
    accountGasLimits,
    preVerificationGas,
    gasFees,
    paymasterAndData: '0x',
    signature: '0x',
  };

  const userOpHash = (await publicClient.readContract({
    address: ENTRY_POINT,
    abi: entryPointAbi,
    functionName: 'getUserOpHash',
    args: [packed],
  })) as Hex;

  const unpacked: UnpackedUserOperationV07 = {
    sender: KERNEL,
    nonce: toHex(nonce64),
    callData,
    callGasLimit: toHex(callGasLimit),
    verificationGasLimit: toHex(verificationGasLimit),
    preVerificationGas: toHex(preVerificationGas),
    maxPriorityFeePerGas: toHex(MAX_PRIORITY_FEE),
    maxFeePerGas: toHex(MAX_FEE_PER_GAS),
    signature: (await root.signMessage({ message: { raw: userOpHash } })) as Hex,
  };

  return { packed, unpacked, userOpHash };
}
