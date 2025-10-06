import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, TextInput, Modal } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { apiClient } from '@/utils/apiClient';
import { KeyType, TokenLimit, DelegatedKeyData, saveDelegatedKey, updateDelegatedKey } from '@/utils/delegatedKeys';
import { useSmartWatch } from '@/hooks/useSmartWatch';
import { WatchKeyPair, WatchPermissionData } from '@/utils/smartWatchBridge';
import { getKernelAddress } from '@/utils/config';

export default function CreateDelegatedKeyScreen() {
  const [keyType, setKeyType] = useState<KeyType>('restricted');
  const [deviceName, setDeviceName] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [showSudoWarning, setShowSudoWarning] = useState(false);
  const [showRestrictedSettings, setShowRestrictedSettings] = useState(false);
  const [generatedKeyPair, setGeneratedKeyPair] = useState<WatchKeyPair | null>(null);
  const [showAddressConfirmation, setShowAddressConfirmation] = useState(false);
  const [pendingKeyPair, setPendingKeyPair] = useState<WatchKeyPair | null>(null);
  const [blockchainStep, setBlockchainStep] = useState<string>('');
  const [currentNonce, setCurrentNonce] = useState<string>('0');
  const [transactionStatus, setTransactionStatus] = useState<string>('');
  const [isAborting, setIsAborting] = useState(false);
  
  // Smart watch integration
  const { 
    isConnected: isWatchConnected, 
    isLoading: isWatchLoading, 
    error: watchError,
    requestKeyGeneration,
    syncPermissionData,
    checkConnection,
    clearError
  } = useSmartWatch();
  
  // Restricted key settings
  const [allowEveryone, setAllowEveryone] = useState(true);
  const [whitelistAddresses, setWhitelistAddresses] = useState<string[]>([]);
  const [newAddress, setNewAddress] = useState('');
  const [tokenLimits, setTokenLimits] = useState<TokenLimit[]>([
    { tokenAddress: '0x0000000000000000000000000000000000000000', tokenSymbol: 'ETH', maxAmountPerDay: '0.1', maxAmountPerTx: '0.01' }
  ]);
  const [newTokenAddress, setNewTokenAddress] = useState('');
  const [newTokenSymbol, setNewTokenSymbol] = useState('');
  const [newTokenMaxDay, setNewTokenMaxDay] = useState('');
  const [newTokenMaxTx, setNewTokenMaxTx] = useState('');

  const handleKeyTypeSelect = (type: KeyType) => {
    if (type === 'sudo') {
      setShowSudoWarning(true);
    } else {
      setKeyType(type);
      setShowRestrictedSettings(true);
    }
  };

  const handleSudoWarningConfirm = () => {
    setKeyType('sudo');
    setShowSudoWarning(false);
  };

  const handleSudoWarningCancel = () => {
    setShowSudoWarning(false);
  };

  const handleAddressConfirmation = async (confirmed: boolean) => {
    if (confirmed && pendingKeyPair) {
      // User confirmed the address, save the device immediately with "installing" status
      const deviceId = Date.now().toString();
      const initialDeviceData: DelegatedKeyData = {
        id: deviceId,
        deviceName: deviceName.trim(),
        keyType,
        permissionId: '', // Will be filled during blockchain operations
        vId: '', // Will be filled during blockchain operations
        publicAddress: pendingKeyPair.address,
        createdAt: new Date().toISOString(),
        installationStatus: 'installing',
        installationProgress: {
          currentStep: 'Initializing blockchain operations...',
          totalSteps: keyType === 'sudo' ? 3 : 4, // sudo: install, grant, save | restricted: install, enable, grant, save
          completedSteps: 0,
        },
        ...(keyType === 'restricted' && {
          whitelistAddresses: allowEveryone ? [] : whitelistAddresses,
          tokenLimits,
          allowEveryone
        })
      };

      // Save the device immediately
      await saveDelegatedKey(initialDeviceData);
      
      // Update states
      setGeneratedKeyPair(pendingKeyPair);
      setShowAddressConfirmation(false);
      setPendingKeyPair(null);
      
      // Continue with blockchain operations
      continueWithBlockchainOperations(pendingKeyPair, deviceId);
    } else {
      // User rejected the address, cancel the process
      setShowAddressConfirmation(false);
      setPendingKeyPair(null);
      setIsConnecting(false);
    }
  };

  const addWhitelistAddress = () => {
    if (newAddress && newAddress.startsWith('0x') && newAddress.length === 42) {
      setWhitelistAddresses(prev => [...prev, newAddress]);
      setNewAddress('');
    } else {
      Alert.alert('Error', 'Please enter a valid Ethereum address');
    }
  };

  const removeWhitelistAddress = (index: number) => {
    setWhitelistAddresses(prev => prev.filter((_, i) => i !== index));
  };

  const addTokenLimit = () => {
    if (newTokenAddress && newTokenSymbol && newTokenMaxDay && newTokenMaxTx) {
      setTokenLimits(prev => [...prev, {
        tokenAddress: newTokenAddress,
        tokenSymbol: newTokenSymbol,
        maxAmountPerDay: newTokenMaxDay,
        maxAmountPerTx: newTokenMaxTx
      }]);
      setNewTokenAddress('');
      setNewTokenSymbol('');
      setNewTokenMaxDay('');
      setNewTokenMaxTx('');
    } else {
      Alert.alert('Error', 'Please fill in all token limit fields');
    }
  };

  const removeTokenLimit = (index: number) => {
    setTokenLimits(prev => prev.filter((_, i) => i !== index));
  };

  const handleCancelOperation = () => {
    setIsAborting(true);
    setBlockchainStep('Cancelling operation...');
    setTransactionStatus('Operation cancelled by user');
    setIsConnecting(false);
    // Reset states
    setTimeout(() => {
      setBlockchainStep('');
      setTransactionStatus('');
      setCurrentNonce('0');
      setIsAborting(false);
    }, 2000);
  };

  const continueWithBlockchainOperations = async (keyPair: WatchKeyPair, deviceId: string) => {
    try {
      // Step 2: Use the generated public key to create delegated access on blockchain
      setBlockchainStep('Initializing blockchain operations...');
      console.log('Step 2: Creating delegated access on blockchain...');
      const delegatedEOA = keyPair.address as `0x${string}`;
      let permissionId: string;
      let vId: string;

      // Helper function to update device progress
      const updateDeviceProgress = async (progress: Partial<DelegatedKeyData['installationProgress']>) => {
        await updateDelegatedKey(deviceId, {
          installationProgress: {
            currentStep: progress?.currentStep || '',
            totalSteps: progress?.totalSteps || 0,
            completedSteps: progress?.completedSteps || 0,
            transactionStatus: progress?.transactionStatus,
            currentNonce: progress?.currentNonce,
          }
        });
      };
      
      if (keyType === 'sudo') {
        setBlockchainStep('Setting up sudo access permissions...');
        await updateDeviceProgress({ currentStep: 'Setting up sudo access permissions...', completedSteps: 0 });
        
        const rootNonceBefore = await apiClient.getRootNonce();
        setCurrentNonce(rootNonceBefore.nonce);
        setTransactionStatus(`Root nonce before: ${rootNonceBefore.nonce}`);
        console.log('[ReactNative] -> Root nonce before:', rootNonceBefore.nonce);

        // For sudo access: Install permission validation and grant access
        setBlockchainStep('Installing permission validation...');
        await updateDeviceProgress({ currentStep: 'Installing permission validation...', completedSteps: 0 });
        console.log('Installing permission validation for sudo access...');
        const installResult = await apiClient.installPermission(delegatedEOA);
        permissionId = installResult.permissionId;
        vId = installResult.vId;
        console.log('Permission ID:', permissionId, 'vId:', vId);
        
        // Send install permission user operation
        setTransactionStatus('Sending install permission transaction...');
        await updateDeviceProgress({ 
          currentStep: 'Sending install permission transaction...', 
          transactionStatus: 'Sending transaction...',
          completedSteps: 0 
        });
        const installTxHash = installResult.txHash;
        console.log('Install permission tx:', installTxHash);
        setTransactionStatus(`Install tx sent: ${installTxHash.slice(0, 10)}...`);
        
        // Wait for transaction to be processed with timeout
        setBlockchainStep('Waiting for install transaction to be mined...');
        await updateDeviceProgress({ 
          currentStep: 'Waiting for install transaction to be mined...', 
          transactionStatus: `Install tx sent: ${installTxHash.slice(0, 10)}...`,
          completedSteps: 0 
        });
        let rootNonceAfterInstall = await apiClient.getRootNonce();
        setCurrentNonce(rootNonceAfterInstall.nonce);
        console.log('[ReactNative] -> Root nonce after install:', rootNonceAfterInstall.nonce);
        
        // Add timeout mechanism (max 5 minutes)
        const maxWaitTime = 5 * 60 * 1000; // 5 minutes in milliseconds
        const startTime = Date.now();
        let attempts = 0;
        
        while (BigInt(rootNonceAfterInstall.nonce) <= BigInt(rootNonceBefore.nonce)) {
            attempts++;
            const elapsedTime = Date.now() - startTime;
            
            if (elapsedTime > maxWaitTime) {
                throw new Error(`Transaction timeout: Install transaction not confirmed after 5 minutes. Current nonce: ${rootNonceAfterInstall.nonce}`);
            }
            
            setTransactionStatus(`Waiting for nonce update... (attempt ${attempts}, elapsed: ${Math.round(elapsedTime/1000)}s, current: ${rootNonceAfterInstall.nonce})`);
            await updateDeviceProgress({ 
              currentStep: 'Waiting for install transaction to be mined...', 
              transactionStatus: `Waiting for nonce update... (attempt ${attempts}, elapsed: ${Math.round(elapsedTime/1000)}s)`,
              currentNonce: rootNonceAfterInstall.nonce,
              completedSteps: 0 
            });
            console.log(`[ReactNative] -> Waiting for nonce update, attempt ${attempts}, current nonce: ${rootNonceAfterInstall.nonce}`);
            
            await new Promise(r => setTimeout(r, 10000)) // Increased to 10 seconds
            rootNonceAfterInstall = await apiClient.getRootNonce();
            setCurrentNonce(rootNonceAfterInstall.nonce);
        }
        setTransactionStatus('Install transaction confirmed!');
        await updateDeviceProgress({ 
          currentStep: 'Install transaction confirmed!', 
          transactionStatus: 'Install transaction confirmed!',
          completedSteps: 1 
        });
        
        // Grant access
        setBlockchainStep('Granting access to execute selector...');
        await updateDeviceProgress({ 
          currentStep: 'Granting access to execute selector...', 
          transactionStatus: 'Install transaction confirmed!',
          completedSteps: 1 
        });
        console.log('Granting access to execute selector...');
        const grantResult = await apiClient.grantAccess(vId);
        
        // Send grant access user operation
        setTransactionStatus('Sending grant access transaction...');
        await updateDeviceProgress({ 
          currentStep: 'Sending grant access transaction...', 
          transactionStatus: 'Sending grant transaction...',
          completedSteps: 1 
        });
        const grantTxHash = grantResult.txHash;
        console.log('Grant access tx:', grantTxHash);
        setTransactionStatus(`Grant tx sent: ${grantTxHash.slice(0, 10)}...`);

        // Wait for transaction to be processed with timeout
        setBlockchainStep('Waiting for grant transaction to be mined...');
        await updateDeviceProgress({ 
          currentStep: 'Waiting for grant transaction to be mined...', 
          transactionStatus: `Grant tx sent: ${grantTxHash.slice(0, 10)}...`,
          completedSteps: 1 
        });
        let rootNonceAfterGrant = await apiClient.getRootNonce();
        setCurrentNonce(rootNonceAfterGrant.nonce);
        console.log('[ReactNative] -> Root nonce after grant:', rootNonceAfterGrant.nonce);
        
        // Add timeout mechanism (max 5 minutes)
        const grantMaxWaitTime = 5 * 60 * 1000; // 5 minutes in milliseconds
        const grantStartTime = Date.now();
        let grantAttempts = 0;
        
        while (BigInt(rootNonceAfterGrant.nonce) <= BigInt(rootNonceAfterInstall.nonce)) {
            grantAttempts++;
            const grantElapsedTime = Date.now() - grantStartTime;
            
            if (grantElapsedTime > grantMaxWaitTime) {
                throw new Error(`Transaction timeout: Grant transaction not confirmed after 5 minutes. Current nonce: ${rootNonceAfterGrant.nonce}`);
            }
            
            setTransactionStatus(`Waiting for nonce update... (attempt ${grantAttempts}, elapsed: ${Math.round(grantElapsedTime/1000)}s, current: ${rootNonceAfterGrant.nonce})`);
            await updateDeviceProgress({ 
              currentStep: 'Waiting for grant transaction to be mined...', 
              transactionStatus: `Waiting for nonce update... (attempt ${grantAttempts}, elapsed: ${Math.round(grantElapsedTime/1000)}s)`,
              currentNonce: rootNonceAfterGrant.nonce,
              completedSteps: 1 
            });
            console.log(`[ReactNative] -> Waiting for grant nonce update, attempt ${grantAttempts}, current nonce: ${rootNonceAfterGrant.nonce}`);
            
            await new Promise(r => setTimeout(r, 10000)) // Increased to 10 seconds
            rootNonceAfterGrant = await apiClient.getRootNonce();
            setCurrentNonce(rootNonceAfterGrant.nonce);
        }
        setTransactionStatus('Grant transaction confirmed!');
        await updateDeviceProgress({ 
          currentStep: 'Grant transaction confirmed!', 
          transactionStatus: 'Grant transaction confirmed!',
          completedSteps: 2 
        });
        
        setBlockchainStep('Sudo delegated key created successfully!');
        await updateDeviceProgress({ 
          currentStep: 'Sudo delegated key created successfully!', 
          transactionStatus: 'Installation completed successfully!',
          completedSteps: 3 
        });
        console.log('Sudo delegated key created successfully!');
        
        // Update device with final data
        await updateDelegatedKey(deviceId, {
          permissionId,
          vId,
          installationStatus: 'completed',
          installationProgress: {
            currentStep: 'Installation completed successfully!',
            totalSteps: 3,
            completedSteps: 3,
            transactionStatus: 'Installation completed successfully!',
          }
        });
        
      } else {
        // For restricted access: Same flow but with restrictions
        setBlockchainStep('Setting up restricted access permissions...');
        console.log('Creating restricted delegated key...');
        console.log('Whitelist addresses:', whitelistAddresses);
        console.log('Token limits:', tokenLimits);
        console.log('Allow everyone:', allowEveryone);
        
        const rootNonceBefore = await apiClient.getRootNonce();
        setCurrentNonce(rootNonceBefore.nonce);
        setTransactionStatus(`Root nonce before: ${rootNonceBefore.nonce}`);
        console.log('[ReactNative] -> Root nonce before:', rootNonceBefore.nonce);
        
        // Install permission
        setBlockchainStep('Installing permission validation...');
        const installResult = await apiClient.installPermission(delegatedEOA);
        permissionId = installResult.permissionId;
        vId = installResult.vId;
        
        setTransactionStatus('Sending install permission transaction...');
        const installTxHash = installResult.txHash;
        console.log('[ReactNative] -> Install permission tx:', installTxHash);
        setTransactionStatus(`Install tx sent: ${installTxHash.slice(0, 10)}...`);

        // Wait for install transaction with timeout
        setBlockchainStep('Waiting for install transaction to be mined...');
        let rootNonceAfterInstall = await apiClient.getRootNonce();
        setCurrentNonce(rootNonceAfterInstall.nonce);
        console.log('[ReactNative] -> Root nonce after install:', rootNonceAfterInstall.nonce);

        // Add timeout mechanism (max 5 minutes)
        const installMaxWaitTime = 5 * 60 * 1000; // 5 minutes in milliseconds
        const installStartTime = Date.now();
        let installAttempts = 0;

        while (BigInt(rootNonceAfterInstall.nonce) <= BigInt(rootNonceBefore.nonce)) {
            installAttempts++;
            const installElapsedTime = Date.now() - installStartTime;
            
            if (installElapsedTime > installMaxWaitTime) {
                throw new Error(`Transaction timeout: Install transaction not confirmed after 5 minutes. Current nonce: ${rootNonceAfterInstall.nonce}`);
            }
            
            setTransactionStatus(`Waiting for nonce update... (attempt ${installAttempts}, elapsed: ${Math.round(installElapsedTime/1000)}s, current: ${rootNonceAfterInstall.nonce})`);
            console.log(`[ReactNative] -> Waiting for install nonce update, attempt ${installAttempts}, current nonce: ${rootNonceAfterInstall.nonce}`);
            
            await new Promise(r => setTimeout(r, 10000)) // Increased to 10 seconds
            rootNonceAfterInstall = await apiClient.getRootNonce();
            setCurrentNonce(rootNonceAfterInstall.nonce);
        }
        setTransactionStatus('Install transaction confirmed!');
        
        // Enable selector
        setBlockchainStep('Enabling selector for restricted access...');
        const enableResult = await apiClient.enableSelector(permissionId, vId, delegatedEOA);
        
        setTransactionStatus('Sending enable selector transaction...');
        const enableTxHash = enableResult.txHash;
        console.log('[ReactNative] -> Enable selector tx:', enableTxHash);
        setTransactionStatus(`Enable tx sent: ${enableTxHash.slice(0, 10)}...`);

        // Wait for enable transaction with timeout
        setBlockchainStep('Waiting for enable transaction to be mined...');
        let rootNonceAfterEnable = await apiClient.getRootNonce();
        setCurrentNonce(rootNonceAfterEnable.nonce);
        
        // Add timeout mechanism (max 5 minutes)
        const enableMaxWaitTime = 5 * 60 * 1000; // 5 minutes in milliseconds
        const enableStartTime = Date.now();
        let enableAttempts = 0;
        
        while (BigInt(rootNonceAfterEnable.nonce) <= BigInt(rootNonceAfterInstall.nonce)) {
            enableAttempts++;
            const enableElapsedTime = Date.now() - enableStartTime;
            
            if (enableElapsedTime > enableMaxWaitTime) {
                throw new Error(`Transaction timeout: Enable transaction not confirmed after 5 minutes. Current nonce: ${rootNonceAfterEnable.nonce}`);
            }
            
            setTransactionStatus(`Waiting for nonce update... (attempt ${enableAttempts}, elapsed: ${Math.round(enableElapsedTime/1000)}s, current: ${rootNonceAfterEnable.nonce})`);
            console.log(`[ReactNative] -> Waiting for enable nonce update, attempt ${enableAttempts}, current nonce: ${rootNonceAfterEnable.nonce}`);
            
            await new Promise(r => setTimeout(r, 10000)) // Increased to 10 seconds
            rootNonceAfterEnable = await apiClient.getRootNonce();
            setCurrentNonce(rootNonceAfterEnable.nonce);
        }
        setTransactionStatus('Enable transaction confirmed!');
        
        // Grant access
        setBlockchainStep('Granting access to execute selector...');
        const grantResult = await apiClient.grantAccess(vId);
        
        setTransactionStatus('Sending grant access transaction...');
        const grantTxHash = grantResult.txHash;
        setTransactionStatus(`Grant tx sent: ${grantTxHash.slice(0, 10)}...`);
        
        // Wait for grant transaction with timeout
        setBlockchainStep('Waiting for grant transaction to be mined...');
        let rootNonceAfterGrant = await apiClient.getRootNonce();
        setCurrentNonce(rootNonceAfterGrant.nonce);
        
        // Add timeout mechanism (max 5 minutes)
        const finalGrantMaxWaitTime = 5 * 60 * 1000; // 5 minutes in milliseconds
        const finalGrantStartTime = Date.now();
        let finalGrantAttempts = 0;
        
        while (BigInt(rootNonceAfterGrant.nonce) <= BigInt(rootNonceAfterEnable.nonce)) {
            finalGrantAttempts++;
            const finalGrantElapsedTime = Date.now() - finalGrantStartTime;
            
            if (finalGrantElapsedTime > finalGrantMaxWaitTime) {
                throw new Error(`Transaction timeout: Grant transaction not confirmed after 5 minutes. Current nonce: ${rootNonceAfterGrant.nonce}`);
            }
            
            setTransactionStatus(`Waiting for nonce update... (attempt ${finalGrantAttempts}, elapsed: ${Math.round(finalGrantElapsedTime/1000)}s, current: ${rootNonceAfterGrant.nonce})`);
            console.log(`[ReactNative] -> Waiting for final grant nonce update, attempt ${finalGrantAttempts}, current nonce: ${rootNonceAfterGrant.nonce}`);
            
            await new Promise(r => setTimeout(r, 10000)) // Increased to 10 seconds
            rootNonceAfterGrant = await apiClient.getRootNonce();
            setCurrentNonce(rootNonceAfterGrant.nonce);
        }
        setTransactionStatus('Grant transaction confirmed!');
        setBlockchainStep('Restricted delegated key created successfully!');
        
        console.log('Restricted delegated key created successfully!');
        console.log('Note: Custom validation logic needs to be implemented for restrictions');
      }

      // Step 3: Save delegated key data to AsyncStorage
      setBlockchainStep('Saving delegated key data...');
      setTransactionStatus('Storing key data locally...');
      console.log('Step 3: Saving delegated key data...');
      const delegatedKeyData: DelegatedKeyData = {
        id: Date.now().toString(),
        deviceName: deviceName.trim(),
        keyType,
        permissionId,
        vId,
        publicAddress: keyPair.address,
        createdAt: new Date().toISOString(),
        ...(keyType === 'restricted' && {
          whitelistAddresses: allowEveryone ? [] : whitelistAddresses,
          tokenLimits,
          allowEveryone
        })
      };

      await saveDelegatedKey(delegatedKeyData);
      setTransactionStatus('Key data saved locally!');
      
      // Step 4: Send permission data to smart watch for storage
      setBlockchainStep('Syncing permission data to smart watch...');
      setTransactionStatus('Sending data to Apple Watch...');
      console.log('Step 4: Syncing permission data to smart watch...');
      const watchPermissionData: WatchPermissionData = {
        permissionId,
        vId,
        deviceName: deviceName.trim(),
        keyType,
        createdAt: delegatedKeyData.createdAt
      };

      await syncPermissionData(watchPermissionData);
      setTransactionStatus('Permission data synced to watch!');
      setBlockchainStep('Setup complete!');
      console.log('Permission data synced to smart watch successfully!');
      
      Alert.alert(
        'Success!',
        `Delegated key created successfully for ${deviceName}.\n\nKey Type: ${keyType === 'sudo' ? 'Sudo Access' : 'Restricted Access'}\nPublic Key: ${keyPair.address.slice(0, 10)}...\nPermission ID: ${permissionId.slice(0, 10)}...\nvId: ${vId.slice(0, 10)}...\n\nYour smart watch can now perform transactions on your behalf.`,
        [
          {
            text: 'OK',
            onPress: () => router.back()
          }
        ]
      );
    } catch (error) {
      console.error('Error in blockchain operations:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Mark installation as failed if we have a device ID
      if (deviceId) {
        try {
          await updateDelegatedKey(deviceId, {
            installationStatus: 'failed',
            installationProgress: {
              currentStep: 'Installation failed',
              totalSteps: keyType === 'sudo' ? 3 : 4,
              completedSteps: 0,
              transactionStatus: errorMessage,
            }
          });
        } catch (updateError) {
          console.error('Error updating device status:', updateError);
        }
      }
      
      Alert.alert(
        'Error', 
        `Failed to create delegated key: ${errorMessage}\n\nPlease try again.`
      );
    } finally {
      setIsConnecting(false);
    }
  };

  const handleCreateKey = async () => {
    if (!deviceName.trim()) {
      Alert.alert('Error', 'Please enter a device name');
      return;
    }

    if (!isWatchConnected) {
      Alert.alert('Error', 'Smart watch is not connected. Please ensure your Apple Watch is connected and try again.');
      return;
    }

    setIsConnecting(true);
    clearError();

    try {
      console.log('Starting delegated key creation process...');
      console.log('Device name:', deviceName);
      console.log('Key type:', keyType);
      console.log('Watch connected:', isWatchConnected);

      // Step 1: Request key generation from smart watch
      console.log('Step 1: Requesting key generation from smart watch...');
      let kernelAddress = getKernelAddress();
      
      // Temporary fallback for debugging
      if (!kernelAddress) {
        console.log('[create-key] -> KERNEL not found in config, using fallback');
        kernelAddress = '0xB115dc375D7Ad88D7c7a2180D0E548Cb5B83D86A';
      }

      console.log('[create-key] -> kernelAddress:', kernelAddress);
      const keyPair = await requestKeyGeneration({ kernelAddress });
      
      console.log('Key pair generated on smart watch:');
      console.log('Public Key:', keyPair.address);
      console.log('Address:', keyPair.address);
      
      // Show address confirmation modal
      setPendingKeyPair(keyPair);
      setShowAddressConfirmation(true);
      
    } catch (error) {
      console.error('Error generating key pair:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      Alert.alert(
        'Error', 
        `Failed to generate key pair: ${errorMessage}\n\nPlease try again.`
      );
      setIsConnecting(false);
    }
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
              <Text style={styles.title}>Create Delegated Key</Text>
              <View style={styles.placeholder} />
            </View>

            {/* Smart Watch Connection Status */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Smart Watch Connection</Text>
              <View style={[
                styles.connectionStatus,
                isWatchConnected ? styles.connectionStatusConnected : styles.connectionStatusDisconnected
              ]}>
                <IconSymbol 
                  name={isWatchConnected ? "checkmark.circle.fill" : "xmark.circle.fill"} 
                  size={20} 
                  color={isWatchConnected ? "#10B981" : "#EF4444"} 
                />
                <View style={styles.connectionInfo}>
                  <Text style={[
                    styles.connectionStatusText,
                    isWatchConnected ? styles.connectionStatusTextConnected : styles.connectionStatusTextDisconnected
                  ]}>
                    {isWatchConnected ? 'Connected to Apple Watch' : 'Apple Watch Not Connected'}
                  </Text>
                  {isWatchLoading && (
                    <Text style={styles.connectionSubtext}>Checking connection...</Text>
                  )}
                  {!isWatchConnected && !isWatchLoading && (
                    <Text style={styles.connectionSubtext}>
                      Ensure your Apple Watch is paired and the Dejest app is installed
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.refreshButton}
                  onPress={checkConnection}
                  disabled={isWatchLoading}
                >
                  <IconSymbol 
                    name={isWatchLoading ? "arrow.clockwise" : "arrow.clockwise"} 
                    size={16} 
                    color="#8B5CF6" 
                  />
                </TouchableOpacity>
              </View>
              
              {watchError && (
                <View style={styles.errorContainer}>
                  <IconSymbol name="exclamationmark.triangle.fill" size={16} color="#EF4444" />
                  <Text style={styles.errorText}>{watchError}</Text>
                </View>
              )}

              {!isWatchConnected && !isWatchLoading && (
                <View style={styles.warningContainer}>
                  <IconSymbol name="exclamationmark.triangle.fill" size={20} color="#F59E0B" />
                  <View style={styles.warningContent}>
                    <Text style={styles.warningSectionTitle}>Smart Watch Required</Text>
                    <Text style={styles.warningText}>
                      You need a connected Apple Watch to create delegated keys. The watch will generate and securely store the private keys.
                    </Text>
                    <Text style={styles.warningSteps}>
                      Steps to connect:
                    </Text>
                    <Text style={styles.warningStep}>1. Ensure your Apple Watch is paired with this iPhone</Text>
                    <Text style={styles.warningStep}>2. Install the Dejest app on your Apple Watch</Text>
                    <Text style={styles.warningStep}>3. Open the Dejest app on your watch</Text>
                    <Text style={styles.warningStep}>4. Tap "Refresh" above to check connection</Text>
                  </View>
                </View>
              )}
            </View>

            {/* Device Name */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Device Name</Text>
              <TextInput
                style={[
                  styles.input,
                  !isWatchConnected && styles.inputDisabled
                ]}
                placeholder={isWatchConnected ? "Enter device name (e.g., Apple Watch Series 9)" : "Connect Apple Watch first"}
                placeholderTextColor={isWatchConnected ? "#666666" : "#444444"}
                value={deviceName}
                onChangeText={setDeviceName}
                editable={isWatchConnected}
              />
            </View>

            {/* Key Type Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Key Type</Text>
              <Text style={styles.sectionSubtitle}>
                {isWatchConnected ? 'Choose the level of access for your smart watch' : 'Connect Apple Watch to configure key type'}
              </Text>
              
              <View style={[
                styles.keyTypeContainer,
                !isWatchConnected && styles.keyTypeContainerDisabled
              ]}>
                <TouchableOpacity
                  style={[
                    styles.keyTypeOption,
                    keyType === 'restricted' && styles.keyTypeOptionSelected,
                    !isWatchConnected && styles.keyTypeOptionDisabled
                  ]}
                  onPress={() => isWatchConnected && handleKeyTypeSelect('restricted')}
                  disabled={!isWatchConnected}
                >
                  <View style={styles.keyTypeHeader}>
                    <IconSymbol 
                      name="lock.shield.fill" 
                      size={24} 
                      color={keyType === 'restricted' ? '#10B981' : '#A0A0A0'} 
                    />
                    <Text style={[
                      styles.keyTypeTitle,
                      keyType === 'restricted' && styles.keyTypeTitleSelected
                    ]}>
                      Restricted Access
                    </Text>
                  </View>
                  <Text style={styles.keyTypeDescription}>
                    Limited permissions with whitelist and spending limits
                  </Text>
                  <View style={[
                    styles.recommendedBadge,
                    keyType === 'restricted' && styles.recommendedBadgeSelected
                  ]}>
                    <Text style={[
                      styles.recommendedText,
                      keyType === 'restricted' && styles.recommendedTextSelected
                    ]}>
                      Recommended
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.keyTypeOption,
                    keyType === 'sudo' && styles.keyTypeOptionSelected,
                    !isWatchConnected && styles.keyTypeOptionDisabled
                  ]}
                  onPress={() => isWatchConnected && handleKeyTypeSelect('sudo')}
                  disabled={!isWatchConnected}
                >
                  <View style={styles.keyTypeHeader}>
                    <IconSymbol 
                      name="key.fill" 
                      size={24} 
                      color={keyType === 'sudo' ? '#EF4444' : '#A0A0A0'} 
                    />
                    <Text style={[
                      styles.keyTypeTitle,
                      keyType === 'sudo' && styles.keyTypeTitleSelected
                    ]}>
                      Sudo Access
                    </Text>
                  </View>
                  <Text style={styles.keyTypeDescription}>
                    Full access to all wallet functions
                  </Text>
                  <View style={[
                    styles.warningBadge,
                    keyType === 'sudo' && styles.warningBadgeSelected
                  ]}>
                    <Text style={[
                      styles.warningBadgeText,
                      keyType === 'sudo' && styles.warningTextSelected
                    ]}>
                      Not Recommended
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* Restricted Settings */}
            {keyType === 'restricted' && isWatchConnected && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Restriction Settings</Text>
                
                {/* Recipient Whitelist */}
                <View style={styles.subsection}>
                  <Text style={styles.subsectionTitle}>Recipient Whitelist</Text>
                  <View style={styles.whitelistToggle}>
                    <TouchableOpacity
                      style={[
                        styles.toggleOption,
                        allowEveryone && styles.toggleOptionSelected
                      ]}
                      onPress={() => setAllowEveryone(true)}
                    >
                      <Text style={[
                        styles.toggleText,
                        allowEveryone && styles.toggleTextSelected
                      ]}>
                        Allow Everyone
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.toggleOption,
                        !allowEveryone && styles.toggleOptionSelected
                      ]}
                      onPress={() => setAllowEveryone(false)}
                    >
                      <Text style={[
                        styles.toggleText,
                        !allowEveryone && styles.toggleTextSelected
                      ]}>
                        Whitelist Only
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {!allowEveryone && (
                    <View style={styles.whitelistContainer}>
                      <View style={styles.addAddressContainer}>
                        <TextInput
                          style={styles.addressInput}
                          placeholder="0x..."
                          placeholderTextColor="#666666"
                          value={newAddress}
                          onChangeText={setNewAddress}
                        />
                        <TouchableOpacity
                          style={styles.addButton}
                          onPress={addWhitelistAddress}
                        >
                          <IconSymbol name="plus" size={16} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                      
                      {whitelistAddresses.map((address, index) => (
                        <View key={index} style={styles.addressItem}>
                          <Text style={styles.addressText}>{address}</Text>
                          <TouchableOpacity
                            style={styles.removeButton}
                            onPress={() => removeWhitelistAddress(index)}
                          >
                            <IconSymbol name="xmark" size={16} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {/* Token Limits */}
                <View style={styles.subsection}>
                  <Text style={styles.subsectionTitle}>Token Spending Limits</Text>
                  
                  {tokenLimits.map((token, index) => (
                    <View key={index} style={styles.tokenLimitItem}>
                      <View style={styles.tokenInfo}>
                        <Text style={styles.tokenSymbol}>{token.tokenSymbol}</Text>
                        <Text style={styles.tokenAddress}>{token.tokenAddress.slice(0, 10)}...</Text>
                      </View>
                      <View style={styles.limitInfo}>
                        <Text style={styles.limitText}>Max/Day: {token.maxAmountPerDay}</Text>
                        <Text style={styles.limitText}>Max/Tx: {token.maxAmountPerTx}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => removeTokenLimit(index)}
                      >
                        <IconSymbol name="xmark" size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ))}

                  <View style={styles.addTokenContainer}>
                    <TextInput
                      style={styles.tokenInput}
                      placeholder="Token Address"
                      placeholderTextColor="#666666"
                      value={newTokenAddress}
                      onChangeText={setNewTokenAddress}
                    />
                    <TextInput
                      style={styles.tokenInput}
                      placeholder="Symbol"
                      placeholderTextColor="#666666"
                      value={newTokenSymbol}
                      onChangeText={setNewTokenSymbol}
                    />
                    <TextInput
                      style={styles.tokenInput}
                      placeholder="Max/Day"
                      placeholderTextColor="#666666"
                      value={newTokenMaxDay}
                      onChangeText={setNewTokenMaxDay}
                      keyboardType="decimal-pad"
                    />
                    <TextInput
                      style={styles.tokenInput}
                      placeholder="Max/Tx"
                      placeholderTextColor="#666666"
                      value={newTokenMaxTx}
                      onChangeText={setNewTokenMaxTx}
                      keyboardType="decimal-pad"
                    />
                    <TouchableOpacity
                      style={styles.addButton}
                      onPress={addTokenLimit}
                    >
                      <IconSymbol name="plus" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {/* Blockchain Progress Section */}
            {isConnecting && (blockchainStep || transactionStatus) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Blockchain Operations</Text>
                
                <View style={styles.progressContainer}>
                  <View style={styles.progressHeader}>
                    <IconSymbol 
                      name="arrow.clockwise" 
                      size={20} 
                      color="#8B5CF6" 
                    />
                    <Text style={styles.progressTitle}>Processing...</Text>
                  </View>
                  
                  {blockchainStep && (
                    <View style={styles.progressStep}>
                      <Text style={styles.progressStepLabel}>Current Step:</Text>
                      <Text style={styles.progressStepText}>{blockchainStep}</Text>
                    </View>
                  )}
                  
                  {transactionStatus && (
                    <View style={styles.progressStep}>
                      <Text style={styles.progressStepLabel}>Status:</Text>
                      <Text style={styles.progressStepText}>{transactionStatus}</Text>
                    </View>
                  )}
                  
                  {currentNonce !== '0' && (
                    <View style={styles.progressStep}>
                      <Text style={styles.progressStepLabel}>Root Nonce:</Text>
                      <Text style={styles.progressStepText}>{currentNonce}</Text>
                    </View>
                  )}
                  
                  <View style={styles.progressNote}>
                    <IconSymbol name="info.circle" size={16} color="#8B5CF6" />
                    <Text style={styles.progressNoteText}>
                      Please wait while we set up your delegated key on the blockchain. This may take a few minutes.
                    </Text>
                  </View>
                  
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={handleCancelOperation}
                    disabled={isAborting}
                  >
                    <IconSymbol name="xmark" size={16} color="#EF4444" />
                    <Text style={styles.cancelButtonText}>
                      {isAborting ? 'Cancelling...' : 'Cancel Operation'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Create Button */}
            <TouchableOpacity 
              style={[
                styles.createButton, 
                (isConnecting || !isWatchConnected) && styles.createButtonDisabled
              ]}
              onPress={handleCreateKey}
              disabled={isConnecting || !isWatchConnected}
            >
              {isConnecting ? (
                <>
                  <IconSymbol name="arrow.clockwise" size={20} color="#FFFFFF" />
                  <Text style={styles.createButtonText}>
                    {blockchainStep ? blockchainStep : generatedKeyPair ? 'Creating on Blockchain...' : 'Requesting Keys from Watch...'}
                  </Text>
                </>
              ) : !isWatchConnected ? (
                <>
                  <IconSymbol name="xmark" size={20} color="#FFFFFF" />
                  <Text style={styles.createButtonText}>Connect Apple Watch First</Text>
                </>
              ) : (
                <>
                  <IconSymbol name="plus" size={20} color="#FFFFFF" />
                  <Text style={styles.createButtonText}>Create Delegated Key</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Sudo Warning Modal */}
        <Modal
          visible={showSudoWarning}
          transparent={true}
          animationType="fade"
          onRequestClose={handleSudoWarningCancel}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.warningModal}>
              <View style={styles.warningHeader}>
                <IconSymbol name="exclamationmark.triangle.fill" size={32} color="#EF4444" />
                <Text style={styles.warningTitle}>Security Warning</Text>
              </View>
              
              <Text style={styles.warningText}>
                Sudo access gives your smart watch complete control over your wallet, including:
              </Text>
              
              <View style={styles.warningList}>
                <Text style={styles.warningListItem}>• Full access to all funds</Text>
                <Text style={styles.warningListItem}>• Ability to modify wallet settings</Text>
                <Text style={styles.warningListItem}>• No spending limits or restrictions</Text>
                <Text style={styles.warningListItem}>• Risk of total fund loss if compromised</Text>
              </View>
              
              <Text style={styles.warningRecommendation}>
                We strongly recommend using Restricted Access instead for better security.
              </Text>
              
              <View style={styles.warningButtons}>
                <TouchableOpacity
                  style={styles.warningButtonSecondary}
                  onPress={handleSudoWarningCancel}
                >
                  <Text style={styles.warningButtonSecondaryText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.warningButtonPrimary}
                  onPress={handleSudoWarningConfirm}
                >
                  <Text style={styles.warningButtonPrimaryText}>I Understand</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Address Confirmation Modal */}
        <Modal
          visible={showAddressConfirmation}
          transparent={true}
          animationType="fade"
          onRequestClose={() => handleAddressConfirmation(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.confirmationModal}>
              <View style={styles.confirmationHeader}>
                <IconSymbol name="checkmark.shield.fill" size={32} color="#10B981" />
                <Text style={styles.confirmationTitle}>Confirm Address</Text>
              </View>
              
              <Text style={styles.confirmationText}>
                Your Apple Watch has generated a new address. Please verify that the address shown below matches exactly what you see on your Apple Watch screen.
              </Text>
              
              {pendingKeyPair && (
                <View style={styles.addressContainer}>
                  <Text style={styles.addressLabel}>Generated Address:</Text>
                  <View style={styles.addressDisplay}>
                    <Text style={styles.confirmationAddressText}>{pendingKeyPair.address}</Text>
                    <TouchableOpacity
                      style={styles.copyButton}
                      onPress={async () => {
                        if (pendingKeyPair?.address) {
                          await Clipboard.setStringAsync(pendingKeyPair.address);
                          Alert.alert('Copied', 'Address copied to clipboard');
                        }
                      }}
                    >
                      <IconSymbol name="doc.on.doc" size={16} color="#8B5CF6" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              
              <Text style={styles.confirmationWarning}>
                ⚠️ Only proceed if the address matches exactly what you see on your Apple Watch. This is a critical security step.
              </Text>
              
              <View style={styles.confirmationButtons}>
                <TouchableOpacity
                  style={styles.confirmationButtonSecondary}
                  onPress={() => handleAddressConfirmation(false)}
                >
                  <Text style={styles.confirmationButtonSecondaryText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.confirmationButtonPrimary}
                  onPress={() => handleAddressConfirmation(true)}
                >
                  <Text style={styles.confirmationButtonPrimaryText}>Address Matches</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#A0A0A0',
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#333333',
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  connectionStatusConnected: {
    backgroundColor: '#0F1A0F',
    borderColor: '#10B981',
  },
  connectionStatusDisconnected: {
    backgroundColor: '#1A0F0F',
    borderColor: '#EF4444',
  },
  connectionStatusText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  connectionStatusTextConnected: {
    color: '#10B981',
  },
  connectionStatusTextDisconnected: {
    color: '#EF4444',
  },
  connectionInfo: {
    flex: 1,
  },
  connectionSubtext: {
    fontSize: 12,
    color: '#A0A0A0',
    marginTop: 2,
  },
  refreshButton: {
    padding: 8,
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#8B5CF6',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A0F0F',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#EF4444',
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#EF4444',
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1A0A0F',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#F59E0B',
    gap: 12,
  },
  warningContent: {
    flex: 1,
  },
  warningSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F59E0B',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#A0A0A0',
    lineHeight: 20,
    marginBottom: 12,
  },
  warningSteps: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F59E0B',
    marginBottom: 8,
  },
  warningStep: {
    fontSize: 13,
    color: '#A0A0A0',
    marginBottom: 4,
    paddingLeft: 8,
  },
  inputDisabled: {
    backgroundColor: '#0F0F0F',
    borderColor: '#333333',
    opacity: 0.5,
  },
  keyTypeContainerDisabled: {
    opacity: 0.5,
  },
  keyTypeOptionDisabled: {
    backgroundColor: '#0F0F0F',
    borderColor: '#333333',
  },
  keyTypeContainer: {
    gap: 12,
  },
  keyTypeOption: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333333',
    position: 'relative',
  },
  keyTypeOptionSelected: {
    borderColor: '#8B5CF6',
    backgroundColor: '#1A0A2E',
  },
  keyTypeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  keyTypeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  keyTypeTitleSelected: {
    color: '#8B5CF6',
  },
  keyTypeDescription: {
    fontSize: 14,
    color: '#A0A0A0',
    marginBottom: 8,
  },
  recommendedBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  recommendedBadgeSelected: {
    backgroundColor: '#10B981',
  },
  recommendedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  recommendedTextSelected: {
    color: '#FFFFFF',
  },
  warningBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  warningBadgeSelected: {
    backgroundColor: '#EF4444',
  },
  // Renamed to avoid duplicate key error
  warningBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  warningTextSelected: {
    color: '#FFFFFF',
  },
  subsection: {
    marginBottom: 24,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  whitelistToggle: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  toggleOption: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  toggleOptionSelected: {
    backgroundColor: '#8B5CF6',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#A0A0A0',
  },
  toggleTextSelected: {
    color: '#FFFFFF',
  },
  whitelistContainer: {
    gap: 8,
  },
  addAddressContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  addressInput: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#333333',
  },
  addButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#333333',
    gap: 8,
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: 'monospace',
  },
  removeButton: {
    padding: 4,
  },
  tokenLimitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#333333',
    marginBottom: 8,
    gap: 12,
  },
  tokenInfo: {
    flex: 1,
  },
  tokenSymbol: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  tokenAddress: {
    fontSize: 12,
    color: '#A0A0A0',
    fontFamily: 'monospace',
  },
  limitInfo: {
    flex: 1,
  },
  limitText: {
    fontSize: 12,
    color: '#A0A0A0',
  },
  addTokenContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  tokenInput: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 8,
    fontSize: 12,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#333333',
  },
  createButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  createButtonDisabled: {
    backgroundColor: '#4A4A4A',
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  warningModal: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  warningHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  warningTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 12,
  },
  warningTextModal: { // Renamed from warningText to avoid duplicate key
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 16,
    lineHeight: 22,
  },
  warningList: {
    marginBottom: 16,
  },
  warningListItem: {
    fontSize: 14,
    color: '#A0A0A0',
    marginBottom: 4,
  },
  warningRecommendation: {
    fontSize: 14,
    color: '#F59E0B',
    fontWeight: '600',
    marginBottom: 24,
    lineHeight: 20,
  },
  warningButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  warningButtonSecondary: {
    flex: 1,
    backgroundColor: '#333333',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  warningButtonSecondaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  warningButtonPrimary: {
    flex: 1,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  warningButtonPrimaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Address Confirmation Modal Styles
  confirmationModal: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  confirmationHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  confirmationTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 12,
  },
  confirmationText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 20,
    lineHeight: 22,
    textAlign: 'center',
  },
  addressContainer: {
    backgroundColor: '#0F0F0F',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#333333',
  },
  addressLabel: {
    fontSize: 14,
    color: '#A0A0A0',
    marginBottom: 8,
    fontWeight: '600',
  },
  addressDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  confirmationAddressText: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: 'monospace',
    backgroundColor: '#1A1A1A',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  copyButton: {
    padding: 12,
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#8B5CF6',
  },
  confirmationWarning: {
    fontSize: 14,
    color: '#F59E0B',
    fontWeight: '600',
    marginBottom: 24,
    lineHeight: 20,
    textAlign: 'center',
  },
  confirmationButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmationButtonSecondary: {
    flex: 1,
    backgroundColor: '#333333',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmationButtonSecondaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmationButtonPrimary: {
    flex: 1,
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmationButtonPrimaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Blockchain Progress Styles
  progressContainer: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333333',
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  progressStep: {
    marginBottom: 12,
  },
  progressStepLabel: {
    fontSize: 12,
    color: '#A0A0A0',
    fontWeight: '600',
    marginBottom: 4,
  },
  progressStepText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: 'monospace',
    backgroundColor: '#0F0F0F',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#333333',
  },
  progressNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#1A0A2E',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#8B5CF6',
  },
  progressNoteText: {
    flex: 1,
    fontSize: 12,
    color: '#A0A0A0',
    lineHeight: 16,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1A0F0F',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#EF4444',
    marginTop: 16,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
});
