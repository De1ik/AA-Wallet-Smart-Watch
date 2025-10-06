import { wsClient } from './websocketClient';
import { InstallationStatus } from './apiClient';
import { DelegatedKeyData, updateDelegatedKey } from './delegatedKeys';

export interface GlobalInstallationState {
  isInstalling: boolean;
  deviceId: string | null;
  deviceName: string | null;
  keyType: 'sudo' | 'restricted' | 'callpolicy' | null;
  status: InstallationStatus | null;
  progress: number;
  currentStep: string;
  error: string | null;
}

class InstallationStateManager {
  private state: GlobalInstallationState = {
    isInstalling: false,
    deviceId: null,
    deviceName: null,
    keyType: null,
    status: null,
    progress: 0,
    currentStep: 'Initializing...',
    error: null,
  };

  private listeners: Set<(state: GlobalInstallationState) => void> = new Set();
  private wsConnected: boolean = false;

  // Subscribe to state changes
  subscribe(listener: (state: GlobalInstallationState) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Get current state
  getState(): GlobalInstallationState {
    return { ...this.state };
  }

  // Update state and notify listeners
  private updateState(updates: Partial<GlobalInstallationState>) {
    this.state = { ...this.state, ...updates };
    this.listeners.forEach(listener => listener(this.state));
    console.log('[InstallationState] State updated:', this.state);
  }

  // Start installation tracking
  startInstallation(deviceId: string, deviceName: string, keyType: 'sudo' | 'restricted' | 'callpolicy') {
    console.log('[InstallationState] Starting installation tracking:', { deviceId, deviceName, keyType });
    
    this.updateState({
      isInstalling: true,
      deviceId,
      deviceName,
      keyType,
      status: { step: 'installing', message: 'Starting installation...', progress: 0 },
      progress: 0,
      currentStep: 'Starting installation...',
      error: null,
    });

    // Connect to WebSocket if not already connected
    this.connectWebSocket();
  }

  // Connect to WebSocket for real-time updates
  private connectWebSocket() {
    if (this.wsConnected) return;

    console.log('[InstallationState] Connecting to WebSocket for installation tracking...');
    
    wsClient.connect(
      (status: InstallationStatus) => {
        console.log('[InstallationState] Received status update:', status);
        this.handleStatusUpdate(status);
      },
      (connected: boolean) => {
        console.log('[InstallationState] WebSocket connection status:', connected);
        this.wsConnected = connected;
        
        if (!connected) {
          this.updateState({
            currentStep: 'Connection lost. Attempting to reconnect...',
          });
        }
      }
    );

    this.wsConnected = true;
  }

  // Handle status updates from WebSocket
  private handleStatusUpdate(status: InstallationStatus) {
    this.updateState({
      status,
      progress: status.progress,
      currentStep: status.message,
      error: status.error || null,
    });

    // Handle completion
    if (status.step === 'completed') {
      this.handleInstallationComplete();
    } else if (status.step === 'failed') {
      this.handleInstallationFailed(status.error || 'Unknown error');
    }
  }

  // Handle installation completion
  private async handleInstallationComplete() {
    console.log('[InstallationState] Installation completed!');
    
    try {
      // Update the delegated key in storage to completed status
      if (this.state.deviceId) {
        await updateDelegatedKey(this.state.deviceId, {
          installationStatus: 'completed',
          installationProgress: undefined,
        });
      }

      this.updateState({
        isInstalling: false,
        status: { step: 'completed', message: 'Installation completed successfully!', progress: 100 },
        progress: 100,
        currentStep: 'Installation completed successfully!',
      });

      // Disconnect WebSocket after a delay to allow UI to show completion
      setTimeout(() => {
        this.disconnectWebSocket();
      }, 3000);

    } catch (error) {
      console.error('[InstallationState] Error updating installation completion:', error);
      this.handleInstallationFailed('Failed to save installation data');
    }
  }

  // Handle installation failure
  private handleInstallationFailed(error: string) {
    console.log('[InstallationState] Installation failed:', error);
    
    this.updateState({
      isInstalling: false,
      error,
      currentStep: `Installation failed: ${error}`,
    });

    // Disconnect WebSocket after a delay
    setTimeout(() => {
      this.disconnectWebSocket();
    }, 5000);
  }

  // Stop installation tracking
  stopInstallation() {
    console.log('[InstallationState] Stopping installation tracking');
    
    this.updateState({
      isInstalling: false,
      deviceId: null,
      deviceName: null,
      keyType: null,
      status: null,
      progress: 0,
      currentStep: 'Initializing...',
      error: null,
    });

    this.disconnectWebSocket();
  }

  // Disconnect WebSocket
  private disconnectWebSocket() {
    if (this.wsConnected) {
      console.log('[InstallationState] Disconnecting WebSocket');
      wsClient.disconnect();
      this.wsConnected = false;
    }
  }

  // Check if there's an ongoing installation
  hasOngoingInstallation(): boolean {
    return this.state.isInstalling && this.state.deviceId !== null;
  }

  // Get installation data for display
  getInstallationData(): DelegatedKeyData | null {
    if (!this.hasOngoingInstallation()) return null;

    return {
      id: this.state.deviceId!,
      deviceName: this.state.deviceName!,
      keyType: this.state.keyType!,
      permissionId: '', // Will be filled by server
      vId: '', // Will be filled by server
      publicAddress: '', // Will be filled by key generation
      createdAt: new Date().toISOString(),
      installationStatus: 'installing',
      installationProgress: {
        currentStep: this.state.currentStep,
        totalSteps: 3,
        completedSteps: Math.round(this.state.progress / 33.33),
        transactionStatus: this.state.status?.txHash ? `Tx: ${this.state.status.txHash.slice(0, 10)}...` : undefined,
      },
    };
  }
}

// Export singleton instance
export const installationState = new InstallationStateManager();
