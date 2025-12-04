import React from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { IconSymbol } from '@/shared/ui/icon-symbol';
import { styles } from '../styles';
import { CallPolicySettings, TokenOption } from '@/modules/delegated-keys/services/delegatedKeys';
import { TransferOptions } from '../callPolicyBuilders';
import { PREDEFINED_ACTIONS } from '@/shared/constants/appConstants';

type Props = {
  callPolicySettings: CallPolicySettings;
  setCallPolicySettings: React.Dispatch<React.SetStateAction<CallPolicySettings>>;
  transferOptions: TransferOptions;
  transferEnabled: boolean;
  maxValuePerTxError: string;
  maxValuePerDayError: string;
  // handlers
  removeTargetAddress: (idx: number) => void;
  toggleTokenSelection: (token: TokenOption) => void;
  setShowTokenSelector: (val: boolean) => void;
  setTokenSearch: (val: string) => void;
  setShowAddTarget: (val: boolean) => void;
  handleTransferToggle: () => void;
  handleTransferCardClick: () => void;
  removeAction: (id: string) => void;
  addAction: (id: string) => void;
  setShowActionSelector: (val: boolean) => void;
  handleMaxValuePerTxChange: (val: string) => void;
  handleMaxValuePerDayChange: (val: string) => void;
};

const sanitizeNumericInput = (val: string) => val.replace(/[^0-9.]/g, '');
const isValidPositiveNumber = (val: string) => {
  if (!val || val === '.' || isNaN(Number(val))) return false;
  return Number(val) > 0;
};
const isDailyNotLessThanTx = (tx: string, daily: string) => {
  if (!isValidPositiveNumber(tx) || !isValidPositiveNumber(daily)) return false;
  return Number(daily) >= Number(tx);
};

export const RestrictedSettings = ({
  callPolicySettings,
  setCallPolicySettings,
  transferOptions,
  transferEnabled,
  maxValuePerTxError,
  maxValuePerDayError,
  removeTargetAddress,
  toggleTokenSelection,
  setShowTokenSelector,
  setTokenSearch,
  setShowAddTarget,
  handleTransferToggle,
  handleTransferCardClick,
  removeAction,
  setShowActionSelector,
  handleMaxValuePerTxChange,
  handleMaxValuePerDayChange,
}: Props) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>Restricted Access Settings</Text>
    <Text style={styles.sectionSubtitle}>Configure allowed targets, actions, and spending limits</Text>

    {/* Allowed Target Addresses */}
    <View style={styles.subsection}>
      <View style={styles.subsectionHeader}>
        <Text style={styles.subsectionTitle}>Allowed Target Addresses</Text>
        {callPolicySettings.allowedTargets.length === 0 && <Text style={styles.requiredIndicator}>* Required</Text>}
      </View>
      <Text style={styles.subsectionDescription}>Smart contracts your watch can interact with</Text>

      {callPolicySettings.allowedTargets.length > 0 && (
        <View style={styles.targetList}>
          {callPolicySettings.allowedTargets.map((target, index) => (
            <View key={index} style={styles.targetItem}>
              <View style={styles.targetInfo}>
                <Text style={styles.targetName}>{target.name}</Text>
                <Text style={styles.targetAddress}>{target.address}</Text>
              </View>
              <TouchableOpacity onPress={() => removeTargetAddress(index)} style={styles.removeButton}>
                <IconSymbol name="trash" size={16} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity onPress={() => setShowAddTarget(true)} style={styles.addTargetButton}>
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
      <Text style={styles.subsectionDescription}>Choose which tokens the watch can transfer</Text>

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
                onChangeText={(raw) => {
                  const val = sanitizeNumericInput(raw);
                  if (val && !isValidPositiveNumber(val)) return;
                  setCallPolicySettings((prev) => {
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
                onChangeText={(raw) => {
                  const val = sanitizeNumericInput(raw);
                  if (val && !isValidPositiveNumber(val)) return;
                  if (val && !isDailyNotLessThanTx(token.maxValuePerTx, val)) return;
                  setCallPolicySettings((prev) => {
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
      <Text style={styles.subsectionDescription}>Select the actions your watch can perform</Text>

      <View style={styles.selectedActionsContainer}>
        <View style={[styles.transferCard, transferEnabled && styles.transferCardEnabled]}>
          <View style={styles.transferCardHeader}>
            <View style={styles.transferCardInfo}>
              <Text style={[styles.transferCardTitle, transferEnabled && styles.transferCardTitleEnabled]}>
                Transfer
              </Text>
              <Text style={styles.transferCardDescription}>Send tokens to any address</Text>
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
                style={[styles.transferToggle, transferEnabled && styles.transferToggleEnabled]}
                onPress={handleTransferToggle}
              >
                <View style={[styles.transferToggleThumb, transferEnabled && styles.transferToggleThumbEnabled]} />
              </TouchableOpacity>
              {transferEnabled && (
                <TouchableOpacity onPress={handleTransferCardClick} style={styles.transferSettingsButton}>
                  <IconSymbol name="gearshape.fill" size={16} color="#10B981" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {callPolicySettings.allowedActions
          .filter((actionId) => actionId !== 'transfer')
          .map((actionId) => {
            const action = PREDEFINED_ACTIONS.find((a) => a.id === actionId);
            if (!action) return null;
            return (
              <View key={actionId} style={styles.selectedActionItem}>
                <View style={styles.selectedActionInfo}>
                  <Text style={styles.selectedActionName}>{action.name}</Text>
                  <Text style={styles.selectedActionDescription}>{action.description}</Text>
                </View>
                <TouchableOpacity onPress={() => removeAction(actionId)} style={styles.removeActionButton}>
                  <IconSymbol name="xmark" size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>
            );
          })}
      </View>

      <TouchableOpacity onPress={() => setShowActionSelector(true)} style={styles.addActionButton}>
        <IconSymbol name="plus" size={16} color="#10B981" />
        <Text style={styles.addActionText}>Add Action</Text>
      </TouchableOpacity>
    </View>

    {/* Spending Limits */}
    <View style={styles.subsection}>
      <View style={styles.subsectionHeader}>
        <Text style={styles.subsectionTitle}>Spending Limits</Text>
        {(!callPolicySettings.maxValuePerTx ||
          callPolicySettings.maxValuePerTx === '0' ||
          callPolicySettings.maxValuePerTx === '' ||
          !callPolicySettings.maxValuePerDay ||
          callPolicySettings.maxValuePerDay === '0' ||
          callPolicySettings.maxValuePerDay === '') && <Text style={styles.requiredIndicator}>* Required</Text>}
      </View>
      <Text style={styles.subsectionDescription}>Set maximum transaction limits</Text>

      <View style={styles.limitsContainer}>
        <View style={styles.limitItem}>
          <Text style={styles.limitLabel}>Max per Transaction (ETH)</Text>
          <TextInput
            style={[styles.limitInput, maxValuePerTxError && styles.limitInputError]}
            value={callPolicySettings.maxValuePerTx}
            onChangeText={(raw) => {
              const val = sanitizeNumericInput(raw);
              if (val && !isValidPositiveNumber(val)) return;
              handleMaxValuePerTxChange(val);
            }}
            placeholder="0.1"
            placeholderTextColor="#666666"
            keyboardType="numeric"
          />
          {maxValuePerTxError && <Text style={styles.inputErrorText}>{maxValuePerTxError}</Text>}
        </View>

        <View style={styles.limitItem}>
          <Text style={styles.limitLabel}>Max per Day (ETH)</Text>
          <TextInput
            style={[styles.limitInput, maxValuePerDayError && styles.limitInputError]}
            value={callPolicySettings.maxValuePerDay}
            onChangeText={(raw) => {
              const val = sanitizeNumericInput(raw);
              if (val && !isValidPositiveNumber(val)) return;
              if (val && !isDailyNotLessThanTx(callPolicySettings.maxValuePerTx, val)) return;
              handleMaxValuePerDayChange(val);
            }}
            placeholder="1.0"
            placeholderTextColor="#666666"
            keyboardType="numeric"
          />
          {maxValuePerDayError && <Text style={styles.inputErrorText}>{maxValuePerDayError}</Text>}
        </View>
      </View>
    </View>

    {/* Summary */}
    {(callPolicySettings.allowedTargets.length > 0 ||
      callPolicySettings.allowedTokens.length > 0) &&
      callPolicySettings.allowedActions.length > 0 && (
        <View style={styles.summaryContainer}>
          <Text style={styles.summaryTitle}>Permission Summary</Text>
          <Text style={styles.summaryText}>
            Your watch can perform {callPolicySettings.allowedActions.length} action(s) on{' '}
            {callPolicySettings.allowedTargets.length} contract(s) and {callPolicySettings.allowedTokens.length} token(s)
            with a maximum of {callPolicySettings.maxValuePerTx} units per transaction and{' '}
            {callPolicySettings.maxValuePerDay} units per day (ETH uses 18 decimals; ERC20 uses token decimals).
          </Text>
        </View>
      )}
  </View>
);
