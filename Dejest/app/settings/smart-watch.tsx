import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal, TextInput, ActivityIndicator, Clipboard } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack, useFocusEffect } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getDelegatedKeys, removeDelegatedKey, DelegatedKeyData, InstallationStatus, removeStuckInstallations, clearAllDelegatedKeys, updateDelegatedKey } from '@/utils/delegatedKeys';
import { apiClient } from '@/utils/apiClient';
import { installationState, GlobalInstallationState } from '@/utils/installationState';
import { getKernelAddress } from '@/utils/config';

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
    router.push('/settings/smart-watch/create-key');
  };

  // Refresh the list when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('[SmartWatch] Screen focused, reloading delegated keys...');
      loadDelegatedKeys();
    }, [])
  );

  const handleShowInstallationDetails = (device: DelegatedKeyData) => {
    setSelectedDevice(device);
    setShowInstallationDetails(true);
  };

  const handleCloseInstallationDetails = () => {
    setShowInstallationDetails(false);
    setSelectedDevice(null);
  };

  const handleShowDeviceDetails = (device: DelegatedKeyData) => {
    setSelectedDeviceForDetails(device);
    setShowDeviceDetails(true);
  };

  const handleCloseDeviceDetails = () => {
    setShowDeviceDetails(false);
    setSelectedDeviceForDetails(null);
  };

  const handleViewRestrictions = (device: DelegatedKeyData) => {
    setSelectedDeviceForRestrictions(device);
    setShowRestrictionsModal(true);
  };

  const handleCloseRestrictions = () => {
    setShowRestrictionsModal(false);
    setSelectedDeviceForRestrictions(null);
  };

  const handleRefreshFromContract = async () => {
    if (!selectedDeviceForRestrictions) return;
    
    try {
      setIsRefreshingFromContract(true);
      console.log('[Restrictions] Refreshing data from contract...');
      console.log('[Restrictions] Device data:', selectedDeviceForRestrictions);
      console.log('[Restrictions] Using permissionId:', selectedDeviceForRestrictions.permissionId);
      console.log('[Restrictions] Using vId:', selectedDeviceForRestrictions.vId);
      console.log('[Restrictions] Delegated EOA:', selectedDeviceForRestrictions.publicAddress);
      
      const kernelAddress = getKernelAddress() || '0xB115dc375D7Ad88D7c7a2180D0E548Cb5B83D86A';
      console.log('[Restrictions] Kernel address:', kernelAddress);
      
      // If permissionId is empty, try to regenerate it
      let permissionIdToUse = selectedDeviceForRestrictions.permissionId;
      if (!permissionIdToUse || permissionIdToUse === '') {
        console.log('[Restrictions] PermissionId is empty, attempting to regenerate...');
        // Call server to regenerate permissionId
        try {
          const regenerateResponse = await apiClient.regeneratePermissionId({
            kernelAddress,
            delegatedEOA: selectedDeviceForRestrictions.publicAddress
          });
          if (regenerateResponse.success) {
            permissionIdToUse = regenerateResponse.permissionId;
            console.log('[Restrictions] Regenerated permissionId:', permissionIdToUse);
            
            // Update the device data with the regenerated permissionId
            await updateDelegatedKey(selectedDeviceForRestrictions.id, {
              permissionId: permissionIdToUse,
              vId: regenerateResponse.vId
            });
            
            // Update the selected device for display
            setSelectedDeviceForRestrictions({
              ...selectedDeviceForRestrictions,
              permissionId: permissionIdToUse,
              vId: regenerateResponse.vId
            });
          }
        } catch (regenerateError) {
          console.log('[Restrictions] Failed to regenerate permissionId:', regenerateError);
        }
      }
      
      // Try to fetch permissions with daily usage data first
      try {
        const usageResponse = await apiClient.getAllCallPolicyPermissionsWithUsage({
          policyId: permissionIdToUse,
          owner: kernelAddress
        });
        
        if (usageResponse.success) {
          console.log('[Restrictions] Contract data with usage fetched:', usageResponse.permissions);
          
          // Convert the response to match our CallPolicyPermission interface
          const convertedPermissions = usageResponse.permissions.map(perm => ({
            callType: perm.callType || 0, // Use decoded callType from API
            target: perm.target || '0x0000000000000000000000000000000000000000', // Use decoded target from API
            selector: perm.selector || '0x00000000', // Use decoded selector from API
            valueLimit: perm.valueLimit,
            dailyLimit: perm.dailyLimit,
            rules: perm.rules,
            dailyUsage: perm.dailyUsage // Add daily usage info
          }));
          
          // Update the device data with fresh contract data including usage
          const updatedDevice = {
            ...selectedDeviceForRestrictions,
            callPolicyPermissions: convertedPermissions
          };
          
          // Update local storage
          await updateDelegatedKey(selectedDeviceForRestrictions.id, {
            callPolicyPermissions: convertedPermissions
          });
          
          // Update the selected device for display
          setSelectedDeviceForRestrictions(updatedDevice);
          
          // Reload the full list
          await loadDelegatedKeys();
          
          Alert.alert(
            'Data Refreshed',
            `Successfully fetched ${usageResponse.permissions.length} permissions with daily usage from the smart contract.`,
            [{ text: 'OK' }]
          );
          return;
        }
      } catch (usageError) {
        console.log('[Restrictions] Failed to fetch usage data, falling back to regular fetch:', usageError);
      }
      
      // Fallback to regular fetch if usage endpoint fails
      const response = await apiClient.fetchCallPolicyPermissions({
        kernelAddress,
        delegatedEOA: selectedDeviceForRestrictions.publicAddress,
        permissionId: permissionIdToUse
      });
      
      if (response.success) {
        console.log('[Restrictions] Contract data fetched:', response.permissions);
        
        // Update the device data with fresh contract data
        const updatedDevice = {
          ...selectedDeviceForRestrictions,
          callPolicyPermissions: response.permissions
        };
        
        // Update local storage
        await updateDelegatedKey(selectedDeviceForRestrictions.id, {
          callPolicyPermissions: response.permissions
        });
        
        // Update the selected device for display
        setSelectedDeviceForRestrictions(updatedDevice);
        
        // Reload the full list
        await loadDelegatedKeys();
        
        Alert.alert(
          'Data Refreshed',
          `Successfully fetched ${response.count} permissions from the smart contract.`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', 'Failed to fetch data from contract');
      }
    } catch (error: any) {
      console.error('[Restrictions] Error refreshing from contract:', error);
      Alert.alert('Error', `Failed to refresh data: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsRefreshingFromContract(false);
    }
  };

  const handleRevokeFromDetails = (device: DelegatedKeyData) => {
    Alert.alert(
      'Revoke Delegated Key',
      `Are you sure you want to revoke the delegated key for "${device.deviceName}"?\n\nPublic Address: ${device.publicAddress}\n\nThis action cannot be undone and will permanently remove the key.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeDelegatedKey(device.id);
              await loadDelegatedKeys();
              setShowDeviceDetails(false);
              setSelectedDeviceForDetails(null);
              Alert.alert('Success', 'Delegated key revoked successfully');
            } catch (error) {
              console.error('Error revoking delegated key:', error);
              Alert.alert('Error', 'Failed to revoke delegated key');
            }
          }
        }
      ]
    );
  };

  const getStatusColor = (status?: InstallationStatus) => {
    switch (status) {
      case 'completed':
        return '#10B981';
      case 'installing':
        return '#F59E0B';
      case 'failed':
        return '#EF4444';
      default:
        return '#10B981'; // Default to connected for backward compatibility
    }
  };

  const getStatusText = (status?: InstallationStatus) => {
    switch (status) {
      case 'completed':
        return 'Connected';
      case 'installing':
        return 'Installing';
      case 'failed':
        return 'Failed';
      default:
        return 'Connected'; // Default to connected for backward compatibility
    }
  };

  const handleDisconnectDevice = (deviceId: string) => {
    Alert.alert(
      'Disconnect Device',
      'Are you sure you want to disconnect this smart watch? This will remove the delegated key permanently.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeDelegatedKey(deviceId);
              await loadDelegatedKeys(); // Reload the list
              Alert.alert('Success', 'Device disconnected successfully');
            } catch (error) {
              console.error('Error disconnecting device:', error);
              Alert.alert('Error', 'Failed to disconnect device');
            }
          }
        }
      ]
    );
  };

  const handleRevokeByAddress = () => {
    if (!revokeAddress.trim()) {
      Alert.alert('Error', 'Please enter a public address');
      return;
    }

    // Validate Ethereum address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(revokeAddress.trim())) {
      Alert.alert('Error', 'Please enter a valid Ethereum address (0x...)');
      return;
    }

    Alert.alert(
      'Revoke Delegated Key',
      `Are you sure you want to revoke the delegated key for address:\n\n${revokeAddress}\n\nThis action cannot be undone and will permanently remove the key from the blockchain.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            setIsRevoking(true);
            try {
              console.log('Revoking delegated key for address:', revokeAddress);
              
              // Call server API to revoke the key on blockchain
              const response = await apiClient.revokeKey(revokeAddress.trim());
              
              if (response.success) {
                // Also remove from local storage if it exists
                try {
                  const keys = await getDelegatedKeys();
                  const keyToRevoke = keys.find(key => key.publicAddress.toLowerCase() === revokeAddress.toLowerCase());
                  if (keyToRevoke) {
                    await removeDelegatedKey(keyToRevoke.id);
                  }
                } catch (localError) {
                  console.warn('Could not remove from local storage:', localError);
                }
                
                await loadDelegatedKeys();
                setRevokeAddress('');
                
                Alert.alert(
                  'Success', 
                  `Delegated key revoked successfully!\n\nTransaction Hash: ${response.txHash}`,
                  [{ text: 'OK' }]
                );
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
        }
      ]
    );
  };

  const handleRevokeDevice = (device: DelegatedKeyData) => {
    Alert.alert(
      'Revoke Delegated Key',
      `Are you sure you want to revoke the delegated key for "${device.deviceName}"?\n\nAddress: ${device.publicAddress}\n\nThis action cannot be undone and will permanently remove the key from the blockchain.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            setIsRevoking(true);
            try {
              console.log('Revoking delegated key for device:', device.deviceName);
              
              // Call server API to revoke the key on blockchain
              const response = await apiClient.revokeKey(device.publicAddress);
              
              if (response.success) {
                // Remove from local storage
                await removeDelegatedKey(device.id);
                await loadDelegatedKeys();
                
                Alert.alert(
                  'Success', 
                  `Delegated key "${device.deviceName}" revoked successfully!\n\nTransaction Hash: ${response.txHash}`,
                  [{ text: 'OK' }]
                );
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
        }
      ]
    );
  };

  const handleCopyAddress = (address: string) => {
    Clipboard.setString(address);
    Alert.alert('Copied', 'Delegated public key copied to clipboard');
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
      pathname: '/settings/smart-watch/installation-progress',
      params: {
        deviceId: device.id,
        deviceName: device.deviceName,
        keyType: device.keyType,
      }
    });
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
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <IconSymbol name="chevron.left" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.title}>Smart Watch Connection</Text>
            <View style={styles.placeholder} />
          </View>

          {/* Description */}
          <View style={styles.descriptionContainer}>
            <IconSymbol name="applewatch" size={48} color="#8B5CF6" />
            <Text style={styles.descriptionTitle}>Connect Your Smart Watch</Text>
            <Text style={styles.descriptionText}>
              Create delegated keys for your smart watch to enable secure, limited transactions directly from your wrist.
            </Text>
          </View>

          {/* Create New Key Button - Moved to top */}
          <TouchableOpacity 
            style={styles.createButton}
            onPress={handleCreateDelegatedKey}
          >
            <IconSymbol name="plus" size={20} color="#FFFFFF" />
            <Text style={styles.createButtonText}>Create New Delegated Key</Text>
          </TouchableOpacity>

          {/* Ongoing Installation */}
          {ongoingInstallation && (
            <View style={styles.ongoingInstallationCard}>
              <View style={styles.ongoingHeader}>
                <IconSymbol name="applewatch" size={24} color="#8B5CF6" />
                <Text style={styles.ongoingTitle}>
                  {globalInstallationState.status?.step === 'completed' ? 'Installation Complete' : 'Installing...'}
                </Text>
                <View style={styles.ongoingBadge}>
                  <Text style={styles.ongoingBadgeText}>
                    {globalInstallationState.status?.step === 'completed' ? 'COMPLETED' : 'IN PROGRESS'}
                  </Text>
                </View>
              </View>
              
              <View style={styles.ongoingDetails}>
                <Text style={styles.ongoingDeviceName}>{ongoingInstallation.deviceName}</Text>
                <Text style={styles.ongoingKeyType}>
                  {ongoingInstallation.keyType === 'sudo' ? 'Sudo Access' : 'Restricted Access'}
                </Text>
                
                {ongoingInstallation.installationProgress ? (
                  <View style={styles.ongoingProgress}>
                    <View style={styles.ongoingProgressBar}>
                      <View 
                        style={[
                          styles.ongoingProgressFill,
                          { 
                            width: `${globalInstallationState.progress}%` 
                          }
                        ]} 
                      />
                    </View>
                    <Text style={styles.ongoingProgressText}>
                      {globalInstallationState.currentStep}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.ongoingProgress}>
                    <View style={styles.ongoingProgressBar}>
                      <View 
                        style={[
                          styles.ongoingProgressFill,
                          { width: '100%' }
                        ]} 
                      />
                    </View>
                    <Text style={styles.ongoingProgressText}>
                      Installation Complete
                    </Text>
                  </View>
                )}
              </View>
              
              <TouchableOpacity
                style={styles.viewInstallationButton}
                onPress={() => handleViewInstallation(ongoingInstallation)}
              >
                <IconSymbol name="arrow.right" size={16} color="#8B5CF6" />
                <Text style={styles.viewInstallationText}>View Progress</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Connected Devices */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Connected Devices</Text>
            
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
                  </View>
                  
                  <View style={styles.deviceDetails}>
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
                        {device.keyType === 'restricted' && (
                          <TouchableOpacity
                            style={styles.viewRestrictionsButton}
                            onPress={() => handleViewRestrictions(device)}
                          >
                            <IconSymbol name="shield.checkered" size={16} color="#8B5CF6" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                    
                    <View style={styles.dateSection}>
                      <Text style={styles.dateLabel}>Date:</Text>
                      <Text style={styles.dateValue}>
                        {new Date(device.createdAt).toLocaleDateString('en-US', {
                          month: '2-digit',
                          day: '2-digit',
                          year: 'numeric'
                        })}
                      </Text>
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
            
            {/* Revoke by Address */}
            <View style={styles.revokeSection}>
              <Text style={styles.revokeSectionTitle}>Revoke by Public Address</Text>
              <View style={styles.revokeInputContainer}>
                <TextInput
                  style={styles.revokeInput}
                  placeholder="Enter public address..."
                  placeholderTextColor="#666666"
                  value={revokeAddress}
                  onChangeText={setRevokeAddress}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={[styles.revokeButton, isRevoking && styles.revokeButtonDisabled]}
                  onPress={handleRevokeByAddress}
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

      {/* Full Address Modal */}
      <Modal
        visible={showAddressModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAddressModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Delegated Public Key</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowAddressModal(false)}
              >
                <IconSymbol name="xmark" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalContent}>
              <View style={styles.fullAddressContainer}>
                <Text style={styles.fullAddressText}>{selectedAddress}</Text>
              </View>
              
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCopyButton}
                  onPress={() => {
                    handleCopyAddress(selectedAddress);
                    setShowAddressModal(false);
                  }}
                >
                  <IconSymbol name="doc.on.doc.fill" size={20} color="#FFFFFF" />
                  <Text style={styles.copyButtonText}>Copy Public Key</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Installation Details Modal */}
      <Modal
        visible={showInstallationDetails}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseInstallationDetails}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Installation Progress</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleCloseInstallationDetails}
              >
                <IconSymbol name="xmark" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            
            {selectedDevice && (
              <View style={styles.modalContent}>
                <View style={styles.deviceInfoHeader}>
                  <IconSymbol name="applewatch" size={32} color="#8B5CF6" />
                  <Text style={styles.modalDeviceName}>{selectedDevice.deviceName}</Text>
                </View>
                
                {selectedDevice.installationProgress && (
                  <View style={styles.progressContainer}>
                    <View style={styles.progressHeader}>
                      <Text style={styles.progressTitle}>Installation Status</Text>
                      <Text style={styles.progressStep}>
                        Step {selectedDevice.installationProgress.completedSteps} of {selectedDevice.installationProgress.totalSteps}
                      </Text>
                    </View>
                    
                    <View style={styles.progressBar}>
                      <View 
                        style={[
                          styles.progressFill,
                          { 
                            width: `${(selectedDevice.installationProgress.completedSteps / selectedDevice.installationProgress.totalSteps) * 100}%` 
                          }
                        ]} 
                      />
                    </View>
                    
                    <View style={styles.currentStepContainer}>
                      <Text style={styles.currentStepLabel}>Current Step:</Text>
                      <Text style={styles.currentStepText}>
                        {selectedDevice.installationProgress.currentStep}
                      </Text>
                    </View>
                    
                    {selectedDevice.installationProgress.transactionStatus && (
                      <View style={styles.transactionStatusContainer}>
                        <Text style={styles.transactionStatusLabel}>Transaction Status:</Text>
                        <Text style={styles.transactionStatusText}>
                          {selectedDevice.installationProgress.transactionStatus}
                        </Text>
                      </View>
                    )}
                    
                    {selectedDevice.installationProgress.currentNonce && (
                      <View style={styles.nonceContainer}>
                        <Text style={styles.nonceLabel}>Current Nonce:</Text>
                        <Text style={styles.nonceText}>
                          {selectedDevice.installationProgress.currentNonce}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
                
                <View style={styles.modalNote}>
                  <IconSymbol name="info.circle" size={16} color="#8B5CF6" />
                  <Text style={styles.modalNoteText}>
                    This device is being set up on the blockchain. The process may take a few minutes.
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Device Details Modal */}
      <Modal
        visible={showDeviceDetails}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseDeviceDetails}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Device Details</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleCloseDeviceDetails}
              >
                <IconSymbol name="xmark" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            
            {selectedDeviceForDetails && (
              <View style={styles.modalContent}>
                <View style={styles.deviceInfoHeader}>
                  <IconSymbol name="applewatch" size={32} color="#8B5CF6" />
                  <Text style={styles.modalDeviceName}>{selectedDeviceForDetails.deviceName}</Text>
                </View>
                
                <View style={styles.detailsContainer}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Key Type:</Text>
                    <View style={[
                      styles.keyTypeBadge,
                      selectedDeviceForDetails.keyType === 'sudo' ? styles.sudoBadge : styles.restrictedBadge
                    ]}>
                      <Text style={[
                        styles.keyTypeText,
                        selectedDeviceForDetails.keyType === 'sudo' ? styles.sudoText : styles.restrictedText
                      ]}>
                        {selectedDeviceForDetails.keyType === 'sudo' ? 'Sudo Access' : 'Restricted Access'}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Created:</Text>
                    <Text style={styles.detailValue}>
                      {new Date(selectedDeviceForDetails.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Permission ID:</Text>
                    <Text style={styles.detailValueFull}>
                      {selectedDeviceForDetails.permissionId}
                    </Text>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Public Address:</Text>
                    <Text style={styles.detailValueFull}>
                      {selectedDeviceForDetails.publicAddress}
                    </Text>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>vId:</Text>
                    <Text style={styles.detailValueFull}>
                      {selectedDeviceForDetails.vId}
                    </Text>
                  </View>
                  
                  {selectedDeviceForDetails.whitelistAddresses && selectedDeviceForDetails.whitelistAddresses.length > 0 && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Whitelist Addresses:</Text>
                      <View style={styles.addressList}>
                        {selectedDeviceForDetails.whitelistAddresses.map((address, index) => (
                          <Text key={index} style={styles.detailValueFull}>
                            {address}
                          </Text>
                        ))}
                      </View>
                    </View>
                  )}
                  
                  {selectedDeviceForDetails.tokenLimits && selectedDeviceForDetails.tokenLimits.length > 0 && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Token Limits:</Text>
                      <View style={styles.tokenLimitsList}>
                        {selectedDeviceForDetails.tokenLimits.map((limit, index) => (
                          <View key={index} style={styles.tokenLimitItem}>
                            <Text style={styles.detailValueFull}>
                              {limit.tokenSymbol}: {limit.maxAmountPerTx} per tx, {limit.maxAmountPerDay} per day
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
                
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.revokeFromDetailsButton}
                    onPress={() => handleRevokeFromDetails(selectedDeviceForDetails)}
                  >
                    <IconSymbol name="trash" size={16} color="#FFFFFF" />
                    <Text style={styles.revokeFromDetailsButtonText}>Revoke Key</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Restrictions Modal */}
      <Modal
        visible={showRestrictionsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCloseRestrictions}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.restrictionsModal}>
            <View style={styles.restrictionsModalHeader}>
              <Text style={styles.restrictionsModalTitle}>Delegated Key Restrictions</Text>
              <View style={styles.restrictionsHeaderButtons}>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={handleCloseRestrictions}
                >
                  <IconSymbol name="xmark" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
            
            {selectedDeviceForRestrictions && (
              <ScrollView style={styles.restrictionsContent}>
                <View style={styles.restrictionsSection}>
                  <Text style={styles.restrictionsSectionTitle}>Device Information</Text>
                  <View style={styles.restrictionsItem}>
                    <Text style={styles.restrictionsLabel}>Device Name:</Text>
                    <Text style={styles.restrictionsValue}>{selectedDeviceForRestrictions.deviceName}</Text>
                  </View>
                  <View style={styles.restrictionsItem}>
                    <Text style={styles.restrictionsLabel}>Public Address:</Text>
                    <Text style={styles.restrictionsValue}>{selectedDeviceForRestrictions.publicAddress}</Text>
                  </View>
                  <View style={styles.restrictionsItem}>
                    <Text style={styles.restrictionsLabel}>Key Type:</Text>
                    <Text style={styles.restrictionsValue}>
                      {selectedDeviceForRestrictions.keyType === 'restricted' ? 'Restricted Access' : 'Sudo Access'}
                    </Text>
                  </View>
                </View>

                {/* Refresh from Contract Button */}
                {selectedDeviceForRestrictions.keyType === 'restricted' && (
                  <View style={styles.refreshButtonContainer}>
                    <TouchableOpacity
                      style={styles.refreshFromContractButton}
                      onPress={handleRefreshFromContract}
                      disabled={isRefreshingFromContract}
                    >
                      {isRefreshingFromContract ? (
                        <ActivityIndicator size="small" color="#8B5CF6" />
                      ) : (
                        <IconSymbol name="arrow.clockwise" size={16} color="#8B5CF6" />
                      )}
                      <Text style={styles.refreshFromContractText}>
                        {isRefreshingFromContract ? 'Refreshing...' : 'Refresh from Contract'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {selectedDeviceForRestrictions.keyType === 'restricted' && selectedDeviceForRestrictions.callPolicyPermissions && (
                  <>
                    {/* Allowed Target Addresses */}
                    <View style={styles.restrictionsSection}>
                      <Text style={styles.restrictionsSectionTitle}>Allowed Target Addresses</Text>
                      {selectedDeviceForRestrictions.callPolicyPermissions.length > 0 ? (
                        <View style={styles.restrictionsList}>
                          {Array.from(new Set(selectedDeviceForRestrictions.callPolicyPermissions.map(p => p.target))).map((target, index) => (
                            <View key={index} style={styles.restrictionsListItem}>
                              <IconSymbol name="building.2" size={16} color="#10B981" />
                              <Text style={styles.restrictionsListItemText}>{target}</Text>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text style={styles.restrictionsEmpty}>No target addresses configured</Text>
                      )}
                    </View>

                    {/* Detailed Permissions */}
                    <View style={styles.restrictionsSection}>
                      <Text style={styles.restrictionsSectionTitle}>Detailed Permissions</Text>
                      {selectedDeviceForRestrictions.callPolicyPermissions.length > 0 ? (
                        <View style={styles.permissionsList}>
                          {selectedDeviceForRestrictions.callPolicyPermissions.map((permission, index) => {
                            let actionName = 'Unknown Action';
                            let actionDescription = '';
                            
                            if (permission.selector === '0x00000000') {
                              actionName = 'ETH Transfer';
                              actionDescription = 'Send ETH to any address';
                            } else if (permission.selector === '0xa9059cbb') {
                              actionName = 'ERC20 Transfer';
                              actionDescription = 'Send ERC20 tokens to any address';
                            } else if (permission.selector === '0x095ea7b3') {
                              actionName = 'Approve';
                              actionDescription = 'Approve token spending';
                            } else if (permission.selector === '0x7ff36ab5') {
                              actionName = 'Swap';
                              actionDescription = 'Execute token swaps';
                            } else if (permission.selector === '0x379607f5') {
                              actionName = 'Claim Rewards';
                              actionDescription = 'Claim staking rewards';
                            } else if (permission.selector === '0x47e7ef24') {
                              actionName = 'Deposit';
                              actionDescription = 'Deposit tokens to contracts';
                            } else if (permission.selector === '0x2e1a7d4d') {
                              actionName = 'Withdraw';
                              actionDescription = 'Withdraw tokens from contracts';
                            }

                            const decimals = permission.decimals ?? 18;
                            const unitLabel = permission.selector === '0x00000000' ? 'ETH' : permission.selector === '0xa9059cbb' ? (permission.tokenSymbol ?? 'TOKEN') : 'units';
                            const valueLimitDisplay = `${permission.valueLimit} ${unitLabel} (decimals: ${decimals})`;
                            const dailyLimitDisplay = `${permission.dailyLimit} ${unitLabel} (decimals: ${decimals})`;
                            const dailyUsageDisplay = permission.dailyUsage
                              ? `${permission.dailyUsage} ${unitLabel} (decimals: ${decimals})`
                              : null;
                            const callTypeText = permission.callType === 0 ? 'Single Call' : 'Delegate Call';
                            
                            return (
                              <View key={index} style={styles.permissionItem}>
                                <View style={styles.permissionHeader}>
                                  <IconSymbol name="checkmark.circle.fill" size={18} color="#10B981" />
                                  <Text style={styles.permissionTitle}>{actionName}</Text>
                                </View>
                                
                                <View style={styles.permissionDetails}>
                                  <View style={styles.permissionDetailRow}>
                                    <Text style={styles.permissionDetailLabel}>Target Contract:</Text>
                                    <Text style={styles.permissionDetailValue}>{permission.target}</Text>
                                  </View>
                                  
                                  <View style={styles.permissionDetailRow}>
                                    <Text style={styles.permissionDetailLabel}>Function Selector:</Text>
                                    <Text style={styles.permissionDetailValue}>{permission.selector}</Text>
                                  </View>
                                  
                                  <View style={styles.permissionDetailRow}>
                                    <Text style={styles.permissionDetailLabel}>Call Type:</Text>
                                    <Text style={styles.permissionDetailValue}>{callTypeText}</Text>
                                  </View>
                                  
                                  <View style={styles.permissionDetailRow}>
                                    <Text style={styles.permissionDetailLabel}>Max Value per Transaction:</Text>
                                    <Text style={styles.permissionDetailValue}>{valueLimitDisplay}</Text>
                                  </View>
                                  
                                  <View style={styles.permissionDetailRow}>
                                    <Text style={styles.permissionDetailLabel}>Max Value per Day:</Text>
                                    <Text style={styles.permissionDetailValue}>{dailyLimitDisplay}</Text>
                                  </View>
                                  
                                  {dailyUsageDisplay && (
                                    <View style={styles.permissionDetailRow}>
                                      <Text style={styles.permissionDetailLabel}>Today's Usage:</Text>
                                      <Text style={[
                                        styles.permissionDetailValue,
                                        styles.usageNormal
                                      ]}>
                                        {dailyUsageDisplay}
                                      </Text>
                                    </View>
                                  )}
                                  
                                  {permission.rules && permission.rules.length > 0 && (
                                    <View style={styles.permissionDetailRow}>
                                      <Text style={styles.permissionDetailLabel}>Parameter Rules:</Text>
                                      <View style={styles.rulesList}>
                                        {permission.rules.map((rule, ruleIndex) => (
                                          <Text key={ruleIndex} style={styles.ruleText}>
                                            • {rule.condition} at offset {rule.offset}
                                          </Text>
                                        ))}
                                      </View>
                                    </View>
                                  )}
                                  
                                  <View style={styles.permissionDetailRow}>
                                    <Text style={styles.permissionDetailLabel}>Description:</Text>
                                    <Text style={styles.permissionDetailValue}>{actionDescription}</Text>
                                  </View>
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      ) : (
                        <Text style={styles.restrictionsEmpty}>No permissions configured</Text>
                      )}
                    </View>

                    {/* Summary Statistics */}
                    <View style={styles.restrictionsSection}>
                      <Text style={styles.restrictionsSectionTitle}>Summary</Text>
                      <View style={styles.summaryGrid}>
                        <View style={styles.summaryItem}>
                          <Text style={styles.summaryLabel}>Total Permissions</Text>
                          <Text style={styles.summaryValue}>{selectedDeviceForRestrictions.callPolicyPermissions.length}</Text>
                        </View>
                        <View style={styles.summaryItem}>
                          <Text style={styles.summaryLabel}>Unique Targets</Text>
                          <Text style={styles.summaryValue}>
                            {Array.from(new Set(selectedDeviceForRestrictions.callPolicyPermissions.map(p => p.target))).length}
                          </Text>
                        </View>
                        <View style={styles.summaryItem}>
                          <Text style={styles.summaryLabel}>Unique Actions</Text>
                          <Text style={styles.summaryValue}>
                            {Array.from(new Set(selectedDeviceForRestrictions.callPolicyPermissions.map(p => p.selector))).length}
                          </Text>
                        </View>
                        <View style={styles.summaryItem}>
                          <Text style={styles.summaryLabel}>Max Transaction Value</Text>
                          <Text style={styles.summaryValue}>
                            {Math.max(...selectedDeviceForRestrictions.callPolicyPermissions.map(p => parseFloat(p.valueLimit) || 0))} (per action unit)
                          </Text>
                        </View>
                      </View>
                    </View>
                  </>
                )}

                {selectedDeviceForRestrictions.keyType === 'sudo' && (
                  <View style={styles.restrictionsSection}>
                    <Text style={styles.restrictionsSectionTitle}>Sudo Access</Text>
                    <View style={styles.restrictionsItem}>
                      <IconSymbol name="exclamationmark.triangle.fill" size={20} color="#EF4444" />
                      <Text style={styles.restrictionsWarningText}>
                        This delegated key has full access to all wallet functions. No restrictions are applied.
                      </Text>
                    </View>
                  </View>
                )}
              </ScrollView>
            )}
            
            {/* Close Button */}
            <View style={styles.restrictionsModalFooter}>
              <TouchableOpacity
                style={styles.closeModalButton}
                onPress={handleCloseRestrictions}
              >
                <Text style={styles.closeModalButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Debug/Cleanup Section */}
      {(ongoingInstallation || connectedDevices.length > 0) && (
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
      )}
    </SafeAreaView>
    </>
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
  content: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  placeholder: {
    width: 40,
  },
  descriptionContainer: {
    alignItems: 'center',
    marginBottom: 32,
    paddingVertical: 24,
    paddingHorizontal: 16,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333333',
  },
  descriptionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 14,
    color: '#A0A0A0',
    textAlign: 'center',
    lineHeight: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  deviceCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333333',
  },
  deviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  deviceName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusConnected: {
    backgroundColor: '#10B981',
  },
  statusDisconnected: {
    backgroundColor: '#EF4444',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusTextConnected: {
    color: '#FFFFFF',
  },
  statusTextDisconnected: {
    color: '#FFFFFF',
  },
  deviceDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#A0A0A0',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  detailValueFull: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
    fontFamily: 'monospace',
    flex: 1,
    flexWrap: 'wrap',
  },
  keyTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  sudoBadge: {
    backgroundColor: '#EF4444',
  },
  restrictedBadge: {
    backgroundColor: '#10B981',
  },
  keyTypeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sudoText: {
    color: '#FFFFFF',
  },
  restrictedText: {
    color: '#FFFFFF',
  },
  disconnectButton: {
    padding: 8,
    backgroundColor: '#2A1A1A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#A0A0A0',
  },
  createButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1A0A2E',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#8B5CF6',
    gap: 12,
  },
  securityNoticeText: {
    flex: 1,
    fontSize: 14,
    color: '#A0A0A0',
    lineHeight: 20,
  },
  deviceActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
  },
  detailsButton: {
    padding: 8,
    backgroundColor: '#1A0F2E',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#8B5CF6',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#333333',
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    padding: 20,
  },
  deviceInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  modalDeviceName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  progressContainer: {
    marginBottom: 20,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  progressStep: {
    fontSize: 14,
    color: '#8B5CF6',
    fontWeight: '500',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#333333',
    borderRadius: 4,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#8B5CF6',
    borderRadius: 4,
  },
  currentStepContainer: {
    marginBottom: 12,
  },
  currentStepLabel: {
    fontSize: 14,
    color: '#A0A0A0',
    marginBottom: 4,
  },
  currentStepText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  transactionStatusContainer: {
    marginBottom: 12,
  },
  transactionStatusLabel: {
    fontSize: 14,
    color: '#A0A0A0',
    marginBottom: 4,
  },
  transactionStatusText: {
    fontSize: 14,
    color: '#8B5CF6',
    fontWeight: '500',
  },
  nonceContainer: {
    marginBottom: 12,
  },
  nonceLabel: {
    fontSize: 14,
    color: '#A0A0A0',
    marginBottom: 4,
  },
  nonceText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
    fontFamily: 'monospace',
  },
  modalNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#1A0F2E',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#8B5CF6',
  },
  modalNoteText: {
    flex: 1,
    fontSize: 12,
    color: '#A0A0A0',
    lineHeight: 16,
  },
  revokeSection: {
    marginBottom: 20,
  },
  revokeSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  revokeInputContainer: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  revokeInput: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#333333',
    color: '#FFFFFF',
    fontSize: 14,
  },
  revokeButton: {
    backgroundColor: '#EF4444',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  revokeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  revokeButtonDisabled: {
    backgroundColor: '#666666',
    opacity: 0.6,
  },
  revokeAllButton: {
    backgroundColor: '#DC2626',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  revokeAllButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  installationDetailsButton: {
    padding: 8,
    backgroundColor: '#2A1A0A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  detailsContainer: {
    marginBottom: 20,
  },
  addressList: {
    flex: 1,
  },
  tokenLimitsList: {
    flex: 1,
  },
  tokenLimitItem: {
    marginBottom: 4,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  revokeFromDetailsButton: {
    backgroundColor: '#EF4444',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  revokeFromDetailsButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#333333',
    gap: 8,
    flex: 1,
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: 'monospace',
  },
  addressSection: {
    marginBottom: 12,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  shortAddressText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: 'monospace',
  },
  copyButton: {
    padding: 6,
    backgroundColor: '#1A1A1A',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#333333',
  },
  viewFullButton: {
    padding: 6,
    backgroundColor: '#1A1A1A',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#333333',
  },
  viewRestrictionsButton: {
    padding: 6,
    backgroundColor: '#1A1A1A',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#333333',
  },
  dateSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateLabel: {
    fontSize: 14,
    color: '#A0A0A0',
    fontWeight: '500',
  },
  dateValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  fullAddressContainer: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333333',
    marginBottom: 20,
  },
  fullAddressText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'monospace',
    textAlign: 'center',
    lineHeight: 24,
  },
  modalCopyButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#8B5CF6',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#A78BFA',
  },
  copyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  ongoingInstallationCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#8B5CF6',
  },
  ongoingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  ongoingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
  },
  ongoingBadge: {
    backgroundColor: '#8B5CF6',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  ongoingBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  ongoingDetails: {
    marginBottom: 16,
  },
  ongoingDeviceName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  ongoingKeyType: {
    fontSize: 14,
    color: '#8B5CF6',
    marginBottom: 12,
  },
  ongoingProgress: {
    gap: 8,
  },
  ongoingProgressBar: {
    height: 6,
    backgroundColor: '#333333',
    borderRadius: 3,
    overflow: 'hidden',
  },
  ongoingProgressFill: {
    height: '100%',
    backgroundColor: '#8B5CF6',
    borderRadius: 3,
  },
  ongoingProgressText: {
    fontSize: 12,
    color: '#A0A0A0',
    fontWeight: '500',
  },
  viewInstallationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#2A1A2A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#8B5CF6',
  },
  viewInstallationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  debugSection: {
    margin: 16,
    padding: 16,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333333',
  },
  debugSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  debugButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2A1A1A',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#EF4444',
    marginBottom: 8,
  },
  debugButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  clearAllButton: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  clearAllButtonText: {
    color: '#FFFFFF',
  },
  
  // Restrictions Modal Styles
  restrictionsModal: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    margin: 20,
    maxHeight: '80%',
    width: '90%',
    alignSelf: 'center',
  },
  restrictionsModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  restrictionsHeaderButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  refreshFromContractButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#8B5CF6',
    gap: 6,
  },
  refreshFromContractText: {
    color: '#8B5CF6',
    fontSize: 12,
    fontWeight: '500',
  },
  refreshButtonContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#1A1A1A',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#333333',
  },
  restrictionsModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  restrictionsContent: {
    maxHeight: 400,
    padding: 20,
  },
  restrictionsSection: {
    marginBottom: 24,
  },
  restrictionsSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  restrictionsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  restrictionsLabel: {
    fontSize: 14,
    color: '#CCCCCC',
    fontWeight: '500',
    minWidth: 120,
  },
  restrictionsValue: {
    fontSize: 14,
    color: '#FFFFFF',
    flex: 1,
  },
  restrictionsList: {
    gap: 8,
  },
  restrictionsListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#0F0F0F',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
    gap: 8,
  },
  restrictionsListItemText: {
    fontSize: 14,
    color: '#FFFFFF',
    flex: 1,
  },
  restrictionsSelectorText: {
    fontSize: 12,
    color: '#666666',
    fontFamily: 'monospace',
  },
  restrictionsEmpty: {
    fontSize: 14,
    color: '#666666',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20,
  },
  restrictionsWarningText: {
    fontSize: 14,
    color: '#EF4444',
    marginLeft: 8,
    flex: 1,
  },
  
  // Enhanced Permission Styles
  permissionsList: {
    gap: 16,
  },
  permissionItem: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333333',
  },
  permissionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  permissionDetails: {
    gap: 8,
  },
  permissionDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  permissionDetailLabel: {
    fontSize: 13,
    color: '#CCCCCC',
    fontWeight: '500',
    minWidth: 140,
    marginRight: 8,
  },
  permissionDetailValue: {
    fontSize: 13,
    color: '#FFFFFF',
    flex: 1,
    fontFamily: 'monospace',
  },
  usageNormal: {
    color: '#10B981', // Green for normal usage
  },
  usageExceeded: {
    color: '#EF4444', // Red for exceeded usage
    fontWeight: 'bold',
  },
  rulesList: {
    marginTop: 4,
    marginLeft: 8,
  },
  ruleText: {
    fontSize: 12,
    color: '#A0A0A0',
    marginBottom: 2,
  },
  
  // Summary Grid Styles
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  summaryItem: {
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    padding: 12,
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#CCCCCC',
    marginBottom: 4,
    textAlign: 'center',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
    textAlign: 'center',
  },
  
  // Modal Footer Styles
  restrictionsModalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#333333',
    backgroundColor: '#1A1A1A',
  },
  closeModalButton: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeModalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
