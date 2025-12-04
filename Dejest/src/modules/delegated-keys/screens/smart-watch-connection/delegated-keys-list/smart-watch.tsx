import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, TextInput, ActivityIndicator, Clipboard, Modal, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack, useFocusEffect } from 'expo-router';
import { IconSymbol } from '@/shared/ui/icon-symbol';
import { getDelegatedKeys, removeDelegatedKey, DelegatedKeyData, removeStuckInstallations, clearAllDelegatedKeys, updateDelegatedKey, saveDelegatedKey } from '@/modules/delegated-keys/services/delegatedKeys';
import { apiClient } from '@/services/api/apiClient';
import { installationState, GlobalInstallationState } from '@/services/storage/installationState';
import { getKernelAddress } from '@/config/env';

import { styles } from './styles';
import { HeaderBar } from './components/HeaderBar';
import { Description } from './components/Description';
import { CreateKeyButton } from './components/CreateKeyButton';
import { OngoingInstallationCard } from './components/OngoingInstallationCard';
import { formatUnits } from 'viem';
import { AddressModal } from './components/AddressModal';
import { RestrictionsModal, RestrictionDetails } from './components/RestrictionsModal';

import { InstallationDetailsModal } from './components/InstallationDetailsModal';
import { DeviceDetailsModal } from './components/DeviceDetailsModal';
import { ConfirmModal } from './components/ConfirmModal';
import { getDelegatedKeys as getDelegatedKeysStorage } from '@/modules/delegated-keys/services/delegatedKeys';
import { useWallet } from '@/modules/account/state/WalletContext';
import { PermissionPolicyType } from '@/domain/types';
import { debugLog } from '@/services/api/helpers';

const formatTokenLimit = (txLimit: string, dailyLimit: string, decimals?: number, symbol?: string) => {
  try {
    const dec = decimals ?? 18;
    const perTx = formatUnits(BigInt(txLimit ?? '0'), dec);
    const perDay = formatUnits(BigInt(dailyLimit ?? '0'), dec);
    return { perTx, perDay, symbol: symbol || 'TOKEN' };
  } catch {
    return { perTx: txLimit, perDay: dailyLimit, symbol: symbol || 'TOKEN' };
  }
};

export default function SmartWatchScreen() {
  const [connectedDevices, setConnectedDevices] = useState<DelegatedKeyData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showInstallationDetails, setShowInstallationDetails] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<DelegatedKeyData | null>(null);
  const [revokeAddress, setRevokeAddress] = useState('');
  const [showDeviceDetails, setShowDeviceDetails] = useState(false);
  const [selectedDeviceForDetails, setSelectedDeviceForDetails] = useState<DelegatedKeyData | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState('');
  const [ongoingInstallation, setOngoingInstallation] = useState<DelegatedKeyData | null>(null);
  const [globalInstallationState, setGlobalInstallationState] = useState<GlobalInstallationState>(installationState.getState());
  const [showRestrictionsModal, setShowRestrictionsModal] = useState(false);
  const [selectedDeviceForRestrictions, setSelectedDeviceForRestrictions] = useState<DelegatedKeyData | null>(null);
  const [isRefreshingFromContract, setIsRefreshingFromContract] = useState(false);
  const [restrictionsDetails, setRestrictionsDetails] = useState<RestrictionDetails>(null);
  const [isLoadingRestrictions, setIsLoadingRestrictions] = useState(false);
  const [isSyncingKeys, setIsSyncingKeys] = useState(false);
  const [nameEdits, setNameEdits] = useState<Record<string, string>>({});
  const [toastMessage, setToastMessage] = useState('');
  const [toastSuccess, setToastSuccess] = useState(false);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmPayload, setConfirmPayload] = useState<{ device?: DelegatedKeyData; address?: string } | null>(null);
  const { wallet } = useWallet()

  // Load delegated keys on component mount and when focused

  // Load delegated keys on component mount and when focused
  useEffect(() => {
    loadDelegatedKeys();
  }, []);

  // Subscribe to global installation state changes
  useEffect(() => {
    const unsubscribe = installationState.subscribe((state) => {
      console.log('[SmartWatch] Global installation state update:', state);
      setGlobalInstallationState(state);
      
      // Update ongoing installation based on global state
      if (state.isInstalling && state.deviceId) {
        const installationData = installationState.getInstallationData();
        setOngoingInstallation(installationData);
      } else {
        setOngoingInstallation(null);
      }
      
      // Reload delegated keys when installation completes
      if (state.status?.step === 'completed') {
        setTimeout(() => {
          loadDelegatedKeys();
        }, 1000);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDelegatedKeys();
    }, [])
  );

  const loadDelegatedKeys = async () => {
    try {
      setIsLoading(true);
      const keys = await getDelegatedKeys();
      
      // Check for stuck installations (installing status with old timestamps)
      const now = new Date();
      const stuckInstallations = keys.filter(key => {
        if (key.installationStatus !== 'installing') return false;
        const createdAt = new Date(key.createdAt);
        const timeDiff = now.getTime() - createdAt.getTime();
        const hoursDiff = timeDiff / (1000 * 60 * 60);
        return hoursDiff > 1; // Consider stuck if older than 1 hour
      });
      
      // Remove stuck installations automatically
      if (stuckInstallations.length > 0) {
        console.log('Found stuck installations, removing:', stuckInstallations.length);
        const filteredKeys = keys.filter(key => !stuckInstallations.includes(key));
        await AsyncStorage.setItem('delegatedKeys', JSON.stringify(filteredKeys));
        // Reload with cleaned data
        const cleanedKeys = filteredKeys;
        
        // Separate ongoing installation from completed devices
        const ongoing = cleanedKeys.find(key => key.installationStatus === 'installing' || key.installationStatus === 'granting');
        const completed = cleanedKeys.filter(key => key.installationStatus === 'completed' || !key.installationStatus);
        
        console.log('[SmartWatch] Loaded keys - Ongoing:', ongoing?.deviceName, 'Completed:', completed.length);
        
        setOngoingInstallation(ongoing || null);
        setConnectedDevices(completed);
      } else {
        // Separate ongoing installation from completed devices
        const ongoing = keys.find(key => key.installationStatus === 'installing' || key.installationStatus === 'granting');
        const completed = keys.filter(key => key.installationStatus === 'completed' || !key.installationStatus);
        
        console.log('[SmartWatch] Loaded keys - Ongoing:', ongoing?.deviceName, 'Completed:', completed.length);
        
        setOngoingInstallation(ongoing || null);
        setConnectedDevices(completed);
      }
    } catch (error) {
      console.error('Error loading delegated keys:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateDelegatedKey = () => {
    router.push('/settings/smart-watch-connection/create-delegated-key/create-key');
  };

  // Refresh the list when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('[SmartWatch] Screen focused, reloading delegated keys...');
      loadDelegatedKeys();
    }, [])
  );

  const handleCloseInstallationDetails = () => {
    setShowInstallationDetails(false);
    setSelectedDevice(null);
  };

  const handleCloseDeviceDetails = () => {
    setShowDeviceDetails(false);
    setSelectedDeviceForDetails(null);
  };

  const handleViewRestrictions = async (device: DelegatedKeyData) => {
    setRestrictionsDetails(null);
    setSelectedDeviceForRestrictions(device);
    setShowRestrictionsModal(true);
    await loadRestrictionsFromContract(device);
  };

  const handleCloseRestrictions = () => {
    setShowRestrictionsModal(false);
    setSelectedDeviceForRestrictions(null);
    setRestrictionsDetails(null);
    setIsLoadingRestrictions(false);
  };

  const handleRefreshFromContract = async () => {
    if (!selectedDeviceForRestrictions) return;
    await loadRestrictionsFromContract(selectedDeviceForRestrictions, true);
  };

  const loadRestrictionsFromContract = async (device: DelegatedKeyData, isManualRefresh = false) => {
    try {
      if (isManualRefresh) {
        setIsRefreshingFromContract(true);
      } else {
        setIsLoadingRestrictions(true);
      }

      const kernelAddress = wallet?.address;
      if (!kernelAddress) {
        throw new Error('Something went wrong with your address');
      }

      const response = await apiClient.fetchCallPolicyPermissions({
        owner: wallet?.address,
        delegatedKey: device.publicAddress,
      });

      console.log("*".repeat(30))
      console.log("*".repeat(30))
      console.log("response")
      console.log(response)
      console.log("*".repeat(30))
      console.log("*".repeat(30))

      if (!response.success || !response.data) {
        throw new Error('Unable to fetch call policy details');
      }

      setRestrictionsDetails({
        allowedTokens: response.data.allowedTokens || [],
        allowedRecipients: response.data.allowedRecipients || [],
        statusText: response.data.statusText,
        delegatedKey: response.delegatedKey,
      });

      setSelectedDeviceForRestrictions((prev) => (prev && prev.id === device.id ? prev : prev));
    } catch (error: any) {
      console.error('[Restrictions] Error fetching details:', error);
      Alert.alert('Error', error?.message || 'Failed to fetch call policy details');
    } finally {
      setIsLoadingRestrictions(false);
      if (isManualRefresh) {
        setIsRefreshingFromContract(false);
      }
    }
  };

  const handleRevokeFromDetails = (device: DelegatedKeyData) => {
    setConfirmPayload({ device });
    setConfirmVisible(true);
  };

  const handleRevokeDevice = (device: DelegatedKeyData) => {
    setConfirmPayload({ device });
    setConfirmVisible(true);
  };


  const showToast = (message: string, success = false) => {
    setToastMessage(message);
    setToastSuccess(success);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.delay(1400),
      Animated.timing(toastOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setToastMessage(''));
  };

  const handleCopyAddress = (address: string) => {
    Clipboard.setString(address);
    showToast('Delegated public key copied');
  };

  const handleShowFullAddress = (address: string) => {
    setSelectedAddress(address);
    setShowAddressModal(true);
  };

  const formatShortAddress = (address: string) => {
    if (address.length <= 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleViewInstallation = (device: DelegatedKeyData) => {
    router.push({
      pathname: '/settings/smart-watch-connection/installation-progress-screen/installation-progress',
      params: {
        deviceId: device.id,
        deviceName: device.deviceName,
        keyType: device.keyType,
      }
    });
  };

  const handleSyncFromContract = async () => {
    try {
      setIsSyncingKeys(true);
      const kernelAddress = getKernelAddress() || '0xB115dc375D7Ad88D7c7a2180D0E548Cb5B83D86A';
      const storedKeys = await getDelegatedKeysStorage();
      const storedMap = new Map(storedKeys.map(k => [k.publicAddress.toLowerCase(), k]));

      // Fetch all delegated keys from contract via backend
      const contractKeysRes = await apiClient.fetchAllDelegatedKeys({ owner: kernelAddress });
      const contractKeys: string[] = contractKeysRes?.allDelegatedKeys ?? [];

      // If on-chain says there are no delegated keys, treat it as the single source of truth:
      // wipe local cache and UI state.
      if (!contractKeys || contractKeys.length === 0) {
        await clearAllDelegatedKeys();
        setConnectedDevices([]);
        setOngoingInstallation(null);
        showToast('No delegated keys found on-chain. Local cache cleared.', true);
        return;
      }

      const refreshedDevices: DelegatedKeyData[] = [];

      // Refresh existing and add new
      for (const delegatedKey of contractKeys) {
        const lower = delegatedKey.toLowerCase();
        const existing = storedMap.get(lower);
        try {
          const res = await apiClient.fetchCallPolicyPermissions({
            owner: kernelAddress,
            delegatedKey,
          });

          const tokenLimits =
            res?.data?.allowedTokens?.map((t: any) => ({
              tokenAddress: t.token,
              tokenSymbol: t.symbol || 'TOKEN',
              maxAmountPerTx: t.txLimit,
              maxAmountPerDay: t.dailyLimit,
            })) ?? existing?.tokenLimits;

          const updated: DelegatedKeyData = {
            id: existing?.id ?? Date.now().toString(),
            deviceName: existing?.deviceName || `Delegated key ${delegatedKey.slice(2, 6)}`,
            keyType: existing?.keyType ?? PermissionPolicyType.CALL_POLICY,
            permissionId: existing?.permissionId ?? '',
            vId: existing?.vId ?? '',
            publicAddress: delegatedKey,
            createdAt: existing?.createdAt ?? new Date().toISOString(),
            whitelistAddresses: res?.data?.allowedRecipients ?? existing?.whitelistAddresses,
            tokenLimits,
            installationStatus: res?.data?.isActive ? 'completed' : existing?.installationStatus ?? 'completed',
          };

          if (existing) {
            await updateDelegatedKey(existing.id, updated);
          } else {
            await saveDelegatedKey(updated);
          }
          refreshedDevices.push(updated);
        } catch (err) {
          console.warn('[Sync Keys] Failed to refresh key', delegatedKey, err);
          if (existing) {
            refreshedDevices.push(existing);
          }
        }
      }

      // Persist only the on-chain set (remove any stale locally stored keys)
      await clearAllDelegatedKeys();
      for (const dev of refreshedDevices) {
        await saveDelegatedKey(dev);
      }

      setConnectedDevices(
        refreshedDevices.filter(k => k.installationStatus !== 'installing' && k.installationStatus !== 'granting')
      );
      setOngoingInstallation(
        refreshedDevices.find(k => k.installationStatus === 'installing' || k.installationStatus === 'granting') || null
      );
      showToast('Delegated keys refreshed', true);
    } catch (error: any) {
      console.error('[Sync Keys] Error:', error);
      Alert.alert('Error', error?.message || 'Failed to refresh delegated keys from contract.');
    } finally {
      setIsSyncingKeys(false);
      await loadDelegatedKeys();
    }
  };

  const startEditingName = (device: DelegatedKeyData) => {
    setNameEdits((prev) => ({ ...prev, [device.id]: device.deviceName }));
  };

  const saveEditedName = async (device: DelegatedKeyData) => {
    const newName = nameEdits[device.id]?.trim();
    if (!newName) {
      Alert.alert('Error', 'Device name cannot be empty.');
      return;
    }
    await updateDelegatedKey(device.id, { deviceName: newName });
    setNameEdits((prev) => {
      const copy = { ...prev };
      delete copy[device.id];
      return copy;
    });
    await loadDelegatedKeys();
  };

  const handleRemoveStuckInstallations = () => {
    Alert.alert(
      'Remove Stuck Installations',
      'This will remove all installations that are stuck in the "installing" state. Are you sure you want to proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeStuckInstallations();
              await loadDelegatedKeys();
              Alert.alert('Success', 'Stuck installations removed successfully');
            } catch (error) {
              console.error('Error removing stuck installations:', error);
              Alert.alert('Error', 'Failed to remove stuck installations');
            }
          }
        }
      ]
    );
  };

  const handleClearAllKeys = () => {
    Alert.alert(
      'Clear All Keys',
      'This will remove ALL delegated keys from your device. This action cannot be undone. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAllDelegatedKeys();
              await loadDelegatedKeys();
              Alert.alert('Success', 'All delegated keys cleared successfully');
            } catch (error) {
              console.error('Error clearing all keys:', error);
              Alert.alert('Error', 'Failed to clear all keys');
            }
          }
        }
      ]
    );
  };


  const handleRevokeAllKeys = () => {
    if (connectedDevices.length === 0) {
      Alert.alert('Info', 'No delegated keys to revoke');
      return;
    }

    Alert.alert(
      'Revoke All Delegated Keys',
      `Are you sure you want to revoke ALL ${connectedDevices.length} delegated keys?\n\nThis action cannot be undone and will permanently remove all keys. Your smart watches will no longer be able to perform transactions.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke All',
          style: 'destructive',
          onPress: async () => {
            try {
              // Remove all keys
              for (const device of connectedDevices) {
                await removeDelegatedKey(device.id);
              }
              await loadDelegatedKeys();
              Alert.alert('Success', 'All delegated keys have been revoked successfully');
            } catch (error) {
              console.error('Error revoking all delegated keys:', error);
              Alert.alert('Error', 'Failed to revoke some or all delegated keys');
            }
          }
        }
      ]
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <HeaderBar />
          <Description />
          <CreateKeyButton onPress={handleCreateDelegatedKey} />

          {/* Ongoing Installation */}
          {ongoingInstallation && (
            <OngoingInstallationCard
              ongoingInstallation={ongoingInstallation}
              globalInstallationState={globalInstallationState}
              onViewInstallation={handleViewInstallation}
            />
          )}

          {/* Connected Devices */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Connected Devices</Text>
              <TouchableOpacity
                style={[styles.refreshFromContractButton, isSyncingKeys && styles.refreshButtonDisabled]}
                onPress={handleSyncFromContract}
                disabled={isSyncingKeys}
              >
                {isSyncingKeys ? (
                  <ActivityIndicator size="small" color="#8B5CF6" />
                ) : (
                  <IconSymbol name="arrow.clockwise" size={16} color="#8B5CF6" />
                )}
                <Text style={styles.refreshFromContractText}>
                  {isSyncingKeys ? 'Syncing...' : 'Sync from Contract'}
                </Text>
              </TouchableOpacity>
            </View>
            
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading devices...</Text>
              </View>
            ) : connectedDevices.length > 0 ? (
              connectedDevices.map((device) => (
                <View key={device.id} style={styles.deviceCard}>
                  <View style={styles.deviceHeader}>
                    <IconSymbol name="applewatch" size={24} color="#8B5CF6" />
                    <Text style={styles.deviceName}>{device.deviceName}</Text>
                    {nameEdits[device.id] === undefined && (
                      <TouchableOpacity onPress={() => startEditingName(device)} style={styles.editIconButton}>
                        <IconSymbol name="pencil" size={14} color="#8B5CF6" />
                      </TouchableOpacity>
                    )}
                  </View>
                  
                  <View style={styles.deviceDetails}>
                    {nameEdits[device.id] !== undefined && (
                      <View style={styles.editNameRow}>
                        <TextInput
                          style={styles.nameInput}
                          value={nameEdits[device.id]}
                          onChangeText={(text) => setNameEdits(prev => ({ ...prev, [device.id]: text }))}
                          placeholder="Device name"
                          placeholderTextColor="#666666"
                        />
                        <TouchableOpacity style={styles.saveNameButton} onPress={() => saveEditedName(device)}>
                          <Text style={styles.saveNameButtonText}>Save</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.cancelEditButton}
                          onPress={() => setNameEdits(prev => { const c = { ...prev }; delete c[device.id]; return c; })}
                        >
                          <Text style={styles.cancelEditButtonText}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    <View style={styles.addressSection}>
                      <Text style={styles.detailLabel}>Public Delegated Address:</Text>
                      <View style={styles.addressRow}>
                        <Text style={styles.shortAddressText}>{formatShortAddress(device.publicAddress)}</Text>
                        <TouchableOpacity
                          style={styles.copyButton}
                          onPress={() => handleCopyAddress(device.publicAddress)}
                        >
                          <IconSymbol name="doc.on.doc" size={16} color="#8B5CF6" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.viewFullButton}
                          onPress={() => handleShowFullAddress(device.publicAddress)}
                        >
                          <IconSymbol name="eye" size={16} color="#8B5CF6" />
                        </TouchableOpacity>
                        {device.keyType === PermissionPolicyType.CALL_POLICY && (
                          <TouchableOpacity
                            style={styles.viewRestrictionsButton}
                            onPress={() => handleViewRestrictions(device)}
                          >
                            <IconSymbol name="shield.checkered" size={16} color="#8B5CF6" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                    
                    
                  </View>
                  
                  <View style={styles.deviceActions}>
                    <TouchableOpacity
                      style={styles.revokeButton}
                      onPress={() => handleRevokeDevice(device)}
                      disabled={isRevoking}
                    >
                      {isRevoking ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <IconSymbol name="trash" size={16} color="#FFFFFF" />
                      )}
                      <Text style={styles.revokeButtonText}>
                        {isRevoking ? 'Revoking...' : 'Revoke'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <IconSymbol name="applewatch" size={48} color="#666666" />
                <Text style={styles.emptyStateText}>No devices connected</Text>
                <Text style={styles.emptyStateSubtext}>
                  Connect your smart watch to get started
                </Text>
              </View>
            )}
          </View>

          {/* Revoke Keys Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Revoke Delegated Keys</Text>

            {/* Revoke All Keys */}
            <View style={styles.revokeSection}>
              <Text style={styles.revokeSectionTitle}>Revoke All Keys</Text>
              <TouchableOpacity
                style={styles.revokeAllButton}
                onPress={handleRevokeAllKeys}
              >
                <IconSymbol name="trash.fill" size={20} color="#FFFFFF" />
                <Text style={styles.revokeAllButtonText}>Revoke All Delegated Keys</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Security Notice */}
          <View style={styles.securityNotice}>
            <IconSymbol name="exclamationmark.triangle.fill" size={20} color="#F59E0B" />
            <Text style={styles.securityNoticeText}>
              Delegated keys allow your smart watch to perform transactions on your behalf. 
              Choose permissions carefully and monitor usage regularly.
            </Text>
          </View>
        </View>
      </ScrollView>

      <AddressModal
        visible={showAddressModal}
        address={selectedAddress}
        onClose={() => setShowAddressModal(false)}
        onCopy={() => handleCopyAddress(selectedAddress)}
      />

      <InstallationDetailsModal
        visible={showInstallationDetails}
        device={selectedDevice}
        onClose={handleCloseInstallationDetails}
      />

      <DeviceDetailsModal
        visible={showDeviceDetails}
        device={selectedDeviceForDetails}
        onClose={handleCloseDeviceDetails}
        onRevoke={handleRevokeFromDetails}
      />

      {/* Restrictions Modal */}
      <RestrictionsModal
        visible={showRestrictionsModal}
        device={selectedDeviceForRestrictions}
        details={restrictionsDetails}
        isLoading={isLoadingRestrictions}
        isRefreshing={isRefreshingFromContract}
        onClose={handleCloseRestrictions}
        onRefresh={handleRefreshFromContract}
      />

      <ConfirmModal
        visible={confirmVisible}
        title="Revoke Delegated Key"
        message={
          confirmPayload?.device
            ? `Revoke the delegated key "${confirmPayload.device.deviceName}"?\n\nThis action cannot be undone.`
            : 'Revoke the delegated key for this address?\n\nThis action cannot be undone.'
        }
        confirmLabel="Revoke"
        cancelLabel="Cancel"
        address={
          confirmPayload?.device
            ? confirmPayload.device.publicAddress
            : confirmPayload?.address
        }
        addressLabel={
          confirmPayload?.device
            ? `Address • ${confirmPayload.device.deviceName}`
            : 'Delegated Address'
        }
        onCopyAddress={handleCopyAddress}
        onCancel={() => {
          setConfirmVisible(false);
          setConfirmPayload(null);
        }}
        onConfirm={async () => {
          setConfirmVisible(false);
          if (confirmPayload?.device) {
            try {
              setIsRevoking(true);
              const response = await apiClient.revokeKey(confirmPayload.device.publicAddress, wallet!.smartWalletAddress!);
              if (response.success) {
                await removeDelegatedKey(confirmPayload.device.id);
                await loadDelegatedKeys();
                setShowDeviceDetails(false);
                setSelectedDeviceForDetails(null);
                showToast('Delegated key revoked', true);
              } else {
                Alert.alert('Error', 'Failed to revoke delegated key');
              }
            } catch (error) {
              console.error('Error revoking delegated key:', error);
              Alert.alert('Error', 'Failed to revoke delegated key');
            } finally {
              setIsRevoking(false);
            }
          } else if (confirmPayload?.address) {
            setIsRevoking(true);
            try {
              const response = await apiClient.revokeKey(confirmPayload.address, wallet!.smartWalletAddress!);
              if (response.success) {
                try {
                  const keys = await getDelegatedKeys();
                  const keyToRevoke = keys.find(
                    key => key.publicAddress.toLowerCase() === confirmPayload.address!.toLowerCase()
                  );
                  if (keyToRevoke) {
                    await removeDelegatedKey(keyToRevoke.id);
                  }
                } catch (localError) {
                  console.warn('Could not remove from local storage:', localError);
                }
                await loadDelegatedKeys();
                setRevokeAddress('');
                showToast('Delegated key revoked', true);
              } else {
                Alert.alert('Error', 'Failed to revoke delegated key');
              }
            } catch (error: any) {
              console.error('Error revoking delegated key:', error);
              const errorMessage = error?.message || 'Failed to revoke delegated key';
              Alert.alert('Error', errorMessage);
            } finally {
              setIsRevoking(false);
            }
          }
          setConfirmPayload(null);
        }}
      />

      {toastMessage ? (
        <Animated.View
          style={[
            styles.toastContainer,
            toastSuccess && styles.toastSuccess,
            { opacity: toastOpacity },
          ]}
        >
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      ) : null}

      {/* Debug/Cleanup Section */}
      {/* {(ongoingInstallation || connectedDevices.length > 0) && (
        <View style={styles.debugSection}>
          <Text style={styles.debugSectionTitle}>Debug & Cleanup</Text>
          
          {ongoingInstallation && (
            <TouchableOpacity
              style={styles.debugButton}
              onPress={handleRemoveStuckInstallations}
            >
              <IconSymbol name="trash" size={16} color="#EF4444" />
              <Text style={styles.debugButtonText}>Remove Stuck Installations</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={[styles.debugButton, styles.clearAllButton]}
            onPress={handleClearAllKeys}
          >
            <IconSymbol name="trash.fill" size={16} color="#FFFFFF" />
            <Text style={[styles.debugButtonText, styles.clearAllButtonText]}>Clear All Keys</Text>
          </TouchableOpacity>
        </View>
      )} */}
    </SafeAreaView>
    </>
  );
}
