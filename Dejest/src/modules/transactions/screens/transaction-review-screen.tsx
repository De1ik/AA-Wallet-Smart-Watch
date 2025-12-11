import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { formatUnits, decodeFunctionData, getFunctionSelector, parseAbi } from 'viem';
import type { Address, Hex } from 'viem';

import { IconSymbol } from '@/shared/ui/icon-symbol';
import { styles as delegatedStyles } from '@/modules/delegated-keys/screens/smart-watch-connection/create-delegated-key/styles';
import {
  transactionReviewState,
  InstallReviewPayload,
  RevocationReviewPayload,
  TransactionReviewContext,
  AccountTransactionReviewPayload,
} from '@/services/storage/transactionReviewState';
import { useNotifications } from '@/shared/contexts/NotificationContext';
import { PermissionPolicyType, PrepareDataForSigning, SignedDataForDelegateInstallation } from '@/domain/types';
import { processUnsigned } from '@/services/blockchain/signUOp';
import { apiClient } from '@/services/api/apiClient';
import { ErrorResponse, InstallExecuteInput } from '@/services/api/apiTypes';
import { removeDelegatedKey, removeDelegatedKeyByAddress, updateDelegatedKey } from '@/modules/delegated-keys/services/delegatedKeys';
import { installationState } from '@/services/storage/installationState';
import { wsClient } from '@/services/api/websocketClient';
import { COLORS } from '@/shared/constants/colors';
import { useWallet } from '@/modules/account/state/WalletContext';

const estimateWeiFromPrepareData = (data?: PrepareDataForSigning) => {
  if (!data) return undefined;
  if (data.estimatedFeeWei) {
    try {
      return BigInt(data.estimatedFeeWei);
    } catch {
      // ignored
    }
  }
  try {
    const callGas = BigInt(data.unpacked.callGasLimit);
    const verificationGas = BigInt(data.unpacked.verificationGasLimit);
    const preVerificationGas = BigInt(data.unpacked.preVerificationGas);
    const maxFeePerGas = BigInt(data.unpacked.maxFeePerGas);
    return (callGas + verificationGas + preVerificationGas) * maxFeePerGas;
  } catch {
    return undefined;
  }
};

const useReviewContext = () => {
  const [context, setContext] = useState<TransactionReviewContext | null>(transactionReviewState.get());

  useEffect(() => {
    setContext(transactionReviewState.get());
  }, []);

  return context;
};

const formatWeiToEth = (value?: bigint) => {
  if (value === undefined) return null;
  try {
    return formatUnits(value, 18);
  } catch {
    return null;
  }
};

const kernelExecuteAbi = parseAbi(['function execute(bytes32 mode, bytes execCalldata) payable']);
const erc20TransferAbi = parseAbi(['function transfer(address to, uint256 amount) returns (bool)']);
const EXECUTE_USER_OP_SELECTOR = getFunctionSelector(
  'function executeUserOp((address,uint256,bytes,bytes,bytes32,uint256,bytes32,bytes,bytes) userOp, bytes32 userOpHash)'
);

type DecodedExecData = {
  target: Address;
  value: bigint;
  innerData: Hex;
};

const stripExecuteUserOpPrefix = (data: Hex): Hex => {
  const normalizedData = data.toLowerCase();
  const prefix = EXECUTE_USER_OP_SELECTOR.toLowerCase();
  if (normalizedData.startsWith(prefix)) {
    return (`0x${data.slice(EXECUTE_USER_OP_SELECTOR.length)}`) as Hex;
  }
  return data;
};

const decodeExecDataFromCallData = (callData: Hex): DecodedExecData => {
  const payload = stripExecuteUserOpPrefix(callData);
  const { functionName, args } = decodeFunctionData({
    abi: kernelExecuteAbi,
    data: payload,
  });
  if (functionName !== 'execute') {
    throw new Error('Unexpected kernel call in user operation');
  }
  const execCalldata = args?.[1] as Hex;
  if (!execCalldata) {
    throw new Error('Missing exec calldata');
  }
  const raw = execCalldata.slice(2);
  if (raw.length < 40 + 64) {
    throw new Error('Malformed exec calldata');
  }
  const target = (`0x${raw.slice(0, 40)}`) as Address;
  const value = BigInt(`0x${raw.slice(40, 40 + 64)}` || '0x0');
  const innerHex = raw.slice(40 + 64);
  const innerData = (`0x${innerHex}`) as Hex;
  return { target, value, innerData };
};

const ensureAccountTransactionMatchesRequest = (payload: AccountTransactionReviewPayload) => {
  const callData = payload.unsignedUserOp?.unpacked?.callData as Hex | undefined;
  if (!callData) {
    throw new Error('Missing callData in unsigned user operation');
  }
  const { target, value, innerData } = decodeExecDataFromCallData(callData);
  const expectedAmount = BigInt(payload.amountWei);
  const expectedRecipient = payload.recipient.toLowerCase();

  if (payload.tokenAddress) {
    if (target.toLowerCase() !== payload.tokenAddress.toLowerCase()) {
      throw new Error('Prepared transaction token does not match request');
    }
    const decoded = decodeFunctionData({
      abi: erc20TransferAbi,
      data: innerData,
    });
    if (decoded.functionName !== 'transfer') {
      throw new Error('Prepared transaction is not an ERC20 transfer');
    }
    const [to, amount] = decoded.args as [Address, bigint];
    if (to.toLowerCase() !== expectedRecipient) {
      throw new Error('Prepared transaction recipient mismatch');
    }
    if (amount !== expectedAmount) {
      throw new Error('Prepared transaction amount mismatch');
    }
    if (value !== 0n) {
      throw new Error('ERC20 transfer should not include native value');
    }
  } else {
    if (target.toLowerCase() !== expectedRecipient) {
      throw new Error('Prepared native transfer recipient mismatch');
    }
    if (value !== expectedAmount) {
      throw new Error('Prepared native transfer amount mismatch');
    }
    if (innerData !== '0x') {
      throw new Error('Native transfer should not include calldata');
    }
  }
};

export default function TransactionReviewScreen() {
  const context = useReviewContext();
  const { showError, showInfo, showSuccess } = useNotifications();
  const { refreshCryptoData } = useWallet();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!context) {
      transactionReviewState.clear();
      showError('No transaction data to review. Please start the process again.', { title: 'Missing data' });
      router.back();
    }
  }, [context, showError]);

  const operations = useMemo(() => {
    if (!context) return [];
    if (context.kind === 'delegated-installation') {
      const payload = context.payload;
      const base = [
        {
          label: 'Install permission validation',
          userOpHash: payload.unsignedPermissionPolicyData.userOpHash,
          estimatedWei: estimateWeiFromPrepareData(payload.unsignedPermissionPolicyData),
        },
        {
          label: 'Grant delegated execution',
          userOpHash: payload.unsignedGrantAccessData.userOpHash,
          estimatedWei: estimateWeiFromPrepareData(payload.unsignedGrantAccessData),
        },
      ];
      if (payload.unsignedRecipientListData) {
        base.push({
          label: 'Apply recipient restrictions',
          userOpHash: payload.unsignedRecipientListData.userOpHash,
          estimatedWei: estimateWeiFromPrepareData(payload.unsignedRecipientListData),
        });
      }
      if (payload.unsignedTokenListData) {
        base.push({
          label: 'Set token limits',
          userOpHash: payload.unsignedTokenListData.userOpHash,
          estimatedWei: estimateWeiFromPrepareData(payload.unsignedTokenListData),
        });
      }
      return base;
    }

    if (context.kind === 'delegated-revocation') {
      const payload = context.payload;
      const estimatedWei = payload.gasEstimateWei
        ? (() => {
            try {
              return BigInt(payload.gasEstimateWei);
            } catch {
              return undefined;
            }
          })()
        : undefined;

      return [
        {
          label: 'Revoke delegated key',
          userOpHash: payload.unsignedRevokeData.userOpHash,
          estimatedWei,
        },
      ];
    }

    const payload = context.payload;
    return [
      {
        label: 'Send transaction',
        userOpHash: payload.unsignedUserOp.userOpHash,
        estimatedWei: estimateWeiFromPrepareData(payload.unsignedUserOp),
      },
    ];
  }, [context]);

  const totalEstimated = useMemo(() => {
    const sum = operations.reduce<bigint | undefined>((acc, op) => {
      if (op.estimatedWei === undefined) return acc;
      return (acc ?? 0n) + op.estimatedWei;
    }, undefined);
    return formatWeiToEth(sum);
  }, [operations]);

  const isInstallation = context?.kind === 'delegated-installation';
  const isRevocation = context?.kind === 'delegated-revocation';
  const confirmLabel = isInstallation ? 'Sign & Install' : isRevocation ? 'Sign & Revoke' : 'Sign & Send';
  const warningText = (() => {
    if (isInstallation) {
      return 'You will sign and broadcast all listed operations. Review every detail carefully to ensure the server-provided hashes match your expected configuration.';
    }
    if (isRevocation) {
      return 'You will sign and broadcast this transaction. Make sure the server-provided hash matches your expectation before continuing.';
    }
    return 'You are about to sign and broadcast this transfer. Double-check the destination, amount, and hash before approving.';
  })();

  const markInstallationFailed = async (deviceId: string, errorMessage: string) => {
    try {
      await updateDelegatedKey(deviceId, {
        installationStatus: 'failed',
        installationProgress: {
          currentStep: 'Installation failed',
          totalSteps: 3,
          completedSteps: 0,
          transactionStatus: errorMessage,
        },
      });
    } catch (err) {
      console.error('Failed to update delegated key after review error:', err);
    }
    installationState.stopInstallation();
    wsClient.resetConnection();
  };

  const executePreparedInstallation = async (payload: InstallReviewPayload) => {
    const {
      permissionPolicyType,
      unsignedPermissionPolicyData,
      unsignedGrantAccessData,
      unsignedRecipientListData,
      unsignedTokenListData,
      installationId,
      clientId,
      kernelAddress,
    } = payload;

    const signedPermissionPolicyData = (await processUnsigned(
      unsignedPermissionPolicyData,
      'unsignedPermissionPolicyData'
    )) as SignedDataForDelegateInstallation;
    if (!signedPermissionPolicyData) {
      throw new Error('Failed to sign permission policy data');
    }

    const signedGrantAccessData = (await processUnsigned(
      unsignedGrantAccessData,
      'unsignedGrantAccessData'
    )) as SignedDataForDelegateInstallation;
    if (!signedGrantAccessData) {
      throw new Error('Failed to sign grant access data');
    }

    let signedRecipientListData: SignedDataForDelegateInstallation | undefined;
    let signedTokenListData: SignedDataForDelegateInstallation | undefined;

    if (permissionPolicyType === PermissionPolicyType.CALL_POLICY) {
      if (unsignedRecipientListData) {
        signedRecipientListData = (await processUnsigned(
          unsignedRecipientListData,
          'unsignedRecipientListData'
        )) as SignedDataForDelegateInstallation;
        if (!signedRecipientListData) {
          throw new Error('Failed to sign recipient restriction data');
        }
      }

      if (unsignedTokenListData) {
        signedTokenListData = (await processUnsigned(
          unsignedTokenListData,
          'unsignedTokenListData'
        )) as SignedDataForDelegateInstallation;
        if (!signedTokenListData) {
          throw new Error('Failed to sign token limit data');
        }
      }
    }

    const executeDelegateInstallation: InstallExecuteInput['data'] = {
      permissionPolicyType,
      signedPermissionPolicyData,
      signedGrantAccessData,
      signedRecipientListData,
      signedTokenListData,
    };

    const installPrepareInput: InstallExecuteInput = {
      data: executeDelegateInstallation,
      clientId,
      kernelAddress,
      installationId,
    };

    const resultInstallation = await apiClient.executeDelegatedKeyInstall(installPrepareInput);
    if (!resultInstallation.success) {
      throw new Error((resultInstallation as ErrorResponse)?.error || 'Failed to execute installation');
    }
  };

  const executeRevocation = async (payload: RevocationReviewPayload) => {
    const signedRevokeData = (await processUnsigned(
      payload.unsignedRevokeData,
      'unsignedRevokeData'
    )) as SignedDataForDelegateInstallation;

    if (!signedRevokeData) {
      throw new Error('Failed to sign revocation transaction');
    }

    const executeResult = await apiClient.executeRevokeKey({
      revocationId: payload.revocationId,
      delegatedEOA: payload.delegatedAddress,
      kernelAddress: payload.kernelAddress,
      data: { signedRevokeData },
    });

    if (!('txHash' in executeResult) || !executeResult.success) {
      throw new Error((executeResult as ErrorResponse)?.error || 'Failed to execute revocation');
    }

    if (payload.deviceId) {
      await removeDelegatedKey(payload.deviceId);
    } else {
      await removeDelegatedKeyByAddress(payload.delegatedAddress);
    }

    return executeResult.txHash;
  };

  const executeAccountTransaction = async (payload: AccountTransactionReviewPayload) => {
    ensureAccountTransactionMatchesRequest(payload);
    const signedTransfer = (await processUnsigned(
      payload.unsignedUserOp,
      'unsignedTransferData'
    )) as SignedDataForDelegateInstallation;

    if (!signedTransfer) {
      throw new Error('Failed to sign transaction');
    }

    const result = await apiClient.broadcastUserOperation(signedTransfer);
    return result.txHash;
  };

  const handleConfirm = async () => {
    if (!context) return;
    setIsSubmitting(true);

    if (context.kind === 'delegated-installation') {
      const installPayload = context.payload;
      transactionReviewState.clear();
      router.dismiss(2)
      router.push({
        pathname: '/settings/smart-watch-connection/installation-progress-screen/installation-progress',
        params: {
          deviceId: installPayload.deviceId,
          deviceName: installPayload.deviceName,
          keyType: installPayload.permissionPolicyType,
          origin: 'install',
        },
      });

      try {
        await executePreparedInstallation(installPayload);
        showInfo('Delegated key installation transactions submitted. Keep the progress screen open.', {
          title: 'Transactions submitted',
        });
      } catch (error: any) {
        console.error('Error executing installation:', error);
        const message = error?.message || 'Failed to submit installation transactions';
        await markInstallationFailed(installPayload.deviceId, message);
        showError(message, { title: 'Installation failed' });
      } finally {
        setIsSubmitting(false);
      }
    } else if (context.kind === 'delegated-revocation') {
      try {
        const txHash = await executeRevocation(context.payload);
        transactionReviewState.clear();
        const shortHash = `${txHash.slice(0, 10)}...${txHash.slice(-6)}`;
        showSuccess(`Delegated key revoked\nTx: ${shortHash}`, { title: 'Revocation submitted' });
        router.back();
      } catch (error: any) {
        console.error('Error executing revocation:', error);
        showError(error?.message || 'Failed to revoke delegated key', { title: 'Revocation failed' });
      } finally {
        setIsSubmitting(false);
      }
    } else {
      try {
        const txHash = await executeAccountTransaction(context.payload);
        transactionReviewState.clear();
        const shortHash = `${txHash.slice(0, 8)}...${txHash.slice(-6)}`;
        showSuccess(`Transfer submitted\nTx: ${shortHash}`, { title: 'Transaction sent' });
        await refreshCryptoData();
        router.back();
      } catch (error: any) {
        console.error('Error executing transfer:', error);
        showError(error?.message || 'Failed to send transaction', { title: 'Transaction failed' });
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleCancel = async () => {
    if (!context) return;
    if (context.kind === 'delegated-installation') {
      await markInstallationFailed(context.payload.deviceId, 'Installation cancelled by user before signing');
      transactionReviewState.clear();
      showInfo('Installation cancelled', { title: 'Cancelled' });
    } else if (context.kind === 'delegated-revocation') {
      transactionReviewState.clear();
      showInfo('Revocation cancelled', { title: 'Cancelled' });
    } else {
      transactionReviewState.clear();
      showInfo('Transfer cancelled', { title: 'Cancelled' });
    }
    router.back();
  };

  if (!context) {
    return null;
  }

  const renderDeviceCard = () => {
    if (context.kind === 'delegated-installation') {
      const payload = context.payload;
      return (
        <View style={reviewScreenStyles.card}>
          <Text style={reviewScreenStyles.cardHeading}>Device</Text>
          <View style={reviewScreenStyles.cardRow}>
            <Text style={reviewScreenStyles.cardLabel}>Name</Text>
            <Text style={reviewScreenStyles.cardValue}>{payload.deviceName}</Text>
          </View>
          <View style={reviewScreenStyles.cardRow}>
            <Text style={reviewScreenStyles.cardLabel}>Delegated Address</Text>
            <Text style={reviewScreenStyles.cardValueMono}>{payload.delegatedAddress}</Text>
          </View>
          <View style={reviewScreenStyles.cardRow}>
            <Text style={reviewScreenStyles.cardLabel}>Kernel</Text>
            <Text style={reviewScreenStyles.cardValueMono}>{payload.kernelAddress}</Text>
          </View>
          <View style={reviewScreenStyles.cardRow}>
            <Text style={reviewScreenStyles.cardLabel}>Access Type</Text>
            <Text style={reviewScreenStyles.cardValue}>
              {payload.permissionPolicyType === PermissionPolicyType.SUDO ? 'Sudo Access' : 'Restricted Access'}
            </Text>
          </View>
        </View>
      );
    }

    if (context.kind === 'delegated-revocation') {
      const payload = context.payload;
      return (
        <View style={reviewScreenStyles.card}>
          <Text style={reviewScreenStyles.cardHeading}>Revocation Details</Text>
          <View style={reviewScreenStyles.cardRow}>
            <Text style={reviewScreenStyles.cardLabel}>Device</Text>
            <Text style={reviewScreenStyles.cardValue}>{payload.deviceName || 'Unknown device'}</Text>
          </View>
          <View style={reviewScreenStyles.cardRow}>
            <Text style={reviewScreenStyles.cardLabel}>Delegated Address</Text>
            <Text style={reviewScreenStyles.cardValueMono}>{payload.delegatedAddress}</Text>
          </View>
          <View style={reviewScreenStyles.cardRow}>
            <Text style={reviewScreenStyles.cardLabel}>Kernel</Text>
            <Text style={reviewScreenStyles.cardValueMono}>{payload.kernelAddress}</Text>
          </View>
          <View style={reviewScreenStyles.cardRow}>
            <Text style={reviewScreenStyles.cardLabel}>Revocation ID</Text>
            <Text style={reviewScreenStyles.cardValueMono}>{payload.revocationId}</Text>
          </View>
        </View>
      );
    }

    const payload = context.payload;
    const formattedAmount = (() => {
      try {
        return formatUnits(BigInt(payload.amountWei), payload.decimals);
      } catch {
        return payload.amountInput;
      }
    })();

    return (
      <View style={reviewScreenStyles.card}>
        <Text style={reviewScreenStyles.cardHeading}>Transfer details</Text>
        <View style={reviewScreenStyles.cardRow}>
          <Text style={reviewScreenStyles.cardLabel}>Token</Text>
          <Text style={reviewScreenStyles.cardValue}>{payload.tokenSymbol}</Text>
        </View>
        <View style={reviewScreenStyles.cardRow}>
          <Text style={reviewScreenStyles.cardLabel}>Amount</Text>
          <Text style={reviewScreenStyles.cardValue}>{formattedAmount}</Text>
        </View>
        <View style={reviewScreenStyles.cardRow}>
          <Text style={reviewScreenStyles.cardLabel}>From (kernel)</Text>
          <Text style={reviewScreenStyles.cardValueMono}>{payload.kernelAddress}</Text>
        </View>
        <View style={reviewScreenStyles.cardRow}>
          <Text style={reviewScreenStyles.cardLabel}>To</Text>
          <Text style={reviewScreenStyles.cardValueMono}>{payload.recipient}</Text>
        </View>
      </View>
    );
  };

  const renderCallPolicySummary = () => {
    if (context.kind !== 'delegated-installation') return null;
    const payload = context.payload;
    if (payload.permissionPolicyType !== PermissionPolicyType.CALL_POLICY) return null;

    const { allowedTokens, allowedTargets, allowedActions, maxValuePerTx, maxValuePerDay } =
      payload.callPolicySettingsSnapshot;

    return (
      <View style={reviewScreenStyles.card}>
        <Text style={reviewScreenStyles.cardHeading}>Call policy summary</Text>
        <View style={reviewScreenStyles.cardRow}>
          <Text style={reviewScreenStyles.cardLabel}>Max per transaction</Text>
          <Text style={reviewScreenStyles.cardValue}>{maxValuePerTx || '0'} ETH</Text>
        </View>
        <View style={reviewScreenStyles.cardRow}>
          <Text style={reviewScreenStyles.cardLabel}>Max per day</Text>
          <Text style={reviewScreenStyles.cardValue}>{maxValuePerDay || '0'} ETH</Text>
        </View>
        <View style={reviewScreenStyles.cardRow}>
          <Text style={reviewScreenStyles.cardLabel}>Allowed actions</Text>
          <Text style={reviewScreenStyles.cardValue}>
            {allowedActions.length ? allowedActions.join(', ') : 'None'}
          </Text>
        </View>

        <View style={reviewScreenStyles.divider} />

        <Text style={reviewScreenStyles.subHeading}>Allowed recipients ({allowedTargets.length})</Text>
        {allowedTargets.length ? (
          allowedTargets.map((target) => (
            <Text key={target.address} style={reviewScreenStyles.listValue}>
              {target.name ? `${target.name}: ` : ''}
              {target.address}
            </Text>
          ))
        ) : (
          <Text style={reviewScreenStyles.listPlaceholder}>No address restrictions</Text>
        )}

        <View style={reviewScreenStyles.divider} />

        <Text style={reviewScreenStyles.subHeading}>Token limits ({allowedTokens.length})</Text>
        {allowedTokens.length ? (
          allowedTokens.map((token) => (
            <View key={token.address} style={reviewScreenStyles.tokenRow}>
              <Text style={reviewScreenStyles.tokenTitle}>{token.symbol || token.name}</Text>
              <Text style={reviewScreenStyles.tokenDetail}>Per tx: {token.maxValuePerTx}</Text>
              <Text style={reviewScreenStyles.tokenDetail}>Per day: {token.maxValuePerDay}</Text>
            </View>
          ))
        ) : (
          <Text style={reviewScreenStyles.listPlaceholder}>No ERC-20 restrictions</Text>
        )}
      </View>
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={reviewScreenStyles.container} edges={['top', 'left', 'right']}>
        <View style={reviewScreenStyles.header}>
          <TouchableOpacity style={reviewScreenStyles.backButton} onPress={handleCancel} disabled={isSubmitting}>
            <IconSymbol name="chevron.left" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={reviewScreenStyles.title}>
            {isInstallation ? 'Review Installation' : isRevocation ? 'Review Transaction' : 'Review Transfer'}
          </Text>
          <View style={reviewScreenStyles.placeholder} />
        </View>

        <ScrollView style={reviewScreenStyles.scroll} contentContainerStyle={reviewScreenStyles.scrollContent}>
          {renderDeviceCard()}

          <View style={reviewScreenStyles.card}>
            <Text style={reviewScreenStyles.cardHeading}>User operations</Text>
            {operations.map((op) => {
              const estimate = formatWeiToEth(op.estimatedWei);
              return (
                <View key={op.label} style={delegatedStyles.reviewOperationRow}>
                  <View style={delegatedStyles.reviewOperationInfo}>
                    <Text style={delegatedStyles.reviewOperationLabel}>{op.label}</Text>
                    <Text style={delegatedStyles.reviewValueMonospace}>{op.userOpHash}</Text>
                  </View>
                  <Text style={delegatedStyles.reviewOperationEstimate}>{estimate ? `${estimate} ETH` : '—'}</Text>
                </View>
              );
            })}
            {totalEstimated ? (
              <View style={delegatedStyles.reviewTotalRow}>
                <Text style={delegatedStyles.reviewTotalLabel}>Estimated total fee</Text>
                <Text style={delegatedStyles.reviewTotalValue}>{totalEstimated} ETH</Text>
              </View>
            ) : null}
          </View>

          {renderCallPolicySummary()}

          <View style={reviewScreenStyles.card}>
            <View style={delegatedStyles.reviewWarning}>
              <IconSymbol name="exclamationmark.triangle.fill" size={18} color="#F59E0B" />
              <Text style={delegatedStyles.reviewWarningText}>{warningText}</Text>
            </View>
          </View>
        </ScrollView>

        <View style={reviewScreenStyles.actions}>
          <TouchableOpacity style={reviewScreenStyles.cancelButton} onPress={handleCancel} disabled={isSubmitting}>
            <Text style={reviewScreenStyles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[reviewScreenStyles.confirmButton, isSubmitting && reviewScreenStyles.confirmButtonDisabled]}
            onPress={handleConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? <ActivityIndicator size="small" color="#111" /> : <Text style={reviewScreenStyles.confirmText}>{confirmLabel}</Text>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </>
  );
}

const reviewScreenStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F1F',
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#1A1A1A',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  placeholder: {
    width: 40,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
    gap: 16,
  },
  card: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#262626',
    padding: 16,
    gap: 12,
  },
  cardHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardLabel: {
    color: '#9CA3AF',
    fontSize: 13,
    flex: 1,
  },
  cardValue: {
    color: '#FFFFFF',
    fontSize: 13,
    flex: 1,
    textAlign: 'right',
  },
  cardValueMono: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Menlo',
    flex: 1,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: '#262626',
    marginVertical: 8,
  },
  subHeading: {
    color: COLORS.purpleLight,
    fontSize: 13,
    fontWeight: '600',
  },
  listValue: {
    color: '#FFFFFF',
    fontSize: 12,
    marginTop: 4,
  },
  listPlaceholder: {
    color: '#6B7280',
    fontSize: 12,
    marginTop: 4,
  },
  tokenRow: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#2E2E2E',
  },
  tokenTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  tokenDetail: {
    color: '#D1D5DB',
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#1F1F1F',
    backgroundColor: '#0F0F0F',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333333',
    alignItems: 'center',
  },
  cancelText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.purpleLight,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    opacity: 0.7,
  },
  confirmText: {
    color: '#0B0B0B',
    fontSize: 15,
    fontWeight: '700',
  },
});
