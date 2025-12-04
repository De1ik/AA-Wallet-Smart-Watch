import { config } from '@/config/env';

export interface InstallationStatus {
  step: 'installing' | 'granting' | 'completed' | 'failed';
  message: string;
  progress: number; // 0-100
  txHash?: string;
  error?: string;
  permissionId?: string;
  vId?: string;
}

export interface WebSocketMessage {
  type: 'connected' | 'status_update' | 'pong';
  clientId?: string;
  message?: string;
  step?: 'installing' | 'granting' | 'completed' | 'failed';
  progress?: number;
  txHash?: string;
  error?: string;
  permissionId?: string;
  vId?: string;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10; // Increased from 5 to 10
  private reconnectInterval = 1000;
  private maxReconnectInterval = 30000; // Max 30 seconds between attempts
  private clientId: string = '';
  private onStatusUpdate?: (status: InstallationStatus) => void;
  private onConnectionChange?: (connected: boolean) => void;
  private heartbeatInterval?: ReturnType<typeof setInterval>;
  private isManuallyDisconnected = false;

  constructor() {
    this.clientId = Math.random().toString(36).substring(7);
  }

  connect(onStatusUpdate: (status: InstallationStatus) => void, onConnectionChange?: (connected: boolean) => void) {
    this.onStatusUpdate = onStatusUpdate;
    this.onConnectionChange = onConnectionChange;
    this.isManuallyDisconnected = false;

    const wsUrl = config.API_BASE_URL.replace('http', 'ws');
    console.log('[WebSocketClient] Connecting to:', wsUrl);

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[WebSocketClient] Connected successfully');
        this.reconnectAttempts = 0;
        this.onConnectionChange?.(true);
        
        // Start heartbeat mechanism
        this.startHeartbeat();
        
        // Send initial ping to verify connection
        this.send({ type: 'ping' });
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log('[WebSocketClient] Received message:', message);

          switch (message.type) {
            case 'connected':
              this.clientId = message.clientId || this.clientId;
              console.log('[WebSocketClient] Client ID:', this.clientId);
              break;
              
            case 'status_update':
              if (message.step && message.progress !== undefined) {
                console.log('[WebSocketClient] Processing status_update:', message);
                const status: InstallationStatus = {
                  step: message.step,
                  message: message.message || '',
                  progress: message.progress,
                  txHash: message.txHash,
                  error: message.error,
                  permissionId: message.permissionId,
                  vId: message.vId
                };
                console.log('[WebSocketClient] Created status object:', status);
                this.onStatusUpdate?.(status);
              }
              break;
              
            case 'pong':
              console.log('[WebSocketClient] Pong received');
              break;
          }
        } catch (error) {
          console.error('[WebSocketClient] Error parsing message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('[WebSocketClient] Disconnected:', event.code, event.reason);
        this.stopHeartbeat();
        this.onConnectionChange?.(false);
        
        // Only attempt reconnection if not manually disconnected
        if (!this.isManuallyDisconnected) {
          this.attemptReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('[WebSocketClient] WebSocket error:', error);
        // Don't attempt reconnection on error - let onclose handle it
      };

    } catch (error) {
      console.error('[WebSocketClient] Connection error:', error);
      this.attemptReconnect();
    }
  }

  private attemptReconnect() {
    if (this.isManuallyDisconnected) {
      console.log('[WebSocketClient] Manual disconnect - skipping reconnection');
      return;
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      
      // Calculate delay with exponential backoff, capped at maxReconnectInterval
      const delay = Math.min(
        this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1),
        this.maxReconnectInterval
      );
      
      console.log(`[WebSocketClient] Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms...`);
      
      setTimeout(() => {
        if (!this.isManuallyDisconnected && this.onStatusUpdate && this.onConnectionChange) {
          this.connect(this.onStatusUpdate, this.onConnectionChange);
        }
      }, delay);
    } else {
      console.error('[WebSocketClient] Max reconnection attempts reached. Connection failed permanently.');
      // Notify the app that WebSocket connection has failed permanently
      this.onConnectionChange?.(false);
      
      // Optionally, you could trigger a fallback mechanism here
      // such as polling the server for status updates
    }
  }

  send(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('[WebSocketClient] Cannot send message - WebSocket not connected');
    }
  }

  disconnect() {
    console.log('[WebSocketClient] Manually disconnecting...');
    this.isManuallyDisconnected = true;
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    // Reset connection state
    this.reconnectAttempts = 0;
    this.onStatusUpdate = undefined;
    this.onConnectionChange = undefined;
  }

  getClientId(): string {
    return this.clientId;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private startHeartbeat() {
    this.stopHeartbeat(); // Clear any existing heartbeat
    
    // Send ping every 30 seconds to keep connection alive
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' });
      } else {
        console.log('[WebSocketClient] Heartbeat skipped - connection not open');
        this.stopHeartbeat();
      }
    }, 30000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
  }

  // Method to reset connection state and try again
  resetConnection() {
    console.log('[WebSocketClient] Resetting connection state...');
    this.disconnect();
    this.reconnectAttempts = 0;
    this.isManuallyDisconnected = false;
  }
}

// Export singleton instance
export const wsClient = new WebSocketClient();
