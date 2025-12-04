import React from 'react';
import { Modal, View, Text, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { IconSymbol } from '@/shared/ui/icon-symbol';
import { styles } from '../styles';
import { PredefinedAction } from '@/modules/delegated-keys/services/delegatedKeys';

type Props = {
  visible: boolean;
  onClose: () => void;
  actions: PredefinedAction[];
  allowedActions: string[];
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  onSelectAction: (id: string) => void;
};

export const ActionSelectorModal = ({
  visible,
  onClose,
  actions,
  allowedActions,
  searchQuery,
  setSearchQuery,
  onSelectAction,
}: Props) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.modalOverlay}>
      <View style={styles.actionModal}>
        <View style={styles.actionModalHeader}>
          <Text style={styles.actionModalTitle}>Select Actions</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <IconSymbol name="xmark" size={20} color="#666666" />
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <IconSymbol name="magnifyingglass" size={16} color="#666666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search actions..."
            placeholderTextColor="#666666"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <ScrollView style={styles.actionList}>
          {actions.map((action) => (
            <TouchableOpacity
              key={action.id}
              style={[
                styles.actionListItem,
                allowedActions.includes(action.id) && styles.actionListItemSelected,
              ]}
              onPress={() => onSelectAction(action.id)}
              disabled={allowedActions.includes(action.id)}
            >
              <View style={styles.actionListItemContent}>
                <View style={styles.actionListItemHeader}>
                  <Text
                    style={[
                      styles.actionListItemName,
                      allowedActions.includes(action.id) && styles.actionListItemNameSelected,
                    ]}
                  >
                    {action.name}
                  </Text>
                  <View
                    style={[
                      styles.actionListItemBadge,
                      action.category === 'transfer' && styles.transferBadge,
                      action.category === 'approve' && styles.approveBadge,
                      action.category === 'swap' && styles.swapBadge,
                      action.category === 'stake' && styles.stakeBadge,
                      action.category === 'other' && styles.otherBadge,
                    ]}
                  >
                    <Text style={styles.actionListItemBadgeText}>{action.category}</Text>
                  </View>
                </View>
                <Text style={styles.actionListItemDescription}>{action.description}</Text>
                <Text style={styles.actionListItemSelector}>Selector: {action.selector}</Text>
              </View>
              {allowedActions.includes(action.id) && <IconSymbol name="checkmark" size={20} color="#10B981" />}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  </Modal>
);
