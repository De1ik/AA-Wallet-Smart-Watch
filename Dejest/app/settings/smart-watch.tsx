import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack, useFocusEffect } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getDelegatedKeys, removeDelegatedKey, DelegatedKeyData, InstallationStatus } from '@/utils/delegatedKeys';

export default function SmartWatchScreen() {
  const [connectedDevices, setConnectedDevices] = useState<DelegatedKeyData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showInstallationDetails, setShowInstallationDetails] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<DelegatedKeyData | null>(null);

  // Load delegated keys on component mount
  useEffect(() => {
    loadDelegatedKeys();
  }, []);

  const loadDelegatedKeys = async () => {
    try {
      const keys = await getDelegatedKeys();
      setConnectedDevices(keys);
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
    React.useCallback(() => {
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
                  <View style={styles.deviceInfo}>
                    <View style={styles.deviceHeader}>
                      <IconSymbol name="applewatch" size={24} color="#8B5CF6" />
                      <Text style={styles.deviceName}>{device.deviceName}</Text>
                      <View style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(device.installationStatus) }
                      ]}>
                        <Text style={[
                          styles.statusText,
                          styles.statusTextConnected
                        ]}>
                          {getStatusText(device.installationStatus)}
                        </Text>
                      </View>
                    </View>
                    
                    <View style={styles.deviceDetails}>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Key Type:</Text>
                        <View style={[
                          styles.keyTypeBadge,
                          device.keyType === 'sudo' ? styles.sudoBadge : styles.restrictedBadge
                        ]}>
                          <Text style={[
                            styles.keyTypeText,
                            device.keyType === 'sudo' ? styles.sudoText : styles.restrictedText
                          ]}>
                            {device.keyType === 'sudo' ? 'Sudo Access' : 'Restricted Access'}
                          </Text>
                        </View>
                      </View>
                      
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Created:</Text>
                        <Text style={styles.detailValue}>
                          {new Date(device.createdAt).toLocaleDateString()}
                        </Text>
                      </View>
                      
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Permission ID:</Text>
                        <Text style={styles.detailValue}>
                          {device.permissionId.slice(0, 10)}...
                        </Text>
                      </View>
                    </View>
                  </View>
                  
                  <View style={styles.deviceActions}>
                    {device.installationStatus === 'installing' && (
                      <TouchableOpacity
                        style={styles.detailsButton}
                        onPress={() => handleShowInstallationDetails(device)}
                      >
                        <IconSymbol name="info.circle" size={16} color="#8B5CF6" />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.disconnectButton}
                      onPress={() => handleDisconnectDevice(device.id)}
                    >
                      <IconSymbol name="xmark" size={16} color="#EF4444" />
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

          {/* Create New Key Button */}
          <TouchableOpacity 
            style={styles.createButton}
            onPress={handleCreateDelegatedKey}
          >
            <IconSymbol name="plus" size={20} color="#FFFFFF" />
            <Text style={styles.createButtonText}>Create New Delegated Key</Text>
          </TouchableOpacity>

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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deviceInfo: {
    flex: 1,
  },
  deviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
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
  },
  detailValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
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
    gap: 8,
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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333333',
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
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
});
