import React, { useMemo, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { IconSymbol } from '@/shared/ui/icon-symbol';
import { CryptoData } from '@/modules/account/state/WalletContext';
import { TxStatus, TxType } from '@/domain/types';

type Transaction = CryptoData['transactions'][number];

type Props = {
  visible: boolean;
  transaction: Transaction | null;
  onClose: () => void;
};

export const TransactionDetailsModal = ({ visible, transaction, onClose }: Props) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const amountSign = useMemo(() => {
    if (!transaction) return '';
    return transaction.type === TxType.RECEIVED ? '+' : '-';
  }, [transaction]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const formatAmount = (amount: number) => {
    if (amount === 0) return '0';
    if (amount < 0.0001 && amount > 0) {
      return amount.toFixed(18).replace(/\.?0+$/, '');
    }
    return amount.toString();
  };

  const timestamp = transaction?.timestamp instanceof Date
    ? transaction.timestamp
    : transaction?.timestamp
    ? new Date(transaction.timestamp)
    : null;

  const copyToClipboard = async (value: string, field: string) => {
    try {
      await Clipboard.setStringAsync(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.warn('Failed to copy to clipboard', err);
    }
  };

  const statusColor = (status?: TxStatus) => {
    switch (status) {
      case TxStatus.FAILED:
        return { text: '#EF4444', background: '#EF444420', label: 'Failed' };
      case TxStatus.PENDING:
        return { text: '#F59E0B', background: '#F59E0B20', label: 'Pending' };
      default:
        return { text: '#10B981', background: '#10B98120', label: 'Success' };
    }
  };

  const statusStyle = statusColor(transaction?.status);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Transaction Details</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <IconSymbol name="xmark" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {transaction && (
              <>
                <View style={styles.row}>
                  <Text style={styles.label}>Type</Text>
                  <Text
                    style={[
                      styles.value,
                      { color: transaction.type === TxType.RECEIVED ? '#10B981' : '#EF4444' },
                    ]}
                  >
                    {transaction.type === TxType.RECEIVED ? 'Received' : 'Sent'}
                  </Text>
                </View>

                <View style={styles.row}>
                  <Text style={styles.label}>Status</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: statusStyle.background },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        { color: statusStyle.text },
                      ]}
                    >
                      {statusStyle.label}
                    </Text>
                  </View>
                </View>

                {transaction.errorMessage ? (
                  <View style={styles.row}>
                    <Text style={styles.label}>Error</Text>
                    <Text style={[styles.value, { color: '#EF4444' }]}>
                      {transaction.errorMessage}
                    </Text>
                  </View>
                ) : null}

                {transaction.from ? (
                  <CopyableField
                    label="From"
                    value={transaction.from}
                    copied={copiedField === 'from'}
                    onCopy={() => copyToClipboard(transaction.from!, 'from')}
                  />
                ) : null}

                {transaction.to ? (
                  <CopyableField
                    label="To"
                    value={transaction.to}
                    copied={copiedField === 'to'}
                    onCopy={() => copyToClipboard(transaction.to!, 'to')}
                  />
                ) : null}

                <View style={styles.row}>
                  <Text style={styles.label}>Amount</Text>
                  <Text
                    style={[
                      styles.value,
                      { color: transaction.type === TxType.RECEIVED ? '#10B981' : '#EF4444' },
                    ]}
                  >
                    {amountSign}
                    {formatAmount(transaction.amount)} {transaction.symbol}
                  </Text>
                </View>

                <View style={styles.row}>
                  <Text style={styles.label}>Value</Text>
                  <Text style={styles.value}>
                    {amountSign}
                    {formatCurrency(transaction.value)}
                  </Text>
                </View>

                {timestamp && (
                  <View style={styles.row}>
                    <Text style={styles.label}>Timestamp</Text>
                    <Text style={styles.value}>{timestamp.toLocaleString()}</Text>
                  </View>
                )}

                <CopyableField
                  label="Transaction Hash"
                  value={transaction.transactionHash || transaction.id}
                  copied={copiedField === 'hash'}
                  onCopy={() =>
                    copyToClipboard(transaction.transactionHash || transaction.id, 'hash')
                  }
                />
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const CopyableField = ({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) => (
  <View style={styles.row}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.addressBox}>
      <Text style={styles.addressText}>{value}</Text>
      <TouchableOpacity onPress={onCopy} style={styles.copyButton}>
        <IconSymbol
          name={copied ? 'checkmark.circle' : 'doc.on.doc'}
          size={18}
          color={copied ? '#10B981' : '#8B5CF6'}
        />
      </TouchableOpacity>
    </View>
  </View>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  closeButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  row: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    color: '#A0A0A0',
    marginBottom: 8,
    fontWeight: '500',
  },
  value: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  addressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: 'monospace',
    paddingRight: 8,
  },
  copyButton: {
    padding: 4,
  },
});

export default TransactionDetailsModal;
