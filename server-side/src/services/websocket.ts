import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';

export interface InstallationStatus {
  step: 'installing' | 'granting' | 'completed' | 'failed';
  message: string;
  progress: number; // 0-100
  txHash?: string;
  error?: string;
  permissionId?: string;
  vId?: string;
}

export class WebSocketService {
  private wss: WebSocketServer;
  private clients: Map<string, WebSocket> = new Map();
  private heartbeatInterval?: ReturnType<typeof setInterval>;

  constructor(server: any) {
    this.wss = new WebSocketServer({ 
      server,
      // Add ping/pong configuration
      perMessageDeflate: false,
      clientTracking: true
    });
    this.setupWebSocketServer();
    this.startHeartbeat();
  }

  private setupWebSocketServer() {
    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      console.log('[WebSocket] New client connected');
      
      // Generate a unique client ID
      const clientId = Math.random().toString(36).substring(7);
      this.clients.set(clientId, ws);
      
      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connected',
        clientId,
        message: 'Connected to installation status updates'
      }));

      ws.on('message', (message: string) => {
        try {
          const data = JSON.parse(message);
          console.log('[WebSocket] Received message:', data);
          
          if (data.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong' }));
          }
        } catch (error) {
          console.error('[WebSocket] Error parsing message:', error);
        }
      });

      ws.on('close', (code: number, reason: string) => {
        console.log(`[WebSocket] Client disconnected: ${code} - ${reason}`);
        this.clients.delete(clientId);
      });

      ws.on('error', (error) => {
        console.error('[WebSocket] Client error:', error);
        this.clients.delete(clientId);
      });

      // Handle ping frames
      ws.on('ping', () => {
        ws.pong();
      });
    });
  }

  // Broadcast status update to a specific client
  broadcastToClient(clientId: string, status: InstallationStatus) {
    const ws = this.clients.get(clientId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      const message = {
        type: 'status_update',
        ...status
      };
      console.log('[WebSocket] Broadcasting to client', clientId, ':', message);
      ws.send(JSON.stringify(message));
    } else {
      console.log('[WebSocket] Client', clientId, 'not found or not connected');
    }
  }

  // Broadcast status update to all clients
  // broadcastToAll(status: InstallationStatus) {
  //   const message = JSON.stringify({
  //     type: 'status_update',
  //     ...status
  //   });

  //   this.clients.forEach((ws, clientId) => {
  //     if (ws.readyState === WebSocket.OPEN) {
  //       ws.send(message);
  //     } else {
  //       // Remove disconnected clients
  //       this.clients.delete(clientId);
  //     }
  //   });
  // }

  // Start heartbeat to detect dead connections
  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.clients.forEach((ws, clientId) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        } else {
          // Remove dead connections
          console.log(`[WebSocket] Removing dead connection: ${clientId}`);
          this.clients.delete(clientId);
        }
      });
    }, 60000); // Ping every 60 seconds
  }

  // Stop heartbeat
  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
  }

  // Close all connections
  close() {
    this.stopHeartbeat();
    this.wss.close();
  }

  // Get connection statistics
  getStats() {
    return {
      connectedClients: this.clients.size,
      clientIds: Array.from(this.clients.keys())
    };
  }
}
