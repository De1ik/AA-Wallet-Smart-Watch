import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { IconSymbol } from '@/shared/ui/icon-symbol';
import { apiClient } from '@/services/api/apiClient';
import { wsClient } from '@/services/api/websocketClient';
import { TokenLimit, DelegatedKeyData, saveDelegatedKey, updateDelegatedKey, CallPolicyPermission, CallPolicyParamRule, CallPolicyParamCondition, PredefinedAction, CallPolicySettings, TokenOption, TokenSelection } from '@/modules/delegated-keys/services/delegatedKeys';
import { useSmartWatch } from '@/shared/hooks/useSmartWatch';
import { WatchKeyPair, WatchPermissionData, smartWatchBridge } from '@/services/native/smartWatchBridge';
import { getKernelAddress } from '@/config/env';
import { installationState } from '@/services/storage/installationState';
import { InstallPrepareSuccess, PermissionPolicyType, PermissionTokenEntry, RequestCreateDelegateKey } from '@/domain/types';
import { buildPermissionTokenEntries as buildPermissionTokenEntriesHelper, generateCallPolicyPermissions, logCallPolicyDebug, TransferOptions } from './callPolicyBuilders';
import { PREDEFINED_ACTIONS, SUPPORTED_TOKENS } from '@/shared/constants/appConstants';
import { styles } from './styles';
import { HeaderBar } from './components/HeaderBar';
import { ConnectionSection } from './components/ConnectionSection';
import { DeviceNameSection } from './components/DeviceNameSection';
import { KeyTypeSelector } from './components/KeyTypeSelector';
import { SudoWarningModal } from './components/SudoWarningModal';
import { AddTargetModal } from './components/AddTargetModal';
import { ActionSelectorModal } from './components/ActionSelectorModal';
import { TransferOptionsModal } from './components/TransferOptionsModal';
import { TokenSelectorModal } from './components/TokenSelectorModal';
import { AddressConfirmationModal } from './components/AddressConfirmationModal';
import { RestrictedSettings } from './components/RestrictedSettings';
import { useWallet } from '@/modules/account/state/WalletContext';
import { ErrorResponse, InstallPrepareInput } from '@/services/api/apiTypes';
import { debugLog, isInstallPrepareSuccess } from '@/services/api/helpers';
import { Address } from 'viem';
import { useNotifications } from '@/shared/contexts/NotificationContext';
import { transactionReviewState, InstallReviewPayload } from '@/services/storage/transactionReviewState';

const BLOCKCHAIN_LOADER_FRAMES = ['.', '..', '...', ''];
const BLOCKCHAIN_STATUS_MESSAGES = [
  'Creating on Blockchain',
  'Signing transactions bundle',
  'Waiting for relayer ack',
  'Finalizing user operation',
];

const snapshotCallPolicySettings = (settings: CallPolicySettings): CallPolicySettings =>
  JSON.parse(JSON.stringify(settings)) as CallPolicySettings;

export default function CreateDelegatedKeyScreen() {
  const [keyType, setKeyType] = useState<PermissionPolicyType>(PermissionPolicyType.CALL_POLICY);
  const [deviceName, setDeviceName] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [blockchainLoaderFrame, setBlockchainLoaderFrame] = useState(0);
  const [blockchainStatusIndex, setBlockchainStatusIndex] = useState(0);
  const [showSudoWarning, setShowSudoWarning] = useState(false);
  const [showRestrictedSettings, setShowRestrictedSettings] = useState(false);
  const [generatedKeyPair, setGeneratedKeyPair] = useState<WatchKeyPair | null>(null);
  const [showAddressConfirmation, setShowAddressConfirmation] = useState(false);
  const [pendingKeyPair, setPendingKeyPair] = useState<WatchKeyPair | null>(null);
  const [isAborting, setIsAborting] = useState(false);
  const { wallet } = useWallet();
  const { showError, showSuccess, showInfo } = useNotifications();

  useEffect(() => {
    if (isConnecting && generatedKeyPair) {
      setBlockchainStatusIndex(0);
      const frameInterval = setInterval(() => {
        setBlockchainLoaderFrame((prev) => (prev + 1) % BLOCKCHAIN_LOADER_FRAMES.length);
      }, 450);
      const statusInterval = setInterval(() => {
        setBlockchainStatusIndex((prev) => (prev + 1) % BLOCKCHAIN_STATUS_MESSAGES.length);
      }, 1400);
      return () => {
        clearInterval(frameInterval);
        clearInterval(statusInterval);
      };
    }

    setBlockchainLoaderFrame(0);
    setBlockchainStatusIndex(0);
  }, [isConnecting, generatedKeyPair]);

  const generatePermissions = (delegatedKey: string) =>
    generateCallPolicyPermissions(
      delegatedKey,
      callPolicySettings,
      transferOptions,
      transferEnabled,
      PREDEFINED_ACTIONS
    );
  
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
  const [transferOptions, setTransferOptions] = useState<TransferOptions>({
    eth: true,
    erc20: false
  });
  const [transferEnabled, setTransferEnabled] = useState(true);
  const [showTokenSelector, setShowTokenSelector] = useState(false);
  const [tokenSearch, setTokenSearch] = useState('');

  // ----------------- HANDLERS -----------------

  const handleKeyTypeSelect = (type: PermissionPolicyType) => {
    if (type === PermissionPolicyType.SUDO) {
      setShowSudoWarning(true);
    } else {
      setKeyType(type);
      if (type === PermissionPolicyType.CALL_POLICY) {
        setShowCallPolicySettings(true); // Use CallPolicy settings for restricted
      }
    }
  };

  const handleSudoWarningConfirm = () => {
    setKeyType(PermissionPolicyType.SUDO);
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
        console.log('[create-key] -> Sent START_INSTALLATION message to watch');
      } catch (error) {
        console.error('[create-key] -> Failed to send START_INSTALLATION to watch:', error);
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
          totalSteps: keyType === PermissionPolicyType.SUDO ? 3 : 4, // sudo: install, grant, save | restricted: install, enable, grant, save
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
      showError('Please enter a name for this address');
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
      showError('Please enter a valid Ethereum address (0x...)');
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
      setShowActionSelector(false);
      setShowTransferOptions(true);
      return;
    }

    if (!callPolicySettings.allowedActions.includes(actionId)) {
      setCallPolicySettings(prev => ({
        ...prev,
        allowedActions: [...prev.allowedActions, actionId]
      }));
    }

    // Keep the selector open so multiple actions can be added in one session
    setActionSearchQuery('');
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

  const filteredActions = PREDEFINED_ACTIONS.filter(action =>
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
      const currentDaily = parseFloat(callPolicySettings.maxValuePerDay);
      if (!Number.isNaN(currentDaily) && currentDaily > 0 && currentDaily < numValue) {
        setMaxValuePerDayError('Daily limit must be greater than or equal to per transaction limit');
      } else {
        setMaxValuePerDayError('');
      }
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
    } else if (!isNaN(parseFloat(callPolicySettings.maxValuePerTx)) && numValue < parseFloat(callPolicySettings.maxValuePerTx)) {
      setMaxValuePerDayError('Daily limit must be greater than or equal to per transaction limit');
    } else {
      setMaxValuePerDayError('');
    }
  };

  // Validation for Restricted settings (using CallPolicy)
  const isRestrictedValid = () => {
    if (keyType !== PermissionPolicyType.CALL_POLICY) return true;

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

  const buildPermissionTokenEntries = (delegatedKey: string): PermissionTokenEntry[] =>
    buildPermissionTokenEntriesHelper(
      delegatedKey,
      callPolicySettings,
      transferOptions,
      transferEnabled,
      PREDEFINED_ACTIONS
    );

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

      // Start global installation state tracking so progress screen can be shown later
      installationState.startInstallation(deviceId, deviceName.trim(), keyType);

      // Check prefund first (track errors instead of throwing)
      try {
        const prefundCheck = await apiClient.checkPrefund(wallet?.smartWalletAddress);
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
      const permissionEntries = buildPermissionTokenEntriesHelper(
        delegatedEOA,
        callPolicySettings,
        transferOptions,
        transferEnabled,
        PREDEFINED_ACTIONS
      );
      const kernelAddress = wallet!.smartWalletAddress!;
      const requestData: InstallPrepareInput = {
        delegatedAddress: delegatedEOA,
        keyType,
        clientId,
        permissions: {
          permissions: permissionEntries,
        } as RequestCreateDelegateKey,
        kernelAddress,
      };
      
      // Log CallPolicy restrictions being sent
      if (keyType === PermissionPolicyType.CALL_POLICY) {
        logCallPolicyDebug(keyType, callPolicySettings, transferOptions, transferEnabled, permissionEntries.map(p => ({
          ...p.permission,
          valueLimit: p.tokenLimitEntry.limit.txLimit,
          dailyLimit: p.tokenLimitEntry.limit.dailyLimit
        })), PREDEFINED_ACTIONS);
      }

      debugLog(`[CreateKey] Sending installation prepare request for device ${deviceId}:`, requestData);
      
      const result: InstallPrepareSuccess | ErrorResponse  = await apiClient.prepareDelegatedKeyInstall(requestData);

      debugLog(`[CreateKey] Installation prepare result for device ${deviceId}:`, result);

      if (!isInstallPrepareSuccess(result)) {
        console.error("Installation failed:", result.error);
        return;
      }
      
      const {
        permissionPolicyType,
        unsignedPermissionPolicyData,
        unsignedGrantAccessData,
        unsignedRecipientListData,
        unsignedTokenListData,
      } = result.data;

      const reviewPayload: InstallReviewPayload = {
        deviceId,
        deviceName: deviceName.trim(),
        delegatedAddress: delegatedEOA as Address,
        kernelAddress: kernelAddress as Address,
        clientId: clientId!,
        permissionPolicyType,
        unsignedPermissionPolicyData,
        unsignedGrantAccessData,
        unsignedRecipientListData,
        unsignedTokenListData,
        installationId: result.installationId,
        callPolicySettingsSnapshot: snapshotCallPolicySettings(callPolicySettings),
      };
      transactionReviewState.set({
        kind: 'delegated-installation',
        payload: reviewPayload,
      });
      setIsConnecting(false);
      showInfo('Review the installation details before signing the transactions.', { title: 'Review required' });
      router.push('/settings/smart-watch-connection/transaction-review');
      return;


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
        ...(keyType === PermissionPolicyType.CALL_POLICY && {
          callPolicyPermissions: generatePermissions(keyPair.address)
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
          name: t.name,
          decimals: t.decimals,
        })),
        allowedRecipients: callPolicySettings.allowedTargets.map(t => t.address),
      };

      await syncPermissionData(watchPermissionData);
      console.log('Permission data synced to smart watch successfully!');

      const keyTypeDisplay =
        keyType === PermissionPolicyType.SUDO
          ? 'Sudo Access'
          : keyType === PermissionPolicyType.CALL_POLICY
          ? 'Restricted Access'
          : 'CallPolicy Access';
      showSuccess(
        `Delegated key created for ${deviceName} (${keyTypeDisplay}). Key: ${keyPair.address.slice(
          0,
          10
        )}…\nYour smart watch can now perform transactions on your behalf.`,
        { title: 'Success!' }
      );
      wsClient.disconnect();
      router.back();
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
    
    if (showRetryOption) {
      wsClient.resetConnection();
    } else {
      wsClient.disconnect();
    }
    setIsConnecting(false);
    if (shouldNavigateBackToCreate) {
      router.back();
    }

    showError(userFriendlyMessage, { title });
  };

  const handleCreateKey = async () => {
    if (!deviceName.trim()) {
      showError('Please enter a device name');
      return;
    }

    if (!isWatchConnected) {
      showError('Smart watch is not connected. Please ensure your Apple Watch is connected and try again.');
      return;
    }

    // Validate Restricted settings (using CallPolicy)
    if (keyType === PermissionPolicyType.CALL_POLICY) {
      const numTxValue = parseFloat(callPolicySettings.maxValuePerTx);
      const numDayValue = parseFloat(callPolicySettings.maxValuePerDay);
      const hasTransferAction = callPolicySettings.allowedActions.includes('transfer') && transferEnabled;
      const needsEthTargets = hasTransferAction && transferOptions.eth;
      const needsErc20Tokens = hasTransferAction && transferOptions.erc20;
      const hasNonTransferActions = callPolicySettings.allowedActions.some(id => id !== 'transfer');

      if (hasNonTransferActions && callPolicySettings.allowedTargets.length === 0) {
        showError('Please add at least one allowed target address for the selected actions');
        return;
      }
      if (needsEthTargets && callPolicySettings.allowedTargets.length === 0) {
        showError('Please add at least one allowed target address for ETH transfers');
        return;
      }
      if (needsErc20Tokens && callPolicySettings.allowedTokens.length === 0) {
        showError('Please select at least one ERC20 token to allow transfers');
        return;
      }
      if (needsErc20Tokens) {
        const invalidToken = callPolicySettings.allowedTokens.find(
          t => isNaN(parseFloat(t.maxValuePerTx)) || parseFloat(t.maxValuePerTx) <= 0 ||
               isNaN(parseFloat(t.maxValuePerDay)) || parseFloat(t.maxValuePerDay) <= 0
        );
        if (invalidToken) {
          showError(`Please set valid limits for ${invalidToken.symbol} (per tx and per day must be > 0)`);
          return;
        }

        const invalidDailyGap = callPolicySettings.allowedTokens.find((t) => {
          const perTx = parseFloat(t.maxValuePerTx);
          const perDay = parseFloat(t.maxValuePerDay);
          return !isNaN(perTx) && !isNaN(perDay) && perDay < perTx;
        });
        if (invalidDailyGap) {
          showError(`${invalidDailyGap.symbol}: daily limit must be greater than or equal to the per transaction limit`);
          return;
        }
      }

      if (!callPolicySettings.maxValuePerTx || 
          callPolicySettings.maxValuePerTx === '0' || 
          callPolicySettings.maxValuePerTx === '' ||
          callPolicySettings.maxValuePerTx === '.' ||
          isNaN(numTxValue) ||
          numTxValue <= 0) {
        showError('Please set a valid maximum transaction amount greater than 0');
        return;
      }
      
      if (!callPolicySettings.maxValuePerDay || 
          callPolicySettings.maxValuePerDay === '0' || 
          callPolicySettings.maxValuePerDay === '' ||
          callPolicySettings.maxValuePerDay === '.' ||
          isNaN(numDayValue) ||
          numDayValue <= 0) {
        showError('Please set a valid maximum daily amount greater than 0');
        return;
      }

      if (callPolicySettings.allowedActions.length === 0) {
        showError('Please select at least one action');
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
      let kernelAddress = wallet?.smartWalletAddress;
      
      // Temporary fallback for debugging
      if (!kernelAddress) {
        console.log('[create-key] -> KERNEL not found in config, using fallback');
          showError('Kernel address is not configured. Please set KERNEL in your environment.', {
            title: 'Configuration error',
          });
          return;
      }

      console.log('[create-key] -> kernelAddress:', kernelAddress);
      
      // Prepare whitelist data if it's a restricted key type
      const whitelist = keyType === PermissionPolicyType.CALL_POLICY && callPolicySettings.allowedTargets.length > 0
        ? callPolicySettings.allowedTargets.map(target => ({ name: target.name, address: target.address }))
        : undefined;
      
      console.log('[create-key] -> whitelist:', whitelist);
      const keyPair = await requestKeyGeneration({ 
        kernelAddress,
        whitelist,
        allowedTokens: callPolicySettings.allowedTokens.map(t => ({
          address: t.address,
          symbol: t.symbol,
          name: t.name,
          decimals: t.decimals,
        }))
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
      
      showError(`Failed to generate key pair: ${errorMessage}\n\nPlease try again.`);
      setIsConnecting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <HeaderBar />
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <ConnectionSection
              isWatchConnected={isWatchConnected}
              isWatchLoading={isWatchLoading}
              watchError={watchError}
              checkConnection={checkConnection}
            />

            <DeviceNameSection
              deviceName={deviceName}
              setDeviceName={setDeviceName}
              isWatchConnected={isWatchConnected}
            />

            {/* <KeyTypeSelector
              keyType={keyType}
              isWatchConnected={isWatchConnected}
              onSelect={handleKeyTypeSelect}
            /> */}

            {/* Restricted Settings (CallPolicy) */}
            {isWatchConnected && (
          <RestrictedSettings
            callPolicySettings={callPolicySettings}
            setCallPolicySettings={setCallPolicySettings}
            transferOptions={transferOptions}
            transferEnabled={transferEnabled}
            maxValuePerTxError={maxValuePerTxError}
            maxValuePerDayError={maxValuePerDayError}
            removeTargetAddress={removeTargetAddress}
            toggleTokenSelection={toggleTokenSelection}
            setShowTokenSelector={setShowTokenSelector}
            setTokenSearch={setTokenSearch}
            setShowAddTarget={setShowAddTarget}
              handleTransferToggle={handleTransferToggle}
              handleTransferCardClick={handleTransferCardClick}
              removeAction={removeAction}
              addAction={addAction}
              setShowActionSelector={setShowActionSelector}
              handleMaxValuePerTxChange={handleMaxValuePerTxChange}
              handleMaxValuePerDayChange={handleMaxValuePerDayChange}
            />
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
                generatedKeyPair ? (
                  <>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.createButtonText}>
                      {`${BLOCKCHAIN_STATUS_MESSAGES[blockchainStatusIndex]}${BLOCKCHAIN_LOADER_FRAMES[blockchainLoaderFrame]}`}
                    </Text>
                  </>
                ) : (
                  <>
                    <IconSymbol name="arrow.clockwise" size={20} color="#FFFFFF" />
                    <Text style={styles.createButtonText}>Requesting Keys from Watch...</Text>
                  </>
                )
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
        <SudoWarningModal
          visible={showSudoWarning}
          onCancel={handleSudoWarningCancel}
          onConfirm={handleSudoWarningConfirm}
        />

        {/* Add Target Address Modal */}
        <AddTargetModal
          visible={showAddTarget}
          newTargetName={newTargetName}
          newTargetAddress={newTargetAddress}
          onChangeName={setNewTargetName}
          onChangeAddress={setNewTargetAddress}
          onAdd={addTargetAddress}
          onClose={() => setShowAddTarget(false)}
        />

        {/* Action Selector Modal */}
        <ActionSelectorModal
          visible={showActionSelector}
          onClose={() => setShowActionSelector(false)}
          actions={filteredActions}
          allowedActions={callPolicySettings.allowedActions}
          searchQuery={actionSearchQuery}
          setSearchQuery={setActionSearchQuery}
          onSelectAction={addAction}
        />

        {/* Transfer Options Modal */}
        <TransferOptionsModal
          visible={showTransferOptions}
          transferOptions={transferOptions}
          setTransferOptions={setTransferOptions}
          onClose={() => setShowTransferOptions(false)}
          onConfirm={confirmTransferOptions}
        />

        {/* Token Selector Modal */}
        <TokenSelectorModal
          visible={showTokenSelector}
          onClose={() => { setShowTokenSelector(false); setTokenSearch(''); }}
          tokenSearch={tokenSearch}
          setTokenSearch={setTokenSearch}
          filteredTokens={filteredTokenOptions}
          isSelected={isTokenSelected}
          onToggle={toggleTokenSelection}
        />

        {/* Address Confirmation Modal */}
        <AddressConfirmationModal
          visible={showAddressConfirmation}
          pendingKeyPair={pendingKeyPair}
          onCancel={() => handleAddressConfirmation(false)}
          onConfirm={() => handleAddressConfirmation(true)}
        />

    </SafeAreaView>
  );
}
