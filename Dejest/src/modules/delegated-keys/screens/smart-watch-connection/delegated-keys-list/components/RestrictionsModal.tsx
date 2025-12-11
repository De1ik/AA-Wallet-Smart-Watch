import React from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { IconSymbol } from '@/shared/ui/icon-symbol';
import { styles } from '../styles';
import { DelegatedKeyData } from '@/modules/delegated-keys/services/delegatedKeys';
import { formatUnits } from 'viem';
import { PermissionPolicyType } from '@/domain/types';

export type RestrictionToken = {
  token: string;
  symbol?: string;
  name?: string;
  decimals?: number;
  enabled: boolean;
  txLimit: string;
  dailyLimit: string;
  usage?: {
    used: string;
    limit: string;
    remaining: string;
    percentage: number;
  } | null;
};

export type RestrictionDetails = {
  allowedTokens: RestrictionToken[];
  allowedRecipients: string[];
  statusText?: string;
  delegatedKey?: string;
  delegatedEOA?: string;
} | null;

type Props = {
  visible: boolean;
  device: DelegatedKeyData | null;
  details: RestrictionDetails;
  isLoading: boolean;
  isRefreshing: boolean;
  onClose: () => void;
  onRefresh: () => void;
};

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

const formatUsage = (usage: RestrictionToken['usage'], decimals?: number, symbol?: string) => {
  if (!usage) return null;
  try {
    const dec = decimals ?? 18;
    const used = formatUnits(BigInt(usage.used ?? '0'), dec);
    const limit = formatUnits(BigInt(usage.limit ?? '0'), dec);
    return { used, limit, symbol: symbol || 'TOKEN' };
  } catch {
    return { used: usage.used, limit: usage.limit, symbol: symbol || 'TOKEN' };
  }
};

export const RestrictionsModal = ({
  visible,
  device,
  details,
  isLoading,
  isRefreshing,
  onClose,
  onRefresh,
}: Props) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.modalOverlay}>
      <View style={styles.restrictionsModal}>
        <View style={styles.restrictionsModalHeader}>
          <Text style={styles.restrictionsModalTitle}>Delegated Key Restrictions</Text>
          <View style={styles.restrictionsHeaderButtons}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <IconSymbol name="xmark" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {device && (
          <ScrollView style={styles.restrictionsContent}>
            <View style={styles.restrictionsSection}>
              <Text style={styles.restrictionsSectionTitle}>Device Information</Text>
              <View style={styles.restrictionsItem}>
                <Text style={styles.restrictionsLabel}>Device Name:</Text>
                <Text style={styles.restrictionsValue}>{device.deviceName}</Text>
              </View>
              <View style={styles.restrictionsItem}>
                <Text style={styles.restrictionsLabel}>Public Address:</Text>
                <Text style={styles.restrictionsValue}>{device.publicAddress}</Text>
              </View>
              <View style={styles.restrictionsItem}>
                <Text style={styles.restrictionsLabel}>Key Type:</Text>
                <Text style={styles.restrictionsValue}>
                  {device.keyType === PermissionPolicyType.CALL_POLICY ? 'Restricted Access' : 'Sudo Access'}
                </Text>
              </View>
              {details?.statusText && (
                <View style={styles.restrictionsItem}>
                  <Text style={styles.restrictionsLabel}>Status:</Text>
                  <Text style={styles.restrictionsValue}>{details.statusText}</Text>
                </View>
              )}
            </View>

            {isLoading && (
              <View style={styles.restrictionsSection}>
                <ActivityIndicator size="small" color="#8B5CF6" />
                <Text style={styles.restrictionsEmpty}>Loading on-chain limits...</Text>
              </View>
            )}

            {details && PermissionPolicyType.CALL_POLICY && (
              <>
                <View style={styles.restrictionsSection}>
                  <Text style={styles.restrictionsSectionTitle}>Allowed Recipients</Text>
                  {details.allowedRecipients.length > 0 ? (
                    <View style={styles.restrictionsList}>
                      {details.allowedRecipients.map((recipient, index) => (
                        <View key={index} style={styles.restrictionsListItem}>
                          <IconSymbol name="person.crop.circle" size={16} color="#10B981" />
                          <Text style={styles.restrictionsListItemText}>{recipient}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.restrictionsEmpty}>No recipients configured</Text>
                  )}
                </View>

                <View style={styles.restrictionsSection}>
                  <Text style={styles.restrictionsSectionTitle}>Token Limits</Text>
                  {details.allowedTokens.length > 0 ? (
                    <View style={styles.restrictionsList}>
                      {details.allowedTokens.map((token, index) => {
                        const { perTx, perDay, symbol } = formatTokenLimit(
                          token.txLimit,
                          token.dailyLimit,
                          token.decimals,
                          token.symbol
                        );
                        const usage = formatUsage(token.usage, token.decimals, token.symbol);
                        return (
                          <View key={index} style={styles.restrictionsListItem}>
                            <View style={styles.restrictionsTokenInfo}>
                              <View style={styles.tokenHeaderRow}>
                                <IconSymbol name="dollarsign.circle" size={18} color="#10B981" />
                                <Text style={styles.restrictionsListItemText}>
                                  {token.symbol || 'TOKEN'} • {token.name || 'Unknown Token'}
                                </Text>
                                <Text
                                  style={[
                                    styles.tokenStatusPill,
                                    token.enabled ? styles.tokenStatusEnabled : styles.tokenStatusDisabled,
                                  ]}
                                >
                                  {token.enabled ? 'Enabled' : 'Disabled'}
                                </Text>
                              </View>
                              <Text style={styles.restrictionsTokenMetaSmall}>{token.token}</Text>
                              <View style={styles.tokenLimitRow}>
                                <View style={styles.tokenLimitBox}>
                                  <Text style={styles.tokenLimitLabel}>Per Tx</Text>
                                  <Text style={styles.tokenLimitValue}>
                                    {perTx} {symbol}
                                  </Text>
                                </View>
                                <View style={styles.tokenLimitBox}>
                                  <Text style={styles.tokenLimitLabel}>Daily</Text>
                                  <Text style={styles.tokenLimitValue}>
                                    {perDay} {symbol}
                                  </Text>
                                </View>
                              </View>
                              {usage && (
                                <View style={styles.tokenUsageRow}>
                                  <Text style={styles.tokenUsageText}>
                                    Today: {usage.used} / {usage.limit} {usage.symbol}
                                  </Text>
                                </View>
                              )}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={styles.restrictionsEmpty}>No token limits configured</Text>
                  )}
                </View>

                {device.callPolicyPermissions && (
                  <View style={styles.restrictionsSection}>
                    <Text style={styles.restrictionsSectionTitle}>Detailed Permissions</Text>
                    {device.callPolicyPermissions.length > 0 ? (
                      <View style={styles.permissionsList}>
                        {device.callPolicyPermissions.map((permission, index) => {
                          const callTypeText = permission.callType === 0 ? 'Single Call' : 'Delegate Call';
                          return (
                            <View key={index} style={styles.permissionItem}>
                              <View style={styles.permissionHeader}>
                                <IconSymbol name="checkmark.circle.fill" size={18} color="#10B981" />
                                <Text style={styles.permissionTitle}>Permission #{index + 1}</Text>
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
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    ) : (
                      <Text style={styles.restrictionsEmpty}>No permissions configured</Text>
                    )}
                  </View>
                )}

                {device.keyType === PermissionPolicyType.CALL_POLICY && (
                  <View style={styles.refreshButtonContainer}>
                    <TouchableOpacity
                      style={styles.refreshFromContractButton}
                      onPress={onRefresh}
                      disabled={isRefreshing}
                    >
                      {isRefreshing ? (
                        <ActivityIndicator size="small" color="#8B5CF6" />
                      ) : (
                        <IconSymbol name="arrow.clockwise" size={16} color="#8B5CF6" />
                      )}
                      <Text style={styles.refreshFromContractText}>
                        {isRefreshing ? 'Refreshing...' : 'Refresh'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        )}
      </View>
    </View>
  </Modal>
);
