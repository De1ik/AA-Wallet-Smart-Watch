import React from 'react';
import { Modal, View, Text, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { IconSymbol } from '@/shared/ui/icon-symbol';
import { styles } from '../styles';
import { TokenOption } from '@/modules/delegated-keys/services/delegatedKeys';

type Props = {
  visible: boolean;
  onClose: () => void;
  tokenSearch: string;
  setTokenSearch: (val: string) => void;
  filteredTokens: TokenOption[];
  isSelected: (t: TokenOption) => boolean;
  onToggle: (t: TokenOption) => void;
};

export const TokenSelectorModal = ({
  visible,
  onClose,
  tokenSearch,
  setTokenSearch,
  filteredTokens,
  isSelected,
  onToggle,
}: Props) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.modalOverlay}>
      <View style={styles.tokenModal}>
        <View style={styles.tokenModalHeader}>
          <Text style={styles.tokenModalTitle}>Select Supported Tokens</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
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

        <ScrollView style={styles.tokenList} contentContainerStyle={styles.tokenListContent}>
          {filteredTokens.map((token) => {
            const selected = isSelected(token);
            return (
              <TouchableOpacity
                key={token.address}
                style={[styles.tokenItem, selected && styles.tokenItemSelected]}
                onPress={() => onToggle(token)}
              >
                <View style={[styles.tokenBadge, { backgroundColor: token.color || '#4B5563' }]} />
                <View style={styles.limitInfo}>
                  <Text style={[styles.tokenName, selected && styles.tokenNameSelected]}>
                    {token.name} ({token.symbol})
                  </Text>
                  <Text style={styles.tokenMeta}>Decimals: {token.decimals}</Text>
                  <Text style={styles.limitText}>Tap to {selected ? 'remove' : 'add'} this token</Text>
                </View>
                <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                  {selected && <IconSymbol name="checkmark" size={16} color="#FFFFFF" />}
                </View>
              </TouchableOpacity>
            );
          })}

          {filteredTokens.length === 0 && <Text style={styles.emptyStateText}>No supported tokens match your search.</Text>}
        </ScrollView>

        <View style={styles.tokenModalFooter}>
          <TouchableOpacity style={styles.tokenModalButton} onPress={onClose}>
            <Text style={styles.tokenModalButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);
