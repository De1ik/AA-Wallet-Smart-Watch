import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, TextInput, Modal } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { apiClient, InstallationStatus } from '@/utils/apiClient';
import { wsClient } from '@/utils/websocketClient';
import { KeyType, TokenLimit, DelegatedKeyData, saveDelegatedKey, updateDelegatedKey, CallPolicyPermission, CallPolicyParamRule, CallPolicyParamCondition, PredefinedAction, CallPolicySettings, TokenOption, TokenSelection } from '@/utils/delegatedKeys';
import { useSmartWatch } from '@/hooks/useSmartWatch';
import { WatchKeyPair, WatchPermissionData, smartWatchBridge } from '@/utils/smartWatchBridge';
import { getKernelAddress } from '@/utils/config';
import { installationState } from '@/utils/installationState';

export default function CreateDelegatedKeyScreen() {
  const [keyType, setKeyType] = useState<KeyType>('restricted');
  const [deviceName, setDeviceName] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [showSudoWarning, setShowSudoWarning] = useState(false);
  const [showRestrictedSettings, setShowRestrictedSettings] = useState(false);
  const [generatedKeyPair, setGeneratedKeyPair] = useState<WatchKeyPair | null>(null);
  const [showAddressConfirmation, setShowAddressConfirmation] = useState(false);
  const [pendingKeyPair, setPendingKeyPair] = useState<WatchKeyPair | null>(null);
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
  
  
  // CallPolicy settings
  const [showCallPolicySettings, setShowCallPolicySettings] = useState(false);
  const [callPolicySettings, setCallPolicySettings] = useState<CallPolicySettings>({
    allowedTargets: [],
    allowedTokens: [],
    allowedActions: ['transfer'], // Set 'transfer' as default
    maxValuePerTx: '0.1',
    maxValuePerDay: '1.0'
  });
  const [maxValuePerTxError, setMaxValuePerTxError] = useState('');
  const [maxValuePerDayError, setMaxValuePerDayError] = useState('');
  const [newTargetName, setNewTargetName] = useState('');
  const [newTargetAddress, setNewTargetAddress] = useState('');
  const [showAddTarget, setShowAddTarget] = useState(false);
  const [showActionSelector, setShowActionSelector] = useState(false);
  const [actionSearchQuery, setActionSearchQuery] = useState('');
  const [showTransferOptions, setShowTransferOptions] = useState(false);
  const [transferOptions, setTransferOptions] = useState({
    eth: true,
    erc20: false
  });
  const [transferEnabled, setTransferEnabled] = useState(true);
  const [showTokenSelector, setShowTokenSelector] = useState(false);
  const [tokenSearch, setTokenSearch] = useState('');

  // Predefined actions
  const predefinedActions: PredefinedAction[] = [
    { id: 'transfer', name: 'Transfer', description: 'Send tokens to any address', selector: '0xa9059cbb', category: 'transfer' },
    { id: 'approve', name: 'Approve', description: 'Approve token spending', selector: '0x095ea7b3', category: 'approve' },
    { id: 'transferFrom', name: 'Transfer From', description: 'Transfer tokens on behalf of another', selector: '0x23b872dd', category: 'transfer' },
    { id: 'swap', name: 'Swap', description: 'Exchange tokens via DEX', selector: '0x38ed1739', category: 'swap' },
    { id: 'stake', name: 'Stake', description: 'Stake tokens for rewards', selector: '0xa694fc3a', category: 'stake' },
    { id: 'unstake', name: 'Unstake', description: 'Unstake tokens', selector: '0x2e17de78', category: 'stake' },
    { id: 'claim', name: 'Claim Rewards', description: 'Claim staking rewards', selector: '0x379607f5', category: 'stake' },
    { id: 'deposit', name: 'Deposit', description: 'Deposit tokens to protocol', selector: '0x47e7ef24', category: 'other' },
    { id: 'withdraw', name: 'Withdraw', description: 'Withdraw tokens from protocol', selector: '0x2e1a7d4d', category: 'other' }
  ];

  // Supported tokens (aligned with server-side SEPOLIA_TOKENS)
  const SUPPORTED_TOKENS: TokenOption[] = [
    {
      address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
      symbol: 'UNI',
      name: 'Uniswap',
      decimals: 18,
      color: '#FF007A',
    },
    {
      address: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
      symbol: 'WETH',
      name: 'Wrapped Ether',
      decimals: 18,
      color: '#627EEA',
    },
    {
      address: '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      color: '#26a17b',
    },
    {
      address: '0x94a9d9ac8a22534e3faca9f4e7f2e2cf85d5e4c8',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      color: '#2775CA',
    },
    {
      address: '0xff34b3d4aee8ddcd6f9afffb6fe49bd371b8a357',
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      decimals: 18,
      color: '#F5AC37',
    },
  ];

  const handleKeyTypeSelect = (type: KeyType) => {
    if (type === 'sudo') {
      setShowSudoWarning(true);
    } else {
      setKeyType(type);
      if (type === 'restricted') {
        setShowCallPolicySettings(true); // Use CallPolicy settings for restricted
      }
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
      // Send message to watch to show installation waiting screen
      try {
        smartWatchBridge.sendToWatch({ type: "START_INSTALLATION" });
        console.log('Sent START_INSTALLATION message to watch');
      } catch (error) {
        console.error('Failed to send START_INSTALLATION to watch:', error);
      }
      
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



  // CallPolicy functions
  const addTargetAddress = () => {
    if (!newTargetName.trim()) {
      Alert.alert('Error', 'Please enter a name for this address');
      return;
    }
    if (newTargetAddress && newTargetAddress.startsWith('0x') && newTargetAddress.length === 42) {
      setCallPolicySettings(prev => ({
        ...prev,
        allowedTargets: [...prev.allowedTargets, { name: newTargetName.trim(), address: newTargetAddress }]
      }));
      setNewTargetName('');
      setNewTargetAddress('');
      setShowAddTarget(false);
    } else {
      Alert.alert('Error', 'Please enter a valid Ethereum address (0x...)');
    }
  };

  const removeTargetAddress = (index: number) => {
    setCallPolicySettings(prev => ({
      ...prev,
      allowedTargets: prev.allowedTargets.filter((_, i) => i !== index)
    }));
  };

  const toggleTokenSelection = (token: TokenOption) => {
    setCallPolicySettings(prev => {
      const exists = prev.allowedTokens.some(t => t.address.toLowerCase() === token.address.toLowerCase());
      const nextTokens: TokenSelection[] = exists
        ? prev.allowedTokens.filter(t => t.address.toLowerCase() !== token.address.toLowerCase())
        : [...prev.allowedTokens, { ...token, maxValuePerTx: prev.maxValuePerTx, maxValuePerDay: prev.maxValuePerDay }];
      return { ...prev, allowedTokens: nextTokens };
    });
  };

  const isTokenSelected = (token: TokenOption) =>
    callPolicySettings.allowedTokens.some(t => t.address.toLowerCase() === token.address.toLowerCase());

  const toggleAction = (actionId: string) => {
    setCallPolicySettings(prev => ({
      ...prev,
      allowedActions: prev.allowedActions.includes(actionId)
        ? prev.allowedActions.filter(id => id !== actionId)
        : [...prev.allowedActions, actionId]
    }));
  };

  const addAction = (actionId: string) => {
    if (actionId === 'transfer') {
      // Show transfer options modal
      setShowTransferOptions(true);
    } else {
      if (!callPolicySettings.allowedActions.includes(actionId)) {
        setCallPolicySettings(prev => ({
          ...prev,
          allowedActions: [...prev.allowedActions, actionId]
        }));
      }
      setShowActionSelector(false);
      setActionSearchQuery('');
    }
  };

  const handleTransferToggle = () => {
    if (transferEnabled) {
      // Disable transfer
      setTransferEnabled(false);
      setCallPolicySettings(prev => ({
        ...prev,
        allowedActions: prev.allowedActions.filter(id => id !== 'transfer')
      }));
    } else {
      // Enable transfer with current options
      setTransferEnabled(true);
      if (!callPolicySettings.allowedActions.includes('transfer')) {
        setCallPolicySettings(prev => ({
          ...prev,
          allowedActions: [...prev.allowedActions, 'transfer']
        }));
      }
    }
  };

  const handleTransferCardClick = () => {
    if (transferEnabled) {
      // Show transfer options modal
      setShowTransferOptions(true);
    } else {
      // Enable transfer first
      setTransferEnabled(true);
      if (!callPolicySettings.allowedActions.includes('transfer')) {
        setCallPolicySettings(prev => ({
          ...prev,
          allowedActions: [...prev.allowedActions, 'transfer']
        }));
      }
    }
  };

  const confirmTransferOptions = () => {
    // Add transfer action with selected options
    if (!callPolicySettings.allowedActions.includes('transfer')) {
      setCallPolicySettings(prev => ({
        ...prev,
        allowedActions: [...prev.allowedActions, 'transfer']
      }));
    }
    setShowTransferOptions(false);
    setShowActionSelector(false);
    setActionSearchQuery('');
  };

  const removeAction = (actionId: string) => {
    setCallPolicySettings(prev => ({
      ...prev,
      allowedActions: prev.allowedActions.filter(id => id !== actionId)
    }));
  };

  const filteredActions = predefinedActions.filter(action =>
    action.name.toLowerCase().includes(actionSearchQuery.toLowerCase()) ||
    action.description.toLowerCase().includes(actionSearchQuery.toLowerCase())
  );

  const filteredTokenOptions = SUPPORTED_TOKENS.filter(token =>
    token.name.toLowerCase().includes(tokenSearch.toLowerCase()) ||
    token.symbol.toLowerCase().includes(tokenSearch.toLowerCase())
  );

  // Validate and filter max transaction amount input
  const handleMaxValuePerTxChange = (text: string) => {
    // Remove any non-numeric characters except decimal point
    const filteredText = text.replace(/[^0-9.]/g, '');
    
    // Prevent multiple decimal points
    const parts = filteredText.split('.');
    const cleanText = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : filteredText;
    
    // Update the value
    setCallPolicySettings(prev => ({ ...prev, maxValuePerTx: cleanText }));
    
    // Validate the value
    const numValue = parseFloat(cleanText);
    if (cleanText === '' || cleanText === '.') {
      setMaxValuePerTxError('');
    } else if (isNaN(numValue) || numValue <= 0) {
      setMaxValuePerTxError('Amount must be greater than 0');
    } else {
      setMaxValuePerTxError('');
    }
  };

  const handleMaxValuePerDayChange = (text: string) => {
    // Remove any non-numeric characters except decimal point
    const filteredText = text.replace(/[^0-9.]/g, '');
    
    // Prevent multiple decimal points
    const parts = filteredText.split('.');
    const cleanText = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : filteredText;
    
    // Update the value
    setCallPolicySettings(prev => ({ ...prev, maxValuePerDay: cleanText }));
    
    // Validate the value
    const numValue = parseFloat(cleanText);
    if (cleanText === '' || cleanText === '.') {
      setMaxValuePerDayError('');
    } else if (isNaN(numValue) || numValue <= 0) {
      setMaxValuePerDayError('Amount must be greater than 0');
    } else {
      setMaxValuePerDayError('');
    }
  };

  // Validation for Restricted settings (using CallPolicy)
  const isRestrictedValid = () => {
    if (keyType !== 'restricted') return true;
    
    const numTxValue = parseFloat(callPolicySettings.maxValuePerTx);
    const numDayValue = parseFloat(callPolicySettings.maxValuePerDay);
    const hasTransferAction = callPolicySettings.allowedActions.includes('transfer') && transferEnabled;
    const ethTransferNeedsTargets = !hasTransferAction || !transferOptions.eth || callPolicySettings.allowedTargets.length > 0;
    const erc20TransferNeedsTokens = !hasTransferAction || !transferOptions.erc20 || callPolicySettings.allowedTokens.length > 0;
    const hasNonTransferActions = callPolicySettings.allowedActions.some(id => id !== 'transfer');
    const nonTransferNeedsTargets = !hasNonTransferActions || callPolicySettings.allowedTargets.length > 0;
    const hasValidTransferOptions = !hasTransferAction || transferOptions.eth || transferOptions.erc20;
    
    return callPolicySettings.maxValuePerTx &&
           callPolicySettings.maxValuePerTx !== '0' &&
           callPolicySettings.maxValuePerTx !== '' &&
           callPolicySettings.maxValuePerTx !== '.' &&
           !isNaN(numTxValue) &&
           numTxValue > 0 &&
           callPolicySettings.maxValuePerDay &&
           callPolicySettings.maxValuePerDay !== '0' &&
           callPolicySettings.maxValuePerDay !== '' &&
           callPolicySettings.maxValuePerDay !== '.' &&
           !isNaN(numDayValue) &&
           numDayValue > 0 &&
           callPolicySettings.allowedActions.length > 0 &&
           nonTransferNeedsTargets &&
           ethTransferNeedsTargets &&
           erc20TransferNeedsTokens &&
           hasValidTransferOptions &&
           !maxValuePerTxError &&
           !maxValuePerDayError;
  };

  const generateCallPolicyPermissions = (): CallPolicyPermission[] => {
    const permissions: CallPolicyPermission[] = [];
    const hasTransferAction = callPolicySettings.allowedActions.includes('transfer') && transferEnabled;
    
    // ETH transfers (per target)
    if (hasTransferAction && transferOptions.eth) {
      callPolicySettings.allowedTargets.forEach(target => {
        permissions.push({
          callType: 0,
          target: target.address,
          selector: '0x00000000',
          valueLimit: callPolicySettings.maxValuePerTx,
          dailyLimit: callPolicySettings.maxValuePerDay,
          rules: [],
          decimals: 18,
        });
      });
    }

    // ERC20 transfers (per selected token)
    if (hasTransferAction && transferOptions.erc20) {
      callPolicySettings.allowedTokens.forEach(token => {
        permissions.push({
          callType: 0,
          target: token.address,
          selector: '0xa9059cbb',
          valueLimit: token.maxValuePerTx,
          dailyLimit: token.maxValuePerDay,
          rules: [],
          decimals: token.decimals,
          tokenSymbol: token.symbol,
        });
      });
    }

    // Other actions on allowed targets
    callPolicySettings.allowedTargets.forEach(target => {
      callPolicySettings.allowedActions
        .filter(actionId => actionId !== 'transfer')
        .forEach(actionId => {
          const action = predefinedActions.find(a => a.id === actionId);
          if (action) {
            permissions.push({
              callType: 0,
              target: target.address,
              selector: action.selector,
              valueLimit: callPolicySettings.maxValuePerTx,
              dailyLimit: callPolicySettings.maxValuePerDay,
              rules: [],
              decimals: 18,
            });
          }
        });
    });
    
    return permissions;
  };

  const handleCancelOperation = () => {
    setIsAborting(true);
    setIsConnecting(false);
    // Reset states
    setTimeout(() => {
      setIsAborting(false);
    }, 2000);
  };

  const continueWithBlockchainOperations = async (keyPair: WatchKeyPair, deviceId: string) => {
    try {
      // Step 2: Use simplified API for delegated key creation
      
      console.log('Step 2: Creating delegated access on blockchain...');
      const delegatedEOA = keyPair.address as `0x${string}`;

      // Navigate to installation progress screen (state is now managed globally)
      router.push({
        pathname: '/settings/smart-watch/installation-progress',
        params: {
          deviceId: deviceId,
          deviceName: deviceName.trim(),
          keyType: keyType,
        }
      });

      // Start global installation state tracking
      installationState.startInstallation(deviceId, deviceName.trim(), keyType);

      // Check prefund first (track errors instead of throwing)
      try {
        const prefundCheck = await apiClient.checkPrefund();
        if (!prefundCheck.hasPrefund) {
          const prefundMessage =
            prefundCheck.message ||
            prefundCheck.details ||
            prefundCheck.error ||
            'Insufficient funds in EntryPoint';
          console.warn('[CreateKey] Prefund check failed:', prefundMessage);
          await handleInstallationError(
            `Account balance check failed: ${prefundMessage}`,
            deviceId
          );
          return;
        }
      } catch (prefundError: any) {
        const errorMessage = prefundError?.message || 'Failed to check account balance';
        console.warn('[CreateKey] Prefund check threw error:', errorMessage);
        await handleInstallationError(
          `Account balance check failed: ${errorMessage}`,
          deviceId
        );
        return;
      }

      // Start the installation process
      const clientId = wsClient.getClientId();
      const requestData: any = {
        delegatedEOA,
        keyType,
        clientId
      };
      
      // Add permissions for Restricted (using CallPolicy)
      if (keyType === 'restricted') {
        const permissions = generateCallPolicyPermissions();
        requestData.permissions = permissions;
        requestData.keyType = 'callpolicy'; // Send as callpolicy to server
        
        // Log CallPolicy restrictions being sent
        console.log('\n📱 ===== CLIENT: CALLPOLICY RESTRICTIONS =====');
        console.log(`🔑 Key Type: ${keyType}`);
        console.log(`💰 Max Value Per Transaction: ${callPolicySettings.maxValuePerTx} ETH`);
        console.log(`📅 Max Value Per Day: ${callPolicySettings.maxValuePerDay} ETH`);
        console.log('\n🎯 ALLOWED TARGET ADDRESSES:');
        callPolicySettings.allowedTargets.forEach((target, index) => {
          console.log(`   ${index + 1}. ${target.name} (${target.address})`);
        });
        console.log('\n🪙 ALLOWED TOKENS FOR ERC20 TRANSFERS:');
        callPolicySettings.allowedTokens.forEach((token, index) => {
          console.log(`   ${index + 1}. ${token.symbol} (${token.address}) dec:${token.decimals}`);
        });
        console.log('\n⚡ ALLOWED ACTIONS:');
        callPolicySettings.allowedActions.forEach((actionId, index) => {
          if (actionId === 'transfer') {
            console.log(`   ${index + 1}. Transfer - ${transferEnabled ? 'ENABLED' : 'DISABLED'}`);
            if (transferEnabled) {
              console.log(`      Transfer Options:`);
              if (transferOptions.eth) {
                console.log(`      - ETH Transfers (0x00000000)`);
              }
              if (transferOptions.erc20) {
                console.log(`      - ERC20 Token Transfers (0xa9059cbb)`);
              }
            }
          } else {
            const action = predefinedActions.find(a => a.id === actionId);
            if (action) {
              console.log(`   ${index + 1}. ${action.name} (${action.selector}) - ${action.description}`);
            }
          }
        });
        console.log('\n🔐 GENERATED PERMISSIONS:');
        permissions.forEach((perm, index) => {
          let actionName = 'Unknown';
          if (perm.selector === '0x00000000') {
            actionName = 'ETH Transfer';
          } else if (perm.selector === '0xa9059cbb') {
            actionName = 'ERC20 Transfer';
          } else {
            const action = predefinedActions.find(a => a.selector === perm.selector);
            actionName = action ? action.name : 'Unknown';
          }
          console.log(`   ${index + 1}. ${actionName}`);
          console.log(`      Target: ${perm.target}`);
          console.log(`      Selector: ${perm.selector}`);
          console.log(`      Value Limit: ${perm.valueLimit} ETH`);
          console.log(`      Daily Limit: ${perm.dailyLimit} ETH`);
          console.log(`      Rules: ${perm.rules.length > 0 ? JSON.stringify(perm.rules, null, 8) : 'None'}`);
          console.log('');
        });
        console.log('📱 ===========================================\n');
      }
      
      const result = await apiClient.createDelegatedKey(requestData);

      console.log('Installation started:', result);

    } catch (error) {
      console.error('Error starting blockchain operations:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      handleInstallationError(errorMessage, deviceId);
    }
  };

  const handleInstallationComplete = async (keyPair: WatchKeyPair, deviceId: string) => {
    try {
      // Step 3: Save delegated key data to AsyncStorage
      console.log('[CreateKey] Installation completed! Updating status to completed for device:', deviceId);
      
      // For now, we'll use placeholder values since the server doesn't return them yet
      // In a real implementation, the server should return permissionId and vId
      const delegatedKeyData: DelegatedKeyData = {
        id: deviceId, // Use the same deviceId that was created initially
        deviceName: deviceName.trim(),
        keyType,
        permissionId: '', // Will be updated by WebSocket status update
        vId: '', // Will be updated by WebSocket status update
        publicAddress: keyPair.address,
        createdAt: new Date().toISOString(),
        installationStatus: 'completed', // Mark as completed
        installationProgress: undefined, // Clear progress data when completed
        ...(keyType === 'restricted' && {
          callPolicyPermissions: generateCallPolicyPermissions()
        })
      };

      await updateDelegatedKey(deviceId, delegatedKeyData);
      // Step 4: Send permission data to smart watch for storage
      console.log('Step 4: Syncing permission data to smart watch...');
      const watchPermissionData: WatchPermissionData = {
        permissionId: delegatedKeyData.permissionId,
        vId: delegatedKeyData.vId,
        deviceName: deviceName.trim(),
        keyType,
        createdAt: delegatedKeyData.createdAt,
        allowedTokens: callPolicySettings.allowedTokens.map(t => ({
          address: t.address,
          symbol: t.symbol,
          decimals: t.decimals,
          maxValuePerTx: t.maxValuePerTx,
          maxValuePerDay: t.maxValuePerDay,
        })),
      };

      await syncPermissionData(watchPermissionData);
      console.log('Permission data synced to smart watch successfully!');
      
      const keyTypeDisplay = keyType === 'sudo' ? 'Sudo Access' : keyType === 'restricted' ? 'Restricted Access' : 'CallPolicy Access';
      Alert.alert(
        'Success!',
        `Delegated key created successfully for ${deviceName}.\n\nKey Type: ${keyTypeDisplay}\nPublic Key: ${keyPair.address.slice(0, 10)}...\n\nYour smart watch can now perform transactions on your behalf.`,
        [
          {
            text: 'OK',
            onPress: () => {
              wsClient.disconnect();
              router.back();
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error in post-installation steps:', error);
      handleInstallationError(error instanceof Error ? error.message : 'Unknown error', deviceId);
    }
  };

  const handleInstallationError = async (errorMessage: string, deviceId: string) => {
      // Mark installation as failed if we have a device ID
      if (deviceId) {
        try {
          await updateDelegatedKey(deviceId, {
            installationStatus: 'failed',
            installationProgress: {
              currentStep: 'Installation failed',
            totalSteps: 3,
              completedSteps: 0,
              transactionStatus: errorMessage,
            }
          });
        } catch (updateError) {
          console.error('Error updating device status:', updateError);
        }
      }
      
    // Provide specific error messages based on error type
    let userFriendlyMessage = errorMessage;
    let title = 'Installation Failed';
    let showRetryOption = false;
    
    const normalizedError = errorMessage.toLowerCase();
    
    const shouldNavigateBackToCreate =
      normalizedError.includes('insufficient funds') ||
      normalizedError.includes('aa21') ||
      normalizedError.includes('prefund');
    
    if (
      normalizedError.includes('insufficient funds') ||
      normalizedError.includes('aa21') ||
      normalizedError.includes('prefund')
    ) {
      title = 'Insufficient Funds';
      userFriendlyMessage =
        'Your account does not have enough ETH deposited in the EntryPoint to pay for transaction fees.\n\nPlease add more prefund to your smart wallet before trying again.';
    } else if (errorMessage.includes('Network error') || errorMessage.includes('RPC')) {
      title = 'Network Error';
      userFriendlyMessage = 'Unable to connect to the blockchain network.\n\nPlease check your internet connection and try again.';
      showRetryOption = true;
    } else if (errorMessage.includes('timeout')) {
      title = 'Transaction Timeout';
      userFriendlyMessage = 'The transaction took too long to complete.\n\nPlease try again with higher gas fees or check network congestion.';
      showRetryOption = true;
    } else if (errorMessage.includes('Connection') || errorMessage.includes('WebSocket')) {
      title = 'Connection Error';
      userFriendlyMessage = 'Lost connection to the server during installation.\n\nThe installation may still be in progress. Please check your connection and try again.';
      showRetryOption = true;
    }
    
    const buttons = [
      {
        text: 'OK',
        onPress: () => {
          wsClient.disconnect();
          setIsConnecting(false);
          if (shouldNavigateBackToCreate) {
            router.back();
          }
        }
      }
    ];

    if (showRetryOption) {
      buttons.unshift({
        text: 'Retry',
        onPress: () => {
          wsClient.resetConnection();
          setIsConnecting(false);
          // User can try again by clicking the create button
        }
      });
    }
    
    Alert.alert(title, userFriendlyMessage, buttons);
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

    // Validate Restricted settings (using CallPolicy)
    if (keyType === 'restricted') {
      const numTxValue = parseFloat(callPolicySettings.maxValuePerTx);
      const numDayValue = parseFloat(callPolicySettings.maxValuePerDay);
      const hasTransferAction = callPolicySettings.allowedActions.includes('transfer') && transferEnabled;
      const needsEthTargets = hasTransferAction && transferOptions.eth;
      const needsErc20Tokens = hasTransferAction && transferOptions.erc20;
      const hasNonTransferActions = callPolicySettings.allowedActions.some(id => id !== 'transfer');

      if (hasNonTransferActions && callPolicySettings.allowedTargets.length === 0) {
        Alert.alert('Error', 'Please add at least one allowed target address for the selected actions');
        return;
      }
      if (needsEthTargets && callPolicySettings.allowedTargets.length === 0) {
        Alert.alert('Error', 'Please add at least one allowed target address for ETH transfers');
        return;
      }
      if (needsErc20Tokens && callPolicySettings.allowedTokens.length === 0) {
        Alert.alert('Error', 'Please select at least one ERC20 token to allow transfers');
        return;
      }
      if (needsErc20Tokens) {
        const invalidToken = callPolicySettings.allowedTokens.find(
          t => isNaN(parseFloat(t.maxValuePerTx)) || parseFloat(t.maxValuePerTx) <= 0 ||
               isNaN(parseFloat(t.maxValuePerDay)) || parseFloat(t.maxValuePerDay) <= 0
        );
        if (invalidToken) {
          Alert.alert('Error', `Please set valid limits for ${invalidToken.symbol} (per tx and per day must be > 0)`);
          return;
        }
      }

      if (!callPolicySettings.maxValuePerTx || 
          callPolicySettings.maxValuePerTx === '0' || 
          callPolicySettings.maxValuePerTx === '' ||
          callPolicySettings.maxValuePerTx === '.' ||
          isNaN(numTxValue) ||
          numTxValue <= 0) {
        Alert.alert('Error', 'Please set a valid maximum transaction amount greater than 0');
        return;
      }
      
      if (!callPolicySettings.maxValuePerDay || 
          callPolicySettings.maxValuePerDay === '0' || 
          callPolicySettings.maxValuePerDay === '' ||
          callPolicySettings.maxValuePerDay === '.' ||
          isNaN(numDayValue) ||
          numDayValue <= 0) {
        Alert.alert('Error', 'Please set a valid maximum daily amount greater than 0');
        return;
      }

      if (callPolicySettings.allowedActions.length === 0) {
        Alert.alert('Error', 'Please select at least one action');
        return;
      }
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
      
      // Prepare whitelist data if it's a restricted key type
      const whitelist = keyType === 'restricted' && callPolicySettings.allowedTargets.length > 0
        ? callPolicySettings.allowedTargets.map(target => ({ name: target.name, address: target.address }))
        : undefined;
      
      console.log('[create-key] -> whitelist:', whitelist);
      const keyPair = await requestKeyGeneration({ 
        kernelAddress,
        whitelist 
      });
      
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
                    Custom permissions with specific function and parameter restrictions
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

            {/* Restricted Settings (CallPolicy) */}
            {keyType === 'restricted' && isWatchConnected && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Restricted Access Settings</Text>
                <Text style={styles.sectionSubtitle}>
                  Configure allowed targets, actions, and spending limits
                </Text>
                
                {/* Allowed Target Addresses */}
                <View style={styles.subsection}>
                  <View style={styles.subsectionHeader}>
                    <Text style={styles.subsectionTitle}>Allowed Target Addresses</Text>
                    {callPolicySettings.allowedTargets.length === 0 && (
                      <Text style={styles.requiredIndicator}>* Required</Text>
                    )}
                  </View>
                  <Text style={styles.subsectionDescription}>
                    Smart contracts your watch can interact with
                  </Text>
                  
                  {callPolicySettings.allowedTargets.length > 0 && (
                    <View style={styles.targetList}>
                      {callPolicySettings.allowedTargets.map((target, index) => (
                        <View key={index} style={styles.targetItem}>
                          <View style={styles.targetInfo}>
                            <Text style={styles.targetName}>{target.name}</Text>
                            <Text style={styles.targetAddress}>{target.address}</Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => removeTargetAddress(index)}
                            style={styles.removeButton}
                          >
                            <IconSymbol name="trash" size={16} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                  
                  <TouchableOpacity
                    onPress={() => setShowAddTarget(true)}
                    style={styles.addTargetButton}
                  >
                    <IconSymbol name="plus" size={16} color="#10B981" />
                    <Text style={styles.addTargetText}>Add Target Address</Text>
                  </TouchableOpacity>
                </View>

                {/* Allowed Tokens (ERC20) */}
                <View style={styles.subsection}>
                  <View style={styles.subsectionHeader}>
                    <Text style={styles.subsectionTitle}>Allowed ERC20 Tokens</Text>
                    {transferEnabled && transferOptions.erc20 && callPolicySettings.allowedTokens.length === 0 && (
                      <Text style={styles.requiredIndicator}>* Required for ERC20 transfers</Text>
                    )}
                  </View>
                  <Text style={styles.subsectionDescription}>
                    Choose which tokens the watch can transfer
                  </Text>

                  <TouchableOpacity
                    style={styles.selectTokenButton}
                    onPress={() => {
                      setTokenSearch('');
                      setShowTokenSelector(true);
                    }}
                  >
                    <IconSymbol name="plus.circle.fill" size={18} color="#10B981" />
                    <Text style={styles.selectTokenButtonText}>Select Tokens</Text>
                  </TouchableOpacity>

                  {callPolicySettings.allowedTokens.length > 0 ? (
                    <View style={styles.tokenLimitsContainer}>
                      {callPolicySettings.allowedTokens.map((token, idx) => (
                        <View key={token.address} style={styles.tokenLimitCard}>
                          <View style={styles.tokenLimitHeader}>
                            <View style={[styles.tokenBadge, { backgroundColor: token.color || '#4B5563' }]} />
                            <View style={styles.tokenInfo}>
                              <Text style={[styles.tokenName, styles.tokenNameSelected]}>
                                {token.name} ({token.symbol})
                              </Text>
                              <Text style={styles.tokenMeta}>Decimals: {token.decimals}</Text>
                            </View>
                            <TouchableOpacity onPress={() => toggleTokenSelection(token)}>
                              <IconSymbol name="trash" size={18} color="#EF4444" />
                            </TouchableOpacity>
                          </View>
                          <View style={styles.limitRow}>
                            <View style={styles.limitField}>
                              <Text style={styles.limitLabel}>Max per Tx</Text>
                              <TextInput
                                style={styles.limitInput}
                                keyboardType="numeric"
                                value={token.maxValuePerTx}
                                onChangeText={(val) => {
                                  setCallPolicySettings(prev => {
                                    const copy = [...prev.allowedTokens];
                                    copy[idx] = { ...copy[idx], maxValuePerTx: val };
                                    return { ...prev, allowedTokens: copy };
                                  });
                                }}
                                placeholder="e.g. 10"
                                placeholderTextColor="#6B7280"
                              />
                            </View>
                            <View style={styles.limitField}>
                              <Text style={styles.limitLabel}>Max per Day</Text>
                              <TextInput
                                style={styles.limitInput}
                                keyboardType="numeric"
                                value={token.maxValuePerDay}
                                onChangeText={(val) => {
                                  setCallPolicySettings(prev => {
                                    const copy = [...prev.allowedTokens];
                                    copy[idx] = { ...copy[idx], maxValuePerDay: val };
                                    return { ...prev, allowedTokens: copy };
                                  });
                                }}
                                placeholder="e.g. 50"
                                placeholderTextColor="#6B7280"
                              />
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.emptyStateText}>No tokens selected yet.</Text>
                  )}
                </View>

                {/* Allowed Actions */}
                <View style={styles.subsection}>
                  <View style={styles.subsectionHeader}>
                    <Text style={styles.subsectionTitle}>Allowed Actions</Text>
                    {callPolicySettings.allowedActions.length === 0 && (
                      <Text style={styles.requiredIndicator}>* Required</Text>
                    )}
                  </View>
                  <Text style={styles.subsectionDescription}>
                    Select the actions your watch can perform
                  </Text>
                  
                  {/* Selected Actions */}
                  <View style={styles.selectedActionsContainer}>
                    {/* Transfer Card with Toggle */}
                    <View style={[
                      styles.transferCard,
                      transferEnabled && styles.transferCardEnabled
                    ]}>
                      <View style={styles.transferCardHeader}>
                        <View style={styles.transferCardInfo}>
                          <Text style={[
                            styles.transferCardTitle,
                            transferEnabled && styles.transferCardTitleEnabled
                          ]}>
                            Transfer
                          </Text>
                          <Text style={styles.transferCardDescription}>
                            Send tokens to any address
                          </Text>
                          {transferEnabled && (
                            <View style={styles.transferStatusContainer}>
                              {transferOptions.eth && (
                                <View style={styles.transferStatusItem}>
                                  <IconSymbol name="bitcoinsign.circle.fill" size={14} color="#10B981" />
                                  <Text style={styles.transferStatusText}>ETH</Text>
                                </View>
                              )}
                              {transferOptions.erc20 && (
                                <View style={styles.transferStatusItem}>
                                  <IconSymbol name="dollarsign.circle.fill" size={14} color="#10B981" />
                                  <Text style={styles.transferStatusText}>ERC20</Text>
                                </View>
                              )}
                            </View>
                          )}
                        </View>
                        <View style={styles.transferCardControls}>
                          <TouchableOpacity
                            style={[
                              styles.transferToggle,
                              transferEnabled && styles.transferToggleEnabled
                            ]}
                            onPress={handleTransferToggle}
                          >
                            <View style={[
                              styles.transferToggleThumb,
                              transferEnabled && styles.transferToggleThumbEnabled
                            ]} />
                          </TouchableOpacity>
                          {transferEnabled && (
                            <TouchableOpacity
                              onPress={handleTransferCardClick}
                              style={styles.transferSettingsButton}
                            >
                              <IconSymbol name="gearshape.fill" size={16} color="#10B981" />
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    </View>

                    {/* Other Actions */}
                    {callPolicySettings.allowedActions.filter(actionId => actionId !== 'transfer').map((actionId) => {
                      const action = predefinedActions.find(a => a.id === actionId);
                      if (!action) return null;
                      return (
                        <View key={actionId} style={styles.selectedActionItem}>
                          <View style={styles.selectedActionInfo}>
                            <Text style={styles.selectedActionName}>{action.name}</Text>
                            <Text style={styles.selectedActionDescription}>{action.description}</Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => removeAction(actionId)}
                            style={styles.removeActionButton}
                          >
                            <IconSymbol name="xmark" size={16} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                  
                  <TouchableOpacity
                    onPress={() => setShowActionSelector(true)}
                    style={styles.addActionButton}
                  >
                    <IconSymbol name="plus" size={16} color="#10B981" />
                    <Text style={styles.addActionText}>Add Action</Text>
                  </TouchableOpacity>
                </View>

                {/* Spending Limits */}
                <View style={styles.subsection}>
                  <View style={styles.subsectionHeader}>
                    <Text style={styles.subsectionTitle}>Spending Limits</Text>
                    {(!callPolicySettings.maxValuePerTx || callPolicySettings.maxValuePerTx === '0' || callPolicySettings.maxValuePerTx === '' || 
                      !callPolicySettings.maxValuePerDay || callPolicySettings.maxValuePerDay === '0' || callPolicySettings.maxValuePerDay === '') && (
                      <Text style={styles.requiredIndicator}>* Required</Text>
                    )}
                  </View>
                  <Text style={styles.subsectionDescription}>
                    Set maximum transaction limits
                  </Text>
                  
                  <View style={styles.limitsContainer}>
                    <View style={styles.limitItem}>
                      <Text style={styles.limitLabel}>Max per Transaction (ETH)</Text>
                      <TextInput
                        style={[
                          styles.limitInput,
                          maxValuePerTxError && styles.limitInputError
                        ]}
                        value={callPolicySettings.maxValuePerTx}
                        onChangeText={handleMaxValuePerTxChange}
                        placeholder="0.1"
                        placeholderTextColor="#666666"
                        keyboardType="numeric"
                      />
                      {maxValuePerTxError && (
                        <Text style={styles.inputErrorText}>{maxValuePerTxError}</Text>
                      )}
                    </View>
                    
                    <View style={styles.limitItem}>
                      <Text style={styles.limitLabel}>Max per Day (ETH)</Text>
                      <TextInput
                        style={[
                          styles.limitInput,
                          maxValuePerDayError && styles.limitInputError
                        ]}
                        value={callPolicySettings.maxValuePerDay}
                        onChangeText={handleMaxValuePerDayChange}
                        placeholder="1.0"
                        placeholderTextColor="#666666"
                        keyboardType="numeric"
                      />
                      {maxValuePerDayError && (
                        <Text style={styles.inputErrorText}>{maxValuePerDayError}</Text>
                      )}
                    </View>
                  </View>
                </View>

                {/* Summary */}
                {(callPolicySettings.allowedTargets.length > 0 || callPolicySettings.allowedTokens.length > 0) && callPolicySettings.allowedActions.length > 0 && (
                  <View style={styles.summaryContainer}>
                    <Text style={styles.summaryTitle}>Permission Summary</Text>
                    <Text style={styles.summaryText}>
                      Your watch can perform {callPolicySettings.allowedActions.length} action(s) on {callPolicySettings.allowedTargets.length} contract(s) and {callPolicySettings.allowedTokens.length} token(s) with a maximum of {callPolicySettings.maxValuePerTx} units per transaction and {callPolicySettings.maxValuePerDay} units per day (ETH uses 18 decimals; ERC20 uses token decimals).
                    </Text>
                  </View>
                )}
              </View>
            )}



            {/* Create Button */}
            <TouchableOpacity 
              style={[
                styles.createButton, 
                (isConnecting || !isWatchConnected || !isRestrictedValid()) && styles.createButtonDisabled
              ]}
              onPress={handleCreateKey}
              disabled={isConnecting || !isWatchConnected || !isRestrictedValid()}
            >
              {isConnecting ? (
                <>
                  <IconSymbol name="arrow.clockwise" size={20} color="#FFFFFF" />
                  <Text style={styles.createButtonText}>
                    {generatedKeyPair ? 'Creating on Blockchain...' : 'Requesting Keys from Watch...'}
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

        {/* Add Target Address Modal */}
        <Modal
          visible={showAddTarget}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowAddTarget(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.targetModal}>
              <View style={styles.targetModalHeader}>
                <Text style={styles.targetModalTitle}>Add Target Address</Text>
                <TouchableOpacity
                  onPress={() => setShowAddTarget(false)}
                  style={styles.closeButton}
                >
                  <IconSymbol name="xmark" size={20} color="#A0A0A0" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.targetModalContent}>
                <Text style={styles.targetModalDescription}>
                  Enter a name and the smart contract address your watch will be allowed to interact with.
                </Text>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Name</Text>
                  <TextInput
                    style={styles.textInput}
                    value={newTargetName}
                    onChangeText={setNewTargetName}
                    placeholder="e.g., Alisa, Uniswap, My Wallet"
                    placeholderTextColor="#666666"
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                </View>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Contract Address</Text>
                  <TextInput
                    style={styles.textInput}
                    value={newTargetAddress}
                    onChangeText={setNewTargetAddress}
                    placeholder="0x..."
                    placeholderTextColor="#666666"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                
                <View style={styles.targetModalNote}>
                  <IconSymbol name="info.circle" size={16} color="#8B5CF6" />
                  <Text style={styles.targetModalNoteText}>
                    Make sure the address is a valid smart contract on the network you're using.
                  </Text>
                </View>
              </View>
              
              <View style={styles.targetModalButtons}>
                <TouchableOpacity
                  style={styles.targetButtonSecondary}
                  onPress={() => setShowAddTarget(false)}
                >
                  <Text style={styles.targetButtonSecondaryText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.targetButtonPrimary}
                  onPress={addTargetAddress}
                >
                  <Text style={styles.targetButtonPrimaryText}>Add Address</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Action Selector Modal */}
        <Modal
          visible={showActionSelector}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowActionSelector(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.actionModal}>
              <View style={styles.actionModalHeader}>
                <Text style={styles.actionModalTitle}>Select Actions</Text>
                <TouchableOpacity
                  onPress={() => setShowActionSelector(false)}
                  style={styles.closeButton}
                >
                  <IconSymbol name="xmark" size={20} color="#666666" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.searchContainer}>
                <IconSymbol name="magnifyingglass" size={16} color="#666666" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search actions..."
                  placeholderTextColor="#666666"
                  value={actionSearchQuery}
                  onChangeText={setActionSearchQuery}
                />
              </View>
              
              <ScrollView style={styles.actionList}>
                {filteredActions.map((action) => (
                  <TouchableOpacity
                    key={action.id}
                    style={[
                      styles.actionListItem,
                      callPolicySettings.allowedActions.includes(action.id) && styles.actionListItemSelected
                    ]}
                    onPress={() => addAction(action.id)}
                    disabled={callPolicySettings.allowedActions.includes(action.id)}
                  >
                    <View style={styles.actionListItemContent}>
                      <View style={styles.actionListItemHeader}>
                        <Text style={[
                          styles.actionListItemName,
                          callPolicySettings.allowedActions.includes(action.id) && styles.actionListItemNameSelected
                        ]}>
                          {action.name}
                        </Text>
                        <View style={[
                          styles.actionListItemBadge,
                          action.category === 'transfer' && styles.transferBadge,
                          action.category === 'approve' && styles.approveBadge,
                          action.category === 'swap' && styles.swapBadge,
                          action.category === 'stake' && styles.stakeBadge,
                          action.category === 'other' && styles.otherBadge
                        ]}>
                          <Text style={styles.actionListItemBadgeText}>{action.category}</Text>
                        </View>
                      </View>
                      <Text style={styles.actionListItemDescription}>{action.description}</Text>
                      <Text style={styles.actionListItemSelector}>Selector: {action.selector}</Text>
                    </View>
                    {callPolicySettings.allowedActions.includes(action.id) && (
                      <IconSymbol name="checkmark" size={20} color="#10B981" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Transfer Options Modal */}
        <Modal
          visible={showTransferOptions}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowTransferOptions(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.transferModal}>
              <View style={styles.transferModalHeader}>
                <Text style={styles.transferModalTitle}>Transfer Options</Text>
                <TouchableOpacity
                  onPress={() => setShowTransferOptions(false)}
                  style={styles.closeButton}
                >
                  <IconSymbol name="xmark" size={20} color="#666666" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.transferOptionsContainer}>
                <Text style={styles.transferOptionsDescription}>
                  Choose what types of transfers this delegated key can perform:
                </Text>
                
                <TouchableOpacity
                  style={[
                    styles.transferOption,
                    transferOptions.eth && styles.transferOptionSelected
                  ]}
                  onPress={() => {
                    // Prevent unchecking if it's the only option selected
                    if (transferOptions.eth && !transferOptions.erc20) {
                      return;
                    }
                    setTransferOptions(prev => ({ ...prev, eth: !prev.eth }));
                  }}
                >
                  <View style={styles.transferOptionContent}>
                    <IconSymbol 
                      name="bitcoinsign.circle.fill" 
                      size={24} 
                      color={transferOptions.eth ? '#10B981' : '#666666'} 
                    />
                    <View style={styles.transferOptionText}>
                      <Text style={[
                        styles.transferOptionTitle,
                        transferOptions.eth && styles.transferOptionTitleSelected
                      ]}>
                        ETH Transfers
                      </Text>
                      <Text style={styles.transferOptionDescription}>
                        Send native ETH to any address
                      </Text>
                    </View>
                    <View style={[
                      styles.checkbox,
                      transferOptions.eth && styles.checkboxSelected
                    ]}>
                      {transferOptions.eth && (
                        <IconSymbol name="checkmark" size={16} color="#FFFFFF" />
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.transferOption,
                    transferOptions.erc20 && styles.transferOptionSelected
                  ]}
                  onPress={() => {
                    // Prevent unchecking if it's the only option selected
                    if (transferOptions.erc20 && !transferOptions.eth) {
                      return;
                    }
                    setTransferOptions(prev => ({ ...prev, erc20: !prev.erc20 }));
                  }}
                >
                  <View style={styles.transferOptionContent}>
                    <IconSymbol 
                      name="dollarsign.circle.fill" 
                      size={24} 
                      color={transferOptions.erc20 ? '#10B981' : '#666666'} 
                    />
                    <View style={styles.transferOptionText}>
                      <Text style={[
                        styles.transferOptionTitle,
                        transferOptions.erc20 && styles.transferOptionTitleSelected
                      ]}>
                        ERC20 Token Transfers
                      </Text>
                      <Text style={styles.transferOptionDescription}>
                        Send ERC20 tokens to any address
                      </Text>
                    </View>
                    <View style={[
                      styles.checkbox,
                      transferOptions.erc20 && styles.checkboxSelected
                    ]}>
                      {transferOptions.erc20 && (
                        <IconSymbol name="checkmark" size={16} color="#FFFFFF" />
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
              
              <View style={styles.transferModalFooter}>
                <TouchableOpacity
                  style={styles.transferCancelButton}
                  onPress={() => setShowTransferOptions(false)}
                >
                  <Text style={styles.transferCancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.transferConfirmButton}
                  onPress={confirmTransferOptions}
                >
                  <Text style={styles.transferConfirmButtonText}>
                    Confirm
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Token Selector Modal */}
        <Modal
          visible={showTokenSelector}
          transparent={true}
          animationType="slide"
          onRequestClose={() => {
            setShowTokenSelector(false);
            setTokenSearch('');
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.tokenModal}>
              <View style={styles.tokenModalHeader}>
                <Text style={styles.tokenModalTitle}>Select Supported Tokens</Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowTokenSelector(false);
                    setTokenSearch('');
                  }}
                  style={styles.closeButton}
                >
                  <IconSymbol name="xmark" size={20} color="#666666" />
                </TouchableOpacity>
              </View>

              <View style={styles.searchContainer}>
                <IconSymbol name="magnifyingglass" size={16} color="#666666" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search tokens..."
                  placeholderTextColor="#666666"
                  value={tokenSearch}
                  onChangeText={setTokenSearch}
                />
              </View>

              <ScrollView
                style={styles.tokenList}
                contentContainerStyle={styles.tokenListContent}
              >
                {filteredTokenOptions.map((token) => {
                  const selected = isTokenSelected(token);
                  return (
                    <TouchableOpacity
                      key={token.address}
                      style={[
                        styles.tokenItem,
                        selected && styles.tokenItemSelected
                      ]}
                      onPress={() => toggleTokenSelection(token)}
                    >
                      <View style={[styles.tokenBadge, { backgroundColor: token.color || '#4B5563' }]} />
                      <View style={styles.limitInfo}>
                        <Text style={[
                          styles.tokenName,
                          selected && styles.tokenNameSelected
                        ]}>
                          {token.name} ({token.symbol})
                        </Text>
                        <Text style={styles.tokenMeta}>Decimals: {token.decimals}</Text>
                        <Text style={styles.limitText}>Tap to {selected ? 'remove' : 'add'} this token</Text>
                      </View>
                      <View style={[
                        styles.checkbox,
                        selected && styles.checkboxSelected
                      ]}>
                        {selected && <IconSymbol name="checkmark" size={16} color="#FFFFFF" />}
                      </View>
                    </TouchableOpacity>
                  );
                })}

                {filteredTokenOptions.length === 0 && (
                  <Text style={styles.emptyStateText}>No supported tokens match your search.</Text>
                )}
              </ScrollView>

              <View style={styles.tokenModalFooter}>
                <TouchableOpacity
                  style={styles.tokenModalButton}
                  onPress={() => {
                    setTokenSearch('');
                    setShowTokenSelector(false);
                  }}
                >
                  <Text style={styles.tokenModalButtonText}>Done</Text>
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
                    <Text style={styles.confirmationAddressText} numberOfLines={0}>{pendingKeyPair.address}</Text>
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
  inputErrorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
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
  subsectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  requiredIndicator: {
    fontSize: 12,
    fontWeight: '500',
    color: '#EF4444',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#A0A0A0',
    marginTop: 8,
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
  selectTokenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#333333',
    borderStyle: 'dashed',
    marginTop: 8,
  },
  selectTokenButtonText: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '500',
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
  tokenName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E5E7EB',
  },
  tokenNameSelected: {
    color: '#10B981',
  },
  tokenAddress: {
    fontSize: 12,
    color: '#A0A0A0',
    fontFamily: 'monospace',
  },
  tokenMeta: {
    fontSize: 12,
    color: '#A0A0A0',
  },
  tokenLimitsContainer: {
    gap: 12,
    marginTop: 12,
  },
  tokenLimitCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333333',
    padding: 12,
    gap: 12,
  },
  tokenLimitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  limitRow: {
    flexDirection: 'row',
    gap: 12,
  },
  limitField: {
    flex: 1,
    gap: 6,
  },
  limitLabel: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  limitInput: {
    backgroundColor: '#111827',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 10,
    color: '#FFFFFF',
  },
  tokenList: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 4,
  },
  tokenListContent: {
    gap: 12,
  },
  tokenItem: {
    borderWidth: 1,
    borderColor: '#333333',
    backgroundColor: '#1A1A1A',
    padding: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tokenItemSelected: {
    borderColor: '#10B981',
    backgroundColor: '#0F1A0F',
  },
  tokenBadge: {
    width: 10,
    height: 10,
    borderRadius: 5,
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
    flexWrap: 'wrap',
  },
  confirmationAddressText: {
    flex: 1,
    fontSize: 12,
    color: '#FFFFFF',
    fontFamily: 'monospace',
    backgroundColor: '#1A1A1A',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
    lineHeight: 16,
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
  
  // Simplified progress styles
  simpleProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  stepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#333333',
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 10,
  },
  stepCircleActive: {
    borderColor: '#007AFF',
    backgroundColor: '#001A3A',
  },
  stepCircleCompleted: {
    borderColor: '#34C759',
    backgroundColor: '#003A1A',
  },
  stepText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
    textAlign: 'center',
  },
  stepTextActive: {
    color: '#007AFF',
  },
  stepTextCompleted: {
    color: '#34C759',
    fontSize: 16,
  },
  stepArrow: {
    marginHorizontal: 5,
  },
  stepArrowText: {
    fontSize: 16,
    color: '#666666',
  },
  progressMessageContainer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333333',
  },
  progressMessage: {
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#333333',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 3,
  },
  progressPercentage: {
    fontSize: 12,
    color: '#A0A0A0',
    fontWeight: '600',
    minWidth: 35,
  },
  transactionStatusContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#0F0F0F',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  transactionStatusText: {
    fontSize: 12,
    color: '#A0A0A0',
    fontFamily: 'monospace',
    textAlign: 'center',
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
  
  // CallPolicy Styles
  advancedBadge: {
    backgroundColor: '#1A0A2E',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#8B5CF6',
  },
  advancedBadgeSelected: {
    backgroundColor: '#8B5CF6',
  },
  advancedText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  advancedTextSelected: {
    color: '#FFFFFF',
  },
  
  // Target Address Styles
  targetList: {
    marginTop: 12,
  },
  targetItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  targetInfo: {
    flex: 1,
  },
  targetName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  targetAddress: {
    fontSize: 12,
    color: '#A0A0A0',
    fontFamily: 'monospace',
  },
  addTargetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0F1A0F',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#10B981',
    marginTop: 12,
  },
  addTargetText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  
  // Actions Grid Styles
  actionsGrid: {
    marginTop: 12,
  },
  actionItem: {
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  actionItemSelected: {
    backgroundColor: '#0F1A0F',
    borderColor: '#10B981',
  },
  actionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  actionName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionNameSelected: {
    color: '#10B981',
  },
  actionBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  transferBadge: {
    backgroundColor: '#1A0A2E',
  },
  approveBadge: {
    backgroundColor: '#1A2E0A',
  },
  swapBadge: {
    backgroundColor: '#2E1A0A',
  },
  stakeBadge: {
    backgroundColor: '#0A1A2E',
  },
  otherBadge: {
    backgroundColor: '#2E2E2E',
  },
  actionBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionDescription: {
    fontSize: 12,
    color: '#A0A0A0',
  },
  
  // Limits Styles
  limitsContainer: {
    marginTop: 12,
  },
  limitItem: {
    marginBottom: 16,
  },
  limitLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  limitInput: {
    backgroundColor: '#0F0F0F',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#333333',
    fontSize: 14,
    color: '#FFFFFF',
  },
  limitInputError: {
    borderColor: '#EF4444',
  },
  
  // Summary Styles
  summaryContainer: {
    backgroundColor: '#0F1A0F',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
    marginBottom: 4,
  },
  summaryText: {
    fontSize: 12,
    color: '#A0A0A0',
    lineHeight: 16,
  },
  
  // Target Modal Styles
  targetModal: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    margin: 20,
    maxHeight: '75%',
    borderWidth: 1,
    borderColor: '#333333',
  },
  targetModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  targetModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  targetModalContent: {
    padding: 20,
  },
  targetModalDescription: {
    fontSize: 14,
    color: '#A0A0A0',
    marginBottom: 20,
    lineHeight: 20,
  },
  targetModalNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#1A0A2E',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#8B5CF6',
  },
  targetModalNoteText: {
    flex: 1,
    fontSize: 12,
    color: '#A0A0A0',
    lineHeight: 16,
  },
  targetModalButtons: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  targetButtonSecondary: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#333333',
    alignItems: 'center',
  },
  targetButtonSecondaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#A0A0A0',
  },
  targetButtonPrimary: {
    flex: 1,
    backgroundColor: '#10B981',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  targetButtonPrimaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  
  // Missing styles
  subsectionDescription: {
    fontSize: 12,
    color: '#A0A0A0',
    marginBottom: 12,
    lineHeight: 16,
  },
  closeButton: {
    padding: 4,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#0F0F0F',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#333333',
    fontSize: 14,
    color: '#FFFFFF',
  },
  
  // Selected Actions Styles
  selectedActionsContainer: {
    marginBottom: 12,
  },
  selectedActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  
  // Transfer Card Styles
  transferCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333333',
  },
  transferCardEnabled: {
    borderColor: '#10B981',
    backgroundColor: '#0F1A0F',
  },
  transferCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  transferCardInfo: {
    flex: 1,
  },
  transferCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 4,
  },
  transferCardTitleEnabled: {
    color: '#FFFFFF',
  },
  transferCardDescription: {
    fontSize: 12,
    color: '#CCCCCC',
    marginBottom: 8,
  },
  transferStatusContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  transferStatusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  transferStatusText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
  },
  transferCardControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  transferToggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#333333',
    padding: 2,
    justifyContent: 'center',
  },
  transferToggleEnabled: {
    backgroundColor: '#10B981',
  },
  transferToggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
  },
  transferToggleThumbEnabled: {
    alignSelf: 'flex-end',
  },
  transferSettingsButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0F0F0F',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  selectedActionInfo: {
    flex: 1,
  },
  selectedActionName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  selectedActionDescription: {
    fontSize: 12,
    color: '#A0A0A0',
  },
  removeActionButton: {
    padding: 4,
  },
  addActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#333333',
    borderStyle: 'dashed',
  },
  addActionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#10B981',
    marginLeft: 8,
  },
  
  // Action Selector Modal Styles
  actionModal: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    margin: 40,
    maxHeight: '70%',
    minHeight: '50%',
    width: '90%',
    alignSelf: 'center',
  },
  actionModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  actionModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F0F0F',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    margin: 20,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#333333',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
    marginLeft: 8,
  },
  actionList: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  actionListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F0F0F',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  actionListItemSelected: {
    backgroundColor: '#1A2E0A',
    borderColor: '#10B981',
  },
  actionListItemContent: {
    flex: 1,
  },
  actionListItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  actionListItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionListItemNameSelected: {
    color: '#10B981',
  },
  actionListItemBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  actionListItemBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionListItemDescription: {
    fontSize: 12,
    color: '#A0A0A0',
    marginBottom: 2,
  },
  actionListItemSelector: {
    fontSize: 10,
    color: '#666666',
    fontFamily: 'monospace',
  },

  // Token Selector Modal Styles
  tokenModal: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    margin: 20,
    maxHeight: '75%',
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#333333',
  },
  tokenModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  tokenModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  tokenModalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  tokenModalButton: {
    backgroundColor: '#10B981',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  tokenModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  
  // Transfer Options Modal Styles
  transferModal: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    margin: 40,
    maxHeight: '60%',
    width: '90%',
    alignSelf: 'center',
  },
  transferModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  transferModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  transferOptionsContainer: {
    padding: 20,
  },
  transferOptionsDescription: {
    fontSize: 14,
    color: '#CCCCCC',
    marginBottom: 20,
    lineHeight: 20,
  },
  transferOption: {
    backgroundColor: '#0F0F0F',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333333',
  },
  transferOptionSelected: {
    borderColor: '#10B981',
    backgroundColor: '#0F1A0F',
  },
  transferOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transferOptionText: {
    flex: 1,
    marginLeft: 12,
  },
  transferOptionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  transferOptionTitleSelected: {
    color: '#10B981',
  },
  transferOptionDescription: {
    fontSize: 12,
    color: '#CCCCCC',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#333333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  transferModalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#333333',
    gap: 12,
  },
  transferCancelButton: {
    flex: 1,
    backgroundColor: '#333333',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  transferCancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  transferConfirmButton: {
    flex: 1,
    backgroundColor: '#10B981',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  transferConfirmButtonDisabled: {
    backgroundColor: '#333333',
  },
  transferConfirmButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  transferConfirmButtonTextDisabled: {
    color: '#666666',
  },
});
