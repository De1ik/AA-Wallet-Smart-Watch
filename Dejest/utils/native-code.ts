import {
    Address, Hex, createPublicClient, http, encodeFunctionData,
    concat, pad, toHex, getFunctionSelector, parseAbi, parseEther, formatEther,
    encodeAbiParameters, keccak256, zeroAddress,
    parseAbiParameters,
    custom,
    createWalletClient,
    decodeAbiParameters
  } from 'viem'
  import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
  import { mainnet, sepolia } from 'viem/chains'

  
    export const FACTORY: `0x${string}` = "0x2577507b78c2008Ff367261CB6285d44ba5eF2E9";
    export const VALIDATOR: `0x${string}` = "0x845ADb2C711129d4f3966735eD98a9F09fC4cE57";
    export const ENTRY_POINT_V7: `0x${string}` = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
  
  
  
  // ===== CONFIG =====
  const ENTRY_POINT: Address = ENTRY_POINT_V7
  // const KERNEL: Address      = '0x6406c7D4972fa71e83AF0a577CDF40dD0caE963a'
  const KERNEL: Address      = '0xB115dc375D7Ad88D7c7a2180D0E548Cb5B83D86A'
  const BUNDLER_RPC_URL      = 'https://api.pimlico.io/v2/11155111/rpc?apikey=pim_TSXZcxdAYixqPvzchXp64f'
  const ETH_RPC_URL          = 'https://sepolia.infura.io/v3/7df085afafad4becaad36c48fb162932'
  
  // root / delegated
  const ROOT_PRIV       = '0x5b90e4bb58e7731445eb523f9409e4b47f29f5356cf7df6873559623e60761e0'
  // const DELEGATED_PK    = '0x20383bc29b876e46b53b71e40c132ebecc6dc5747c79f6017c24813d999e1e8b'
  const DELEGATED_PK    = '0xeb020020f40c89748cfbcd6f455d3251ee5aa201237553c31bc7353a8b6dadfa'
  const delegated       = privateKeyToAccount(DELEGATED_PK as Hex)
  const root            = privateKeyToAccount(ROOT_PRIV as Hex)
  
  // modules
  const ECDSA_SIGNER: Address = '0x6A6F069E2a08c2468e7724Ab3250CdBFBA14D4FF'
  const SUDO_POLICY:  Address = '0x67b436caD8a6D025DF6C82C5BB43fbF11fC5B9B7'
  
  // fees / amounts
  // const MAX_FEE_PER_GAS  = 30n * 10n ** 9n
  // const MAX_PRIORITY_FEE =  2n * 10n ** 9n
  const MAX_FEE_PER_GAS    = 5n * 10n ** 9n   // 5 gwei
  const MAX_PRIORITY_FEE   = 1n * 10n ** 9n   // 1 gwei
  const DEPOSIT_AMOUNT   = parseEther('0.003')
  
  // test transfer
  const TARGET: Address  = '0xe069d36Fe1f7B41c7B8D4d453d99D4D86d620c15'
  const TARGET_AMOUNT    = parseEther('0.00001')
  const TARGET_DATA: Hex = '0x'
  
  // ===== ABIs =====
  const kernelAbi = parseAbi([
    'function execute(bytes32 mode, bytes execCalldata) payable',
    'function rootValidator() view returns (bytes21)',
    'function currentNonce() view returns (uint32)',
    'function validationConfig(bytes21 vId) view returns (uint32 nonce, address hook)',
    'function isAllowedSelector(bytes21 vId, bytes4 selector) view returns (bool)',
    'function DOMAIN_SEPARATOR() view returns (bytes32)', // EIP712 (Solady)
    'function grantAccess(bytes21 vId, bytes4 selector, bool allow) payable',
  ])
  
  const kernelAbiGrant = parseAbi([
    'function grantAccess(bytes21 vId, bytes4 selector, bool allow) payable',
  ])
  
  const kernelInstallValidationsAbi = parseAbi([
    'function installValidations(bytes21[] vIds, (uint32 nonce,address hook)[] configs, bytes[] validationData, bytes[] hookData)',
    'function uninstallValidation(bytes21 vIds, bytes deinitData, bytes hookDeinitData)',
  ])
  
  const entryPointAbi = parseAbi([
    'function getNonce(address sender, uint192 key) view returns (uint256)',
    'function getUserOpHash((address sender,uint256 nonce,bytes initCode,bytes callData,bytes32 accountGasLimits,uint256 preVerificationGas,bytes32 gasFees,bytes paymasterAndData,bytes signature) userOp) view returns (bytes32)',
  ])
  
  const stakeAbi = parseAbi([
    'function depositTo(address account) payable',
  ])
  
  // ===== Clients =====
  const publicClient  = createPublicClient({ chain: sepolia, transport: http(ETH_RPC_URL) })
  const bundlerClient = createPublicClient({ transport: http(BUNDLER_RPC_URL) })
  
  // ===== Helpers (packing) =====
  // EIP-4337 v0.7 packed UO
  type PackedUserOperation = {
    sender: Address
    nonce: bigint
    initCode: Hex
    callData: Hex
    accountGasLimits: Hex
    preVerificationGas: bigint
    gasFees: Hex
    paymasterAndData: Hex
    signature: Hex
  }
  type UnpackedUserOperationV07 = {
    sender: Address
    nonce: Hex
    callData: Hex
    callGasLimit: Hex
    verificationGasLimit: Hex
    preVerificationGas: Hex
    maxPriorityFeePerGas: Hex
    maxFeePerGas: Hex
    signature: Hex
  }
  
  interface UserOperation {
    sender: `0x${string}`
    nonce: bigint
    callData: `0x${string}`
    callGasLimit: bigint
    verificationGasLimit: bigint
    preVerificationGas: bigint
    maxFeePerGas: bigint
    maxPriorityFeePerGas: bigint
    signature: `0x${string}`
  }
  
  const EXECUTE_USER_OP_SELECTOR: Hex =
    getFunctionSelector('function executeUserOp((address,uint256,bytes,bytes,bytes32,uint256,bytes32,bytes,bytes) userOp, bytes32 userOpHash)')
  
  const EXEC_MODE_SIMPLE_SINGLE: Hex = ('0x' + '00' + '00' + '00000000' + '00000000' + '00'.repeat(22)) as Hex
  
  function packAccountGasLimits(verificationGasLimit: bigint, callGasLimit: bigint): Hex {
    const hi = pad(toHex(verificationGasLimit), { size: 16 }).slice(2)
    const lo = pad(toHex(callGasLimit),        { size: 16 }).slice(2)
    return ('0x' + hi + lo) as Hex
  }
  function packGasFees(maxPriorityFeePerGas: bigint, maxFeePerGas: bigint): Hex {
    const hi = pad(toHex(maxPriorityFeePerGas), { size: 16 }).slice(2)
    const lo = pad(toHex(maxFeePerGas),         { size: 16 }).slice(2)
    return ('0x' + hi + lo) as Hex
  }
  function encodeSingle(target: Address, value: bigint, callData: Hex): Hex {
    const addr20  = (target.toLowerCase() as string).replace(/^0x/, '')
    const value32 = pad(toHex(value), { size: 32 }).slice(2)
    return ('0x' + addr20 + value32 + callData.slice(2)) as Hex
  }
  async function rootHookRequiresPrefix(): Promise<boolean> {
    const vId = await publicClient.readContract({
      address: KERNEL, abi: kernelAbi, functionName: 'rootValidator'
    }) as Hex
    const [/*nonce*/, hook] = await publicClient.readContract({
      address: KERNEL, abi: kernelAbi, functionName: 'validationConfig', args: [vId]
    }) as readonly [number, Address]
    const addr1 = ('0x' + '0'.repeat(39) + '1') as Address
    return !(hook.toLowerCase() === addr1.toLowerCase())
  }
  function buildExecuteCallData(execMode: Hex, execData: Hex, prefix: boolean): Hex {
    const inner = encodeFunctionData({ abi: kernelAbi, functionName: 'execute', args: [execMode, execData] })
    return prefix ? concat([EXECUTE_USER_OP_SELECTOR, inner]) : inner
  }
  
  // ===== [KERNEL v3: Validation IDs & nonces] =====
  // >>> FIX: правильное формирование vId для PERMISSION (тип-байт 0x02 в НАЧАЛЕ)
  function vIdFromPermissionId(permissionId4: Hex): Hex {
    // bytes21: [0x02 | 16*00 | permissionId(4)]
    const tail20 = ('0x' + permissionId4.slice(2) + '00'.repeat(16)) as Hex
    return (('0x02' + tail20.slice(2)) as Hex)
  }
  // 20-байтовая часть идентификатора (без типа) — нужна для nonceKey
  function identifierWithoutTypeFromPermissionId(permissionId4: Hex): Hex {
    return ('0x' + permissionId4.slice(2) + '00'.repeat(16)) as Hex
  }
  
  // >>> NEW: encodeAsNonceKey / encodeAsNonce (копия макета из ValidationTypeLib)
  function encodeAsNonceKey(mode: number, vType: number, id20: Hex, nonceKey: number): bigint {
    // layout (192 bits): mode(1) | type(1) | id20(20) | nonceKey(2)
    const m  = BigInt(mode & 0xff) << 184n
    const t  = BigInt(vType & 0xff) << 176n
    const id = BigInt(id20) << 16n
    const k  = BigInt(nonceKey & 0xffff)
    return m | t | id | k
  }
  function encodeAsNonce(mode: number, vType: number, id20: Hex, nonceKey: number, nonce64: bigint): bigint {
    // full 256 bits: [mode|type|id20|nonceKey|nonce64]
    const hi = encodeAsNonceKey(mode, vType, id20, nonceKey) << 64n
    return hi | (nonce64 & ((1n<<64n)-1n))
  }
  
  // ===== Permission data packing =====
  const SKIP_NONE: Hex = '0x0000'
  const HOOK_SENTINEL: Address = '0x0000000000000000000000000000000000000001'
  const SEL_EXECUTE: Hex = '0xe9ae5c53'
  const SEL_1271:   Hex = '0x1626ba7e'
  
  // >>> FIX: элемент permission bytes = [2b flag | 20b module | payload...]
  export function packPermissionElem(flag2bytes: Hex, moduleAddr: Address, payload: Hex = '0x'): Hex {
    const flag = flag2bytes.slice(2).padStart(4, '0')        // 2 bytes
    const mod  = moduleAddr.toLowerCase().slice(2)           // 20 bytes
    const tail = payload.slice(2)
    return ('0x' + flag + mod + tail) as Hex
  }
  
  // >>> FIX: validationData = abi.encode(PermissionEnableDataFormat({ data: bytes[] }))
  export function buildPermissionValidationData(delegatedEOA: Address): Hex {
    const policyElem = packPermissionElem(SKIP_NONE, SUDO_POLICY, '0x') // sudo policy без payload
    // signer payload = РОВНО 20 байт адреса делегированного EOA
    const signerPayload = ('0x' + delegatedEOA.toLowerCase().slice(2)) as Hex
    const signerElem = packPermissionElem(SKIP_NONE, ECDSA_SIGNER, signerPayload)
  
    // abi.encode(bytes[] data)
    return encodeAbiParameters([{ type: 'bytes[]' }], [[policyElem, signerElem]]) as Hex
  }
  
  // >>> NEW: userOpSig для permission: [ idx=0 len=0 ] + [ 0xff ] + [ECDSA 65b]
  function buildPermissionUserOpSig(delegatedSig65: Hex, policiesCount = 1): Hex {
    // sudo-policy одна: idx=0x00, length=0x0000000000000000
    const policyPrefix = '00' + '00'.repeat(8) // 1 байт idx + 8 байт length(=0)
    return ('0x' + policyPrefix + 'ff' + delegatedSig65.slice(2)) as Hex
  }
  
  // ===== Gas helpers & bundler =====
  export async function estimateAndPatch(unpacked: UnpackedUserOperationV07) {
    try {
      const est = await (bundlerClient as any).request({
        method: 'eth_estimateUserOperationGas',
        params: [unpacked, ENTRY_POINT],
      }) as { preVerificationGas: Hex; verificationGasLimit: Hex; callGasLimit: Hex }
  
      unpacked.preVerificationGas   = est.preVerificationGas
      unpacked.verificationGasLimit = est.verificationGasLimit
      unpacked.callGasLimit         = est.callGasLimit
    } catch {}
    return unpacked
  }
  export async function sendUserOpV07(unpacked: UnpackedUserOperationV07) {
    const uoHash = await (bundlerClient as any).request({
      method: 'eth_sendUserOperation',
      params: [unpacked, ENTRY_POINT],
    }) as Hex
    return uoHash
  }
  
  
  /** ====== Build a deposit UserOp from Kernel ====== **/
  export async function buildDepositUserOp(depositAmount: bigint, nonceKey = 0) {
  
    const depositCalldata = encodeFunctionData({
      abi: stakeAbi,
      functionName: 'depositTo',
      args: [KERNEL],
    })
    const execData = encodeSingle(ENTRY_POINT, depositAmount, depositCalldata)
    const callData = buildExecuteCallData(EXEC_MODE_SIMPLE_SINGLE, execData, await rootHookRequiresPrefix())
  
    // соберём root-lane UO
    let verificationGasLimit = 350_000n
    let callGasLimit         = 600_000n
    let preVerificationGas   = 100_000n
    const accountGasLimits   = packAccountGasLimits(verificationGasLimit, callGasLimit)
    const gasFees            = packGasFees(MAX_PRIORITY_FEE, MAX_FEE_PER_GAS)
  
    // root lane key (mode=0x00,type=0x00)
    // const id20= '0x' + '00'.repeat(20) as Hex
    // const key192 = encodeAsNonceKey(0x01, 0x02, id20, nonceKey)
    const key192   = '0x' + '00'.repeat(24) as Hex
    const nonce64  = await publicClient.readContract({
      address: ENTRY_POINT, abi: entryPointAbi, functionName: 'getNonce',
      args: [KERNEL, BigInt(key192)],
    }) as bigint
    const nonceFull = nonce64 // root используется стандартно как в твоём коде
  
    const packed: PackedUserOperation = {
      sender: KERNEL, nonce: nonceFull, initCode: '0x', callData,
      accountGasLimits, preVerificationGas, gasFees, paymasterAndData: '0x', signature: '0x'
    }
    const userOpHash = await publicClient.readContract({
      address: ENTRY_POINT, abi: entryPointAbi, functionName: 'getUserOpHash', args: [packed]
    }) as Hex
  
    const unpacked: UnpackedUserOperationV07 = {
      sender: KERNEL,
      nonce: toHex(nonceFull),
      callData,
      callGasLimit:         toHex(callGasLimit),
      verificationGasLimit: toHex(verificationGasLimit),
      preVerificationGas:   toHex(preVerificationGas),
      maxPriorityFeePerGas: toHex(MAX_PRIORITY_FEE),
      maxFeePerGas:         toHex(MAX_FEE_PER_GAS),
      signature: (await root.signMessage({ message: { raw: userOpHash } })) as Hex, // root ECDSA
    }
    return { packed, unpacked, userOpHash };
  }
  
  
  // ===== SEND BY ROOT =====
  export async function buildSendRootUO(target: Address, value: bigint, data: Hex = '0x', nonceKey = 0) {
  
    const execData = encodeSingle(target, value, data);
    const callData = buildExecuteCallData(EXEC_MODE_SIMPLE_SINGLE, execData, await rootHookRequiresPrefix())
  
    // соберём root-lane UO
    // let verificationGasLimit = 120_000n
    // let callGasLimit         = 100_000n
    // let preVerificationGas   = 40_000n
    let verificationGasLimit = 350_000n
    let callGasLimit         = 600_000n
    let preVerificationGas   = 100_000n
    const accountGasLimits   = packAccountGasLimits(verificationGasLimit, callGasLimit)
    const gasFees            = packGasFees(MAX_PRIORITY_FEE, MAX_FEE_PER_GAS)
  
    // root lane key (mode=0x00,type=0x00)
    // const id20= '0x' + '00'.repeat(20) as Hex
    // const key192 = encodeAsNonceKey(0x01, 0x02, id20, nonceKey)
    const key192   = '0x' + '00'.repeat(24) as Hex
    const nonce64  = await publicClient.readContract({
      address: ENTRY_POINT, abi: entryPointAbi, functionName: 'getNonce',
      args: [KERNEL, BigInt(key192)],
    }) as bigint
    const nonceFull = nonce64 // root используется стандартно как в твоём коде
  
    const packed: PackedUserOperation = {
      sender: KERNEL, nonce: nonceFull, initCode: '0x', callData,
      accountGasLimits, preVerificationGas, gasFees, paymasterAndData: '0x', signature: '0x'
    }
    const userOpHash = await publicClient.readContract({
      address: ENTRY_POINT, abi: entryPointAbi, functionName: 'getUserOpHash', args: [packed]
    }) as Hex
  
    const unpacked: UnpackedUserOperationV07 = {
      sender: KERNEL,
      nonce: toHex(nonceFull),
      callData,
      callGasLimit:         toHex(callGasLimit),
      verificationGasLimit: toHex(verificationGasLimit),
      preVerificationGas:   toHex(preVerificationGas),
      maxPriorityFeePerGas: toHex(MAX_PRIORITY_FEE),
      maxFeePerGas:         toHex(MAX_FEE_PER_GAS),
      signature: (await root.signMessage({ message: { raw: userOpHash } })) as Hex, // root ECDSA
    }
    return { packed, unpacked, userOpHash };
  }
  
  // ===== STEP 1: INSTALL permission (root lane) =====
  export async function buildInstallPermissionUO(delegatedEOA: Address) {
    // permissionId: bytes4 (просто стабильный детерминированный id)
    const permissionId = (keccak256(encodeAbiParameters(
      [{type:'address'},{type:'address'}],
      [KERNEL, delegatedEOA]
    )) as Hex).slice(0,10) as Hex // 4 bytes
  
    const vId = vIdFromPermissionId(permissionId)
    const validationData = buildPermissionValidationData(delegatedEOA)
  
    // Конфиг-нонс ядра
    const current = await publicClient.readContract({ address: KERNEL, abi: kernelAbi, functionName: 'currentNonce' }) as number
  
    const installCalldata = encodeFunctionData({
      abi: kernelInstallValidationsAbi,
      functionName: 'installValidations',
      args: [
        [vId],
        [{ nonce: current, hook: HOOK_SENTINEL }], // >>> FIX: правильный nonce + hook=address(1)
        [validationData],
        ['0x'],
      ],
    })
    const execData = encodeSingle(KERNEL, 0n, installCalldata)
    const callData = buildExecuteCallData(EXEC_MODE_SIMPLE_SINGLE, execData, await rootHookRequiresPrefix())
  
    // соберём root-lane UO
    let verificationGasLimit = 350_000n
    let callGasLimit         = 600_000n
    let preVerificationGas   = 100_000n
    const accountGasLimits   = packAccountGasLimits(verificationGasLimit, callGasLimit)
    const gasFees            = packGasFees(MAX_PRIORITY_FEE, MAX_FEE_PER_GAS)
  
    // root lane key (mode=0x00,type=0x00)
    const nonceKey = (0n).toString() // key=0
    const key192   = '0x' + '00'.repeat(24) as Hex
    const nonce64  = await publicClient.readContract({
      address: ENTRY_POINT, abi: entryPointAbi, functionName: 'getNonce',
      args: [KERNEL, BigInt(key192)],
    }) as bigint
    const nonceFull = nonce64 // root используется стандартно как в твоём коде
  
    const packed: PackedUserOperation = {
      sender: KERNEL, nonce: nonceFull, initCode: '0x', callData,
      accountGasLimits, preVerificationGas, gasFees, paymasterAndData: '0x', signature: '0x'
    }
    const userOpHash = await publicClient.readContract({
      address: ENTRY_POINT, abi: entryPointAbi, functionName: 'getUserOpHash', args: [packed]
    }) as Hex
  
    const unpacked: UnpackedUserOperationV07 = {
      sender: KERNEL,
      nonce: toHex(nonceFull),
      callData,
      callGasLimit:         toHex(callGasLimit),
      verificationGasLimit: toHex(verificationGasLimit),
      preVerificationGas:   toHex(preVerificationGas),
      maxPriorityFeePerGas: toHex(MAX_PRIORITY_FEE),
      maxFeePerGas:         toHex(MAX_FEE_PER_GAS),
      signature: (await root.signMessage({ message: { raw: userOpHash } })) as Hex, // root ECDSA
    }
    return { unpacked, permissionId, vId }
  }
  
  // ===== STEP 2: ENABLE selector execute (ENABLE mode) =====
  // строим EIP-712 digest ядра для enableSig, как в _enableDigest(...)
  export async function buildEnableSelectorUO(permissionId: Hex, vId: Hex, delegatedEOA: Address, selector: Hex) {
    const id20 = identifierWithoutTypeFromPermissionId(permissionId)
  
    // --- NONCE lane for ENABLE (mode=0x01, type=0x02 permission)
    const key192 = encodeAsNonceKey(0x01, 0x02, id20, 0) // nonceKey=0
    const nonce64 = await publicClient.readContract({
      address: ENTRY_POINT, abi: entryPointAbi, functionName: 'getNonce',
      args: [KERNEL, key192],
    }) as bigint
    const nonceFull = encodeAsNonce(0x01, 0x02, id20, 0, nonce64)
  
    // --- enable payload pieces
    const validatorData = '0x' // ничего не доустанавливаем
    const hookData      = '0x'
    const selectorData  = selector // достаточно ровно 4 байта
  
    // userOp (без callData — просто enable)
    let verificationGasLimit = 220_000n
    let callGasLimit         =  60_000n
    let preVerificationGas   =  80_000n
    const accountGasLimits   = packAccountGasLimits(verificationGasLimit, callGasLimit)
    const gasFees            = packGasFees(MAX_PRIORITY_FEE, MAX_FEE_PER_GAS)
  
    const packed: PackedUserOperation = {
      sender: KERNEL,
      nonce: nonceFull,
      initCode: '0x',
      callData: '0x',
      accountGasLimits,
      preVerificationGas,
      gasFees,
      paymasterAndData: '0x',
      signature: '0x', // заполним позже
    }
  
    const userOpHash = await publicClient.readContract({
      address: ENTRY_POINT, abi: entryPointAbi, functionName: 'getUserOpHash', args: [packed]
    }) as Hex
  
    // --- userOpSig (для permission): [idx(len=0)] + 0xff + sig(del)
    const delSig = await delegated.signMessage({ message: { raw: userOpHash } }) as Hex
    const userOpSigPermission = buildPermissionUserOpSig(delSig, 1)
  
    // --- enableSig (root, EIP-712 digest)
    // config.nonce для ENABLE берётся так же, как в _enableDigest:
    //   if (state.validationConfig[vId].nonce == state.currentNonce) use current+1 else current
    const current      = await publicClient.readContract({ address: KERNEL, abi: kernelAbi, functionName: 'currentNonce' }) as number
    const [vNonce]     = await publicClient.readContract({ address: KERNEL, abi: kernelAbi, functionName: 'validationConfig', args: [vId] }) as [number, Address]
    const enableConfigNonce = (vNonce === current) ? (current + 1) : current
  
    // ENABLE_TYPE_HASH и calldataKeccak как в контракте
    const ENABLE_TYPE_HASH = '0xb17ab1224aca0d4255ef8161acaf2ac121b8faa32a4b2258c912cc5f8308c505' as Hex
    const KERNEL_DOMAIN    = await publicClient.readContract({ address: KERNEL, abi: kernelAbi, functionName: 'DOMAIN_SEPARATOR' }) as Hex
  
    const keccak = (x: Hex) => keccak256(x) as Hex
    const enc    = (types: string, values: any[]) => encodeAbiParameters(parseAbiParameters(types), values) as Hex
  
    const structHash = keccak(enc(
      'bytes32, bytes21, uint32, address, bytes32, bytes32, bytes32',
      [
        ENABLE_TYPE_HASH,
        vId,
        enableConfigNonce,
        HOOK_SENTINEL,
        keccak(validatorData),
        keccak(hookData),
        keccak(selectorData),
      ]
    ))
  
    const digest = keccak(('0x1901' + KERNEL_DOMAIN.slice(2) + structHash.slice(2)) as Hex)
    const enableSig = await root.signMessage({ message: { raw: digest } }) as Hex
  
    // signature layout for ENABLE:
    // [20 bytes hook] ++ abi.encode(bytes enableSig, bytes userOpSig, bytes validatorData, bytes hookData, bytes selectorData)
    const hook20 = ('0x' + HOOK_SENTINEL.slice(2)) as Hex
    const enablePacked = concat([
      hook20,
      encodeAbiParameters(
        parseAbiParameters('bytes enableSig, bytes userOpSig, bytes validatorData, bytes hookData, bytes selectorData'),
        [enableSig, userOpSigPermission, validatorData, hookData, selectorData]
      )
    ])
  
    const unpacked: UnpackedUserOperationV07 = {
      sender: KERNEL,
      nonce: toHex(nonceFull),
      callData: '0x',
      callGasLimit:         toHex(callGasLimit),
      verificationGasLimit: toHex(verificationGasLimit),
      preVerificationGas:   toHex(preVerificationGas),
      maxPriorityFeePerGas: toHex(MAX_PRIORITY_FEE),
      maxFeePerGas:         toHex(MAX_FEE_PER_GAS),
      signature: enablePacked,
    }
    return { unpacked }
  }
  
  export async function buildGrantAccessUO(vId: Hex, selector: Hex, isGrant: boolean) {
    // encode call to grantAccess(vId, selector, true)
    const grantCalldata = encodeFunctionData({
      abi: kernelAbiGrant, // ABI с grantAccess
      functionName: 'grantAccess',
      args: [vId, selector, isGrant],
    })
  
    // завернём в execute (self-call)
    const execData = encodeSingle(KERNEL, 0n, grantCalldata)
    const callData = buildExecuteCallData(EXEC_MODE_SIMPLE_SINGLE, execData, await rootHookRequiresPrefix())
  
    // --- gas config
    let verificationGasLimit = 300_000n
    let callGasLimit         = 200_000n
    let preVerificationGas   = 80_000n
    const accountGasLimits   = packAccountGasLimits(verificationGasLimit, callGasLimit)
    const gasFees            = packGasFees(MAX_PRIORITY_FEE, MAX_FEE_PER_GAS)
  
    // --- root lane nonce
    const key192   = '0x' + '00'.repeat(24) as Hex
    const nonce64  = await publicClient.readContract({
      address: ENTRY_POINT, abi: entryPointAbi, functionName: 'getNonce',
      args: [KERNEL, BigInt(key192)],
    }) as bigint
    const nonceFull = nonce64
  
    const packed: PackedUserOperation = {
      sender: KERNEL,
      nonce: nonceFull,
      initCode: '0x',
      callData,
      accountGasLimits,
      preVerificationGas,
      gasFees,
      paymasterAndData: '0x',
      signature: '0x',
    }
  
    // userOp hash
    const userOpHash = await publicClient.readContract({
      address: ENTRY_POINT, abi: entryPointAbi, functionName: 'getUserOpHash', args: [packed]
    }) as Hex
  
    const packed1 = {
      sender: KERNEL,
      nonce: nonceFull,
      initCode: '0x',
      callData,
      callGasLimit:         callGasLimit,
      verificationGasLimit: verificationGasLimit,
      preVerificationGas:   preVerificationGas,
      maxPriorityFeePerGas: MAX_PRIORITY_FEE,
      maxFeePerGas:         MAX_FEE_PER_GAS,
      paymasterAndData: '0x',
      signature: (await root.signMessage({ message: { raw: userOpHash } })) as Hex,
    }
  
    // финальная подпись root
    const unpacked: UnpackedUserOperationV07 = {
      sender: KERNEL,
      nonce: toHex(nonceFull),
      callData,
      callGasLimit:         toHex(callGasLimit),
      verificationGasLimit: toHex(verificationGasLimit),
      preVerificationGas:   toHex(preVerificationGas),
      maxPriorityFeePerGas: toHex(MAX_PRIORITY_FEE),
      maxFeePerGas:         toHex(MAX_FEE_PER_GAS),
      signature: (await root.signMessage({ message: { raw: userOpHash } })) as Hex,
    }
  
    return { packed1, unpacked, userOpHash }
  }
  
  
  // ===== STEP 3: обычный перевод через delegated (permission lane) =====
  export async function buildDelegatedSendUO(permissionId: Hex, target: Address, value: bigint, data: Hex) {
    const id20 = identifierWithoutTypeFromPermissionId(permissionId)
    console.log(' -> id20', id20)
  
    // nonce lane: DEFAULT (mode=0x00), PERMISSION (type=0x02)
    const key192  = encodeAsNonceKey(0x00, 0x02, id20, 0)
    const nonce64 = await publicClient.readContract({
      address: ENTRY_POINT, abi: entryPointAbi, functionName: 'getNonce',
      args: [KERNEL, key192],
    }) as bigint
    const nonceFull = encodeAsNonce(0x00, 0x02, id20, 0, nonce64)
    console.log(' -> NonceFull', nonceFull)
  
    // callData = Kernel.execute(...)
    const execCalldata = encodeSingle(target, value, data)
    const callData = buildExecuteCallData(EXEC_MODE_SIMPLE_SINGLE, execCalldata, await rootHookRequiresPrefix())
  
    let verificationGasLimit = 200_000n
    let callGasLimit         = 220_000n
    let preVerificationGas   = 80_000n
    const accountGasLimits   = packAccountGasLimits(verificationGasLimit, callGasLimit)
    const gasFees            = packGasFees(MAX_PRIORITY_FEE, MAX_FEE_PER_GAS)
  
    const packed: PackedUserOperation = {
      sender: KERNEL, nonce: nonceFull, initCode: '0x', callData,
      accountGasLimits, preVerificationGas, gasFees, paymasterAndData:'0x', signature:'0x'
    }
    const userOpHash = await publicClient.readContract({
      address: ENTRY_POINT, abi: entryPointAbi, functionName: 'getUserOpHash', args: [packed]
    }) as Hex
  
    // подпись делегированного ключа
    console.log("delegated:", DELEGATED_PK)
    console.log("delegated Address:", delegated.address)
    // const delSig = await delegated.signMessage({ message: { raw: userOpHash } }) as Hex
    const delSig = await delegated.sign({ hash: userOpHash }) as Hex
    // const delSig = "0xc619286501834f154c715e0a421fab1eb37683fcfc11551187915c37b16950746d0a015002ac1351e120753808eb36da13deeadff28d4e733375b4f0985eb0d41b" as Hex
  
    const signature = buildPermissionUserOpSig(delSig, 1)
  
    const unpacked: UnpackedUserOperationV07 = {
      sender: KERNEL,
      nonce: toHex(nonceFull),
      callData,
      callGasLimit:         toHex(callGasLimit),
      verificationGasLimit: toHex(verificationGasLimit),
      preVerificationGas:   toHex(preVerificationGas),
      maxPriorityFeePerGas: toHex(MAX_PRIORITY_FEE),
      maxFeePerGas:         toHex(MAX_FEE_PER_GAS),
      signature,
    }
    return { unpacked, userOpHash, delSig, signature }
  }
  
  // ===== UNINSTALL permission (root lane) =====
  export async function buildUninstallPermissionUO(delegatedEOA: Address) {
    // permissionId: bytes4 (просто стабильный детерминированный id)
    const permissionId = (keccak256(encodeAbiParameters(
      [{type:'address'},{type:'address'},{type:'address'}],
      [KERNEL, SUDO_POLICY, delegatedEOA]
    )) as Hex).slice(0,10) as Hex // 4 bytes
  
    const vId = vIdFromPermissionId(permissionId)
    const disableData = encodeAbiParameters(
      [ { type: "bytes[]" } ],
      [ ["0x", "0x"] ]   // первый для SUDO_POLICY, второй для ECDSA_SIGNER
    )
  
    const uninstallCalldata = encodeFunctionData({
      abi: kernelInstallValidationsAbi,
      functionName: 'uninstallValidation',
      args: [
        vId, 
        disableData,
        '0x',
      ],
    })
    const execData = encodeSingle(KERNEL, 0n, uninstallCalldata)
    const callData = buildExecuteCallData(EXEC_MODE_SIMPLE_SINGLE, execData, await rootHookRequiresPrefix())
  
    // соберём root-lane UO
    let verificationGasLimit = 350_000n
    let callGasLimit         = 600_000n
    let preVerificationGas   = 100_000n
    const accountGasLimits   = packAccountGasLimits(verificationGasLimit, callGasLimit)
    const gasFees            = packGasFees(MAX_PRIORITY_FEE, MAX_FEE_PER_GAS)
  
    // root lane key (mode=0x00,type=0x00)
    const nonceKey = (0n).toString() // key=0
    const key192   = '0x' + '00'.repeat(24) as Hex
    const nonce64  = await publicClient.readContract({
      address: ENTRY_POINT, abi: entryPointAbi, functionName: 'getNonce',
      args: [KERNEL, BigInt(key192)],
    }) as bigint
    const nonceFull = nonce64 // root используется стандартно как в твоём коде
  
    const packed: PackedUserOperation = {
      sender: KERNEL, nonce: nonceFull, initCode: '0x', callData,
      accountGasLimits, preVerificationGas, gasFees, paymasterAndData: '0x', signature: '0x'
    }
    const userOpHash = await publicClient.readContract({
      address: ENTRY_POINT, abi: entryPointAbi, functionName: 'getUserOpHash', args: [packed]
    }) as Hex
  
    const unpacked: UnpackedUserOperationV07 = {
      sender: KERNEL,
      nonce: toHex(nonceFull),
      callData,
      callGasLimit:         toHex(callGasLimit),
      verificationGasLimit: toHex(verificationGasLimit),
      preVerificationGas:   toHex(preVerificationGas),
      maxPriorityFeePerGas: toHex(MAX_PRIORITY_FEE),
      maxFeePerGas:         toHex(MAX_FEE_PER_GAS),
      signature: (await root.signMessage({ message: { raw: userOpHash } })) as Hex, // root ECDSA
    }
    return { unpacked, permissionId, vId }
  }
  
  
  
  export async function checkPrefund(
    userOp: PackedUserOperation | UnpackedUserOperationV07
  ) {
    // --- нормализация
    let sender: Address
    let preVerificationGas: bigint
    let callGasLimit: bigint
    let verificationGasLimit: bigint
    let maxFeePerGas: bigint
  
    if ("accountGasLimits" in userOp) {
      // Packed формат
      sender = userOp.sender
      preVerificationGas = userOp.preVerificationGas
  
      // accountGasLimits = packed(bytes32)
      const [vGas, cGas] = decodeAbiParameters(
        [{ type: "uint128" }, { type: "uint128" }],
        userOp.accountGasLimits
      )
      verificationGasLimit = vGas
      callGasLimit = cGas
  
      // gasFees = packed(bytes32)
      const [maxPriority, maxFee] = decodeAbiParameters(
        [{ type: "uint128" }, { type: "uint128" }],
        userOp.gasFees
      )
      maxFeePerGas = maxFee
    } else {
      // Unpacked формат
      sender = userOp.sender
      preVerificationGas = BigInt(userOp.preVerificationGas)
      callGasLimit = BigInt(userOp.callGasLimit)
      verificationGasLimit = BigInt(userOp.verificationGasLimit)
      maxFeePerGas = BigInt(userOp.maxFeePerGas)
    }
  
    const entryPointAbi = parseAbi([
      "function balanceOf(address account) view returns (uint256)"
    ]);
  
    // --- читаем депозит
    const deposit = await publicClient.readContract({
      address: ENTRY_POINT,
      abi: entryPointAbi,
      functionName: "balanceOf",
      args: [sender],
    }) as bigint
  
    // --- считаем prefund
    const requiredPrefund =
      (preVerificationGas + verificationGasLimit + callGasLimit) *
      maxFeePerGas
  
    console.log("🔍 Prefund check for UserOperation")
    console.log("Account:", sender)
    console.log("Deposit in EntryPoint:", deposit.toString(), "wei")
    console.log("Required prefund:", requiredPrefund.toString(), "wei")
  
    if (deposit >= requiredPrefund) {
      console.log("✅ Депозита достаточно, можно отправлять UserOp")
    } else {
      console.log("❌ Депозита недостаточно!")
      console.log(
        "Пополните ещё:",
        (requiredPrefund - deposit).toString(),
        "wei"
      )
    }
  }
  
  export async function getRootCurrentNonce() {
    const key192   = '0x' + '00'.repeat(24) as Hex
    const nonce64  = await publicClient.readContract({
      address: ENTRY_POINT, abi: entryPointAbi, functionName: 'getNonce',
      args: [KERNEL, BigInt(key192)],
    }) as bigint
    return nonce64
  }

  export function getPermissionId(delegatedEOA: Address) {
    const permissionId = (keccak256(encodeAbiParameters(
      [{type:'address'},{type:'address'}],
      [KERNEL, delegatedEOA]
    )) as Hex).slice(0,10) as Hex // 4 bytes
    return permissionId
  }

  export function getVId(permissionId: Hex) {
    const vId = vIdFromPermissionId(permissionId)
    return vId
  }


  export async function depositToEntryPoint() {
    const walletClient = createWalletClient({
      chain: sepolia,
      transport: http(ETH_RPC_URL),
      account: root, // Specify the account to fix the error
    });
  
    const { request } = await publicClient.simulateContract({
      address: ENTRY_POINT,
      abi: stakeAbi,
      functionName: 'depositTo',
      args: [KERNEL],
      account: root, // Specify the account for simulation as well
      value: DEPOSIT_AMOUNT, // Ensure value is set for payable function
    });
    const res = await walletClient.writeContract(request);
    console.log('Deposit to EntryPoint result:', res);
    console.log('Deposit to EntryPoint successful');
    return res
  }
  
  
  // ===== main =====
  async function main() {
    const kernelBalance = await publicClient.getBalance({ address: KERNEL })
    console.log(`Kernel balance: ${formatEther(kernelBalance)} ETH`)
    console.log("*".repeat(50))
    // console.log(root.address)
  
    // ============================ DEPOSIT ============================
    // const walletClient = createWalletClient({
    //   chain: sepolia,
    //   transport: http(ETH_RPC_URL),
    //   account: root, // Specify the account to fix the error
    // });
  
    // const { request } = await publicClient.simulateContract({
    //   address: ENTRY_POINT,
    //   abi: stakeAbi,
    //   functionName: 'depositTo',
    //   args: [KERNEL],
    //   account: root, // Specify the account for simulation as well
    //   value: DEPOSIT_AMOUNT, // Ensure value is set for payable function
    // });
    // await walletClient.writeContract(request);
    // ============================ ============================ ============================
  
    // ============================ SEND ROOT ============================
    // const { unpacked: unp2, userOpHash: uoh2 } = await buildSendRootUO(TARGET, TARGET_AMOUNT, TARGET_DATA, 1)
    // console.log('send to UOHASH:', uoh2);
    // await checkPrefund(unp2)
    // console.log('Send tx ->', await sendUserOpV07(unp2));
    // ============================ ============================ ============================
  
    // ============================ INSTALL PERMISSION ============================
    const permissionId = "0x937522e4"
    const vId = "0x02937522e400000000000000000000000000000000"
    // const { unpacked: installUO, permissionId, vId } = await buildInstallPermissionUO(delegated.address)
    // console.log('permissionId:', permissionId, 'vId:', vId)
    // await checkPrefund(installUO)
    // console.log('install UO ->', await sendUserOpV07(installUO));
    // ============================ ============================ ============================
  
    // ============================ UNINSTALL PERMISSION ============================
    // const { unpacked: installUO, permissionId, vId } = await buildUninstallPermissionUO(delegated.address)
    // console.log('permissionId:', permissionId, 'vId:', vId)
    // await checkPrefund(installUO)
    // console.log('uninstall UO ->', await sendUserOpV07(installUO));
    // ============================ ============================ ============================
  
    // ============================ ENABLE MODE ============================
    // const permissionId = "0x5db81b0a"
    // const vId = "0x025db81b0a00000000000000000000000000000000"
    // const permissionId = "0x49924027"
    // const vId = "0x024992402700000000000000000000000000000000"
    // const vId = "0x02000000000000000000000000000000005db81b0a"
    // const vId = "0x000000000000000000000000000000000000000000"
    // const { unpacked: enableUO } = await buildEnableSelectorUO(permissionId, vId, delegated.address, SEL_EXECUTE)
    // console.log('enable execute ->', await sendUserOpV07(enableUO))
    // ============================ ============================ ============================
  
    // ============================ GRANT ACCESS ============================
    // const { packed1, unpacked: grantedUO } = await buildGrantAccessUO(vId, SEL_EXECUTE, true)
    // console.log(packed1)
    // await checkPrefund(grantedUO)
    // console.log('grant execute ->', await sendUserOpV07(grantedUO))
    // ============================ ============================ ============================
  
  
    // ============================ SEND BY DELEGETED KEY ============================
    const { unpacked: sendUO, userOpHash, signature, delSig } = await buildDelegatedSendUO(permissionId, TARGET, TARGET_AMOUNT, TARGET_DATA)
    // await checkPrefund(sendUO)
    console.log(userOpHash)
    console.log("delSig:", delSig)
    console.log("signature:", signature)
    console.log('delegated send ->', await sendUserOpV07(sendUO))
    // ============================ ============================ ============================
  
    // ============================ IF SELECTOR ALLOWED ============================
    // const allowed = await publicClient.readContract({
    //   address: KERNEL, abi: kernelAbi, functionName: 'isAllowedSelector', args: [vId, SEL_EXECUTE]
    // })
    // console.log('isAllowedSelector(execute)=', allowed)
    // ============================ ============================ ============================
  
    // ============================ IF vID exists ============================
    // const [nonce, hook] = await publicClient.readContract({
    //   address: KERNEL,
    //   abi: parseAbi([
    //     'function validationConfig(bytes21 vId) view returns (uint32 nonce, address hook)'
    //   ]),
    //   functionName: 'validationConfig',
    //   args: [vId], 
    // })
    
    // console.log("Config for vId:", vId)
    // console.log("  nonce:", nonce)
    // console.log("  hook :", hook)
    // ============================ ============================ ============================
  }
  
  // main().catch((e) => { console.error(e); process.exit(1) })
  // console.log('0x' + '00'.repeat(24) as Hex)
  