import React, { useEffect, useState, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, TextInput, Alert, Modal } from 'react-native';
import { Stack, router } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { apiClient } from '@/utils/apiClient';
import { PrefundCheckResponse } from '@/types/types';
import { formatEther } from 'viem';
import { getEntryPointAddress, getKernelAddress } from '@/utils/config';

const FALLBACK_KERNEL = '0xB115dc375D7Ad88D7c7a2180D0E548Cb5B83D86A';
const FALLBACK_ENTRY_POINT = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';
const ENTRY_POINT_ADDRESS = getEntryPointAddress() || FALLBACK_ENTRY_POINT;

const formatEthValue = (value?: string) => {
  try {
    const formatted = formatEther(BigInt(value ?? '0'));
    const numeric = Number(formatted);
    if (Number.isNaN(numeric)) {
      return `${formatted} ETH`;
    }
    return `${numeric.toFixed(4)} ETH`;
  } catch {
    return '0.0000 ETH';
  }
};

export default function EntryPointScreen() {
  const [status, setStatus] = useState<PrefundCheckResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDepositing, setIsDepositing] = useState(false);
  const [depositAmount, setDepositAmount] = useState('0.01');
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [resultModal, setResultModal] = useState<{
    visible: boolean;
    success: boolean;
    title: string;
    message: string;
    txHash?: string;
    gasUsed?: string;
    revertReason?: string;
  }>({
    visible: false,
    success: true,
    title: '',
    message: '',
  });

  const loadStatus = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const result = await apiClient.checkPrefund();
      setStatus(result);
      setLastUpdated(Date.now());
    } catch (error) {
      console.error('[EntryPoint] Failed to load status:', error);
      Alert.alert('Error', 'Unable to load EntryPoint status. Please try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleHealthCheck = async () => {
    try {
      console.log('[EntryPoint] Testing server connectivity...');
      const response = await apiClient.healthCheck();
      console.log('[EntryPoint] Health check response:', response);
      Alert.alert('Server Status', `Server is running!\n\nStatus: ${response.status}\nTime: ${response.timestamp}`);
    } catch (error: any) {
      console.error('[EntryPoint] Health check failed:', error);
      Alert.alert('Server Error', `Cannot connect to server:\n\n${error?.message || 'Unknown error'}`);
    }
  };

  const closeResultModal = () => {
    setResultModal(prev => ({ ...prev, visible: false }));
  };
  
  const showResultModal = (params: {
    success: boolean;
    title: string;
    message: string;
    txHash?: string;
    gasUsed?: string;
    revertReason?: string;
  }) => {
    setResultModal({
      visible: true,
      ...params,
    });
  };
  
  const formatHash = (hash?: string) => hash ?? '';

  const handleDeposit = async () => {
    const numericAmount = parseFloat(depositAmount);
    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a positive amount of ETH to deposit.');
      return;
    }

    try {
      setIsDepositing(true);
      closeResultModal();
      console.log('[EntryPoint] Attempting deposit of', depositAmount, 'ETH');
      const response = await apiClient.depositToEntryPoint(depositAmount);
      console.log('[EntryPoint] Deposit response:', response);
      
      if (response.success) {
        showResultModal({
          success: true,
          title: 'Deposit Confirmed',
          message: response.message || 'Deposit transaction sent.',
          txHash: response.txHash,
          gasUsed: response.gasUsed,
        });
        await loadStatus();
      } else {
        showResultModal({
          success: false,
          title: 'Deposit Failed',
          message: response.message || response.error || 'Unable to deposit to EntryPoint.',
          txHash: response.txHash,
          gasUsed: response.gasUsed,
          revertReason: response.revertReason || response.error,
        });
      }
    } catch (error: any) {
      console.error('[EntryPoint] Deposit failed:', error);
      console.error('[EntryPoint] Error details:', error?.response?.data || error?.message);
      
      const backendData = error?.response?.data;
      const errorMessage = backendData?.message || 
                          backendData?.error || 
                          error?.message || 
                          'Unable to deposit to EntryPoint.';
      
      showResultModal({
        success: false,
        title: 'Deposit Failed',
        message: errorMessage,
        txHash: backendData?.txHash,
        gasUsed: backendData?.gasUsed,
        revertReason: backendData?.revertReason,
      });
    } finally {
      setIsDepositing(false);
    }
  };

  const configuredKernel = getKernelAddress() || FALLBACK_KERNEL;
  const kernelAddress = status?.kernelAddress ?? configuredKernel;
  const entryPointAddress = status?.entryPointAddress ?? ENTRY_POINT_ADDRESS;
  const shortfallExists = status?.shortfallWei && status.shortfallWei !== '0';

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <IconSymbol name="chevron.left" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.title}>EntryPoint</Text>
          <View style={styles.headerPlaceholder} />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Prefund Overview</Text>
          <TouchableOpacity style={styles.refreshButton} onPress={loadStatus} disabled={isRefreshing}>
            {isRefreshing ? (
              <ActivityIndicator size="small" color="#8B5CF6" />
            ) : (
              <IconSymbol name="arrow.clockwise" size={18} color="#8B5CF6" />
            )}
            <Text style={styles.refreshText}>{isRefreshing ? 'Refreshing' : 'Refresh'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#8B5CF6" />
              <Text style={styles.loadingText}>Loading EntryPoint status...</Text>
            </View>
          ) : (
            <>
              <View style={styles.statusRow}>
                <View style={[styles.statusBadge, status?.hasPrefund ? styles.statusOk : styles.statusWarn]}>
                  <IconSymbol
                    name={status?.hasPrefund ? 'checkmark.circle.fill' : 'exclamationmark.triangle.fill'}
                    size={16}
                    color={status?.hasPrefund ? '#10B981' : '#F59E0B'}
                  />
                  <Text style={styles.statusText}>
                    {status?.hasPrefund ? 'Sufficient prefund' : 'Prefund required'}
                  </Text>
                </View>
                {lastUpdated && (
                  <Text style={styles.updatedText}>
                    Updated {new Date(lastUpdated).toLocaleTimeString()}
                  </Text>
                )}
              </View>

              <View style={styles.metricRow}>
                <View style={styles.metricBox}>
                  <Text style={styles.metricLabel}>Current Balance</Text>
                  <Text style={styles.metricValue}>{formatEthValue(status?.depositWei)}</Text>
                </View>
                <View style={styles.metricBox}>
                  <Text style={styles.metricLabel}>Required Prefund</Text>
                  <Text style={styles.metricValue}>{formatEthValue(status?.requiredPrefundWei)}</Text>
                </View>
              </View>

              {shortfallExists && (
                <View style={styles.shortfallBox}>
                  <IconSymbol name="exclamationmark.circle.fill" size={18} color="#F59E0B" />
                  <View style={styles.shortfallTextContainer}>
                    <Text style={styles.shortfallTitle}>Shortfall Detected</Text>
                    <Text style={styles.shortfallText}>
                      {formatEthValue(status?.shortfallWei)} additional ETH is required to process queued user operations.
                    </Text>
                  </View>
                </View>
              )}

              <Text style={styles.statusMessage}>{status?.message}</Text>
            </>
          )}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Addresses</Text>
        </View>
        <View style={styles.card}>
          <View style={styles.addressRow}>
            <Text style={styles.addressLabel}>Kernel Account</Text>
            <Text style={styles.addressValue}>{kernelAddress}</Text>
          </View>
          <View style={styles.addressRow}>
            <Text style={styles.addressLabel}>EntryPoint (v0.7)</Text>
            <Text style={styles.addressValue}>{entryPointAddress}</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Deposit ETH</Text>
          <Text style={styles.sectionSubtitle}>Add prefund to cover delegated key installations and transactions.</Text>
        </View>
        <View style={styles.card}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Amount (ETH)</Text>
            <TextInput
              style={styles.input}
              value={depositAmount}
              onChangeText={setDepositAmount}
              keyboardType="decimal-pad"
              placeholder="0.01"
              placeholderTextColor="#555555"
            />
          </View>
          <TouchableOpacity
            style={[styles.depositButton, isDepositing && styles.depositButtonDisabled]}
            onPress={handleDeposit}
            disabled={isDepositing}
          >
            {isDepositing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <IconSymbol name="arrow.down.circle.fill" size={18} color="#FFFFFF" />
            )}
            <Text style={styles.depositButtonText}>
              {isDepositing ? 'Submitting...' : 'Deposit to EntryPoint'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.healthCheckButton}
            onPress={handleHealthCheck}
          >
            <IconSymbol name="heart.fill" size={16} color="#8B5CF6" />
            <Text style={styles.healthCheckButtonText}>Test Server</Text>
          </TouchableOpacity>
          <Text style={styles.depositHint}>
            Deposits are sent from your root smart wallet account to the global EntryPoint contract and will be used to pay for future user operations.
          </Text>
        </View>
      </ScrollView>
      <Modal
        transparent
        visible={resultModal.visible}
        animationType="fade"
        onRequestClose={closeResultModal}
      >
        <View style={styles.resultModalOverlay}>
          <View style={[
            styles.resultModalCard,
            resultModal.success ? styles.resultModalSuccess : styles.resultModalError
          ]}>
            <IconSymbol
              name={resultModal.success ? 'checkmark.circle.fill' : 'xmark.octagon.fill'}
              size={32}
              color={resultModal.success ? '#10B981' : '#F87171'}
            />
            <Text style={styles.resultModalTitle}>{resultModal.title}</Text>
            <Text style={styles.resultModalMessage}>{resultModal.message}</Text>
            
            {resultModal.txHash && (
              <View style={styles.resultModalDetail}>
                <Text style={styles.resultModalDetailLabel}>Transaction</Text>
                <Text style={styles.resultModalDetailValue}>{formatHash(resultModal.txHash)}</Text>
              </View>
            )}
            
            {resultModal.gasUsed && (
              <View style={styles.resultModalDetail}>
                <Text style={styles.resultModalDetailLabel}>Gas Used</Text>
                <Text style={styles.resultModalDetailValue}>{resultModal.gasUsed}</Text>
              </View>
            )}
            
            {!resultModal.success && resultModal.revertReason && (
              <Text style={styles.resultModalErrorReason} numberOfLines={3}>
                {resultModal.revertReason}
              </Text>
            )}
            
            <TouchableOpacity style={styles.resultModalButton} onPress={closeResultModal}>
              <Text style={styles.resultModalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 24,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A1A',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerPlaceholder: {
    width: 44,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  sectionSubtitle: {
    flex: 1,
    marginTop: 4,
    fontSize: 14,
    color: '#A0A0A0',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#1F1F1F',
  },
  refreshText: {
    color: '#8B5CF6',
    fontWeight: '600',
    fontSize: 14,
  },
  card: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#262626',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    color: '#A0A0A0',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusOk: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  statusWarn: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  statusText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  updatedText: {
    color: '#A0A0A0',
    fontSize: 12,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  metricBox: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  metricLabel: {
    color: '#A0A0A0',
    fontSize: 13,
    marginBottom: 4,
  },
  metricValue: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  shortfallBox: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    marginBottom: 12,
  },
  shortfallTextContainer: {
    flex: 1,
  },
  shortfallTitle: {
    color: '#FBBF24',
    fontWeight: '600',
    marginBottom: 2,
  },
  shortfallText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  statusMessage: {
    color: '#A0A0A0',
    fontSize: 14,
    lineHeight: 20,
  },
  addressRow: {
    marginBottom: 16,
  },
  addressLabel: {
    color: '#A0A0A0',
    fontSize: 13,
    marginBottom: 4,
  },
  addressValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Menlo',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    color: '#A0A0A0',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#111111',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2F2F2F',
  },
  depositButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#8B5CF6',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  depositButtonDisabled: {
    opacity: 0.6,
  },
  depositButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  healthCheckButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1A1A1A',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#8B5CF6',
    marginBottom: 12,
  },
  healthCheckButtonText: {
    color: '#8B5CF6',
    fontWeight: '500',
    fontSize: 14,
  },
  depositHint: {
    color: '#A0A0A0',
    fontSize: 13,
    lineHeight: 18,
  },
  resultModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  resultModalCard: {
    width: '100%',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  resultModalSuccess: {
    backgroundColor: '#12211b',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  resultModalError: {
    backgroundColor: '#261519',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.3)',
  },
  resultModalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  resultModalMessage: {
    color: '#E5E5E5',
    fontSize: 15,
    textAlign: 'center',
  },
  resultModalDetail: {
    width: '100%',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  resultModalDetailLabel: {
    color: '#A0A0A0',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  resultModalDetailValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'Menlo',
    marginTop: 4,
  },
  resultModalErrorReason: {
    color: '#FCA5A5',
    fontSize: 13,
    textAlign: 'center',
  },
  resultModalButton: {
    marginTop: 8,
    backgroundColor: '#8B5CF6',
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  resultModalButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
});
