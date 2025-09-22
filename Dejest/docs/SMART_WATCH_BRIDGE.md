# Smart Watch Bridge Documentation

## Overview

The Smart Watch Bridge is a comprehensive system that enables communication between the mobile app and Apple Watch for delegated key management. It handles key generation, permission synchronization, and error management.

## Architecture

### Components

1. **SmartWatchBridge Class** (`/utils/smartWatchBridge.ts`)
   - Singleton pattern for global access
   - Handles all communication with Apple Watch
   - Manages request/response lifecycle
   - Provides error handling and user feedback

2. **useSmartWatch Hook** (`/hooks/useSmartWatch.ts`)
   - React hook for easy integration
   - Manages connection state and loading states
   - Provides typed functions for key operations

3. **Integration in Create Key Screen** (`/app/settings/smart-watch/create-key.tsx`)
   - Complete workflow implementation
   - Real-time connection status
   - Step-by-step process with user feedback

## Workflow

### 1. User Initiates Key Creation
```
User clicks "Create Delegated Key" 
→ App checks watch connection
→ Shows connection status
```

### 2. Key Generation Request
```
App requests key generation from watch
→ Watch generates private/public key pair
→ Watch returns public key to app
→ App stores key pair data
```

### 3. Blockchain Operations
```
App uses public key to create delegated access
→ buildInstallPermissionUO() - Install permission validation
→ buildEnableSelectorUO() - Enable execute selector (for restricted)
→ buildGrantAccessUO() - Grant access to selector
→ sendUserOpV07() - Send each user operation
```

### 4. Data Synchronization
```
App saves delegated key data to AsyncStorage
→ App sends permission data to watch
→ Watch stores permission ID and vId
→ Process complete
```

## API Reference

### SmartWatchBridge Class

#### Methods

```typescript
// Get singleton instance
static getInstance(): SmartWatchBridge

// Check connection status
isWatchConnected(): boolean

// Request key generation from watch
requestKeyGeneration(): Promise<WatchKeyPair>

// Sync permission data to watch
syncPermissionData(data: WatchPermissionData): Promise<boolean>

// Ping watch for connection test
pingWatch(): Promise<boolean>

// Show user-friendly error messages
showConnectionError(error: Error): void

// Show connection status
showConnectionStatus(): void
```

#### Types

```typescript
interface WatchKeyPair {
  privateKey: string;  // Generated on watch (never leaves watch)
  publicKey: string;   // Returned to app
  address: string;     // Derived address
}

interface WatchPermissionData {
  permissionId: string;
  vId: string;
  deviceName: string;
  keyType: 'sudo' | 'restricted';
  createdAt: string;
}

interface WatchRequest {
  type: 'GENERATE_KEY_PAIR' | 'SYNC_PERMISSION_DATA' | 'PING';
  data?: any;
  requestId: string;
}

interface WatchResponse {
  type: 'KEY_PAIR_GENERATED' | 'PERMISSION_DATA_SYNCED' | 'PONG' | 'ERROR';
  data?: any;
  requestId: string;
  success: boolean;
  error?: string;
}
```

### useSmartWatch Hook

#### Return Value

```typescript
interface UseSmartWatchReturn {
  isConnected: boolean;                    // Watch connection status
  isLoading: boolean;                      // Loading state
  error: string | null;                    // Error message
  requestKeyGeneration: () => Promise<WatchKeyPair>;
  syncPermissionData: (data: WatchPermissionData) => Promise<boolean>;
  checkConnection: () => Promise<boolean>;
  clearError: () => void;
}
```

#### Usage Example

```typescript
import { useSmartWatch } from '@/hooks/useSmartWatch';

function MyComponent() {
  const { 
    isConnected, 
    isLoading, 
    error,
    requestKeyGeneration,
    syncPermissionData,
    checkConnection,
    clearError 
  } = useSmartWatch();

  const handleCreateKey = async () => {
    try {
      const keyPair = await requestKeyGeneration();
      // Use keyPair.publicKey for blockchain operations
      
      const permissionData = {
        permissionId: '0x...',
        vId: '0x...',
        deviceName: 'My Watch',
        keyType: 'restricted',
        createdAt: new Date().toISOString()
      };
      
      await syncPermissionData(permissionData);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <View>
      <Text>Watch Status: {isConnected ? 'Connected' : 'Disconnected'}</Text>
      <Button onPress={handleCreateKey} disabled={!isConnected} />
    </View>
  );
}
```

## Error Handling

### Connection Errors
- **Not Connected**: "Please ensure your Apple Watch is connected"
- **Timeout**: "Request to smart watch timed out"
- **Key Generation Failed**: "Failed to generate keys on smart watch"

### User Feedback
- Real-time connection status indicator
- Loading states during operations
- Error messages with actionable advice
- Success confirmations with details

## Security Considerations

### Key Management
- **Private keys never leave the Apple Watch**
- **Public keys are transmitted securely**
- **Permission data is encrypted in transit**

### Data Flow
1. Watch generates and stores private key locally
2. Watch returns only public key to mobile app
3. Mobile app uses public key for blockchain operations
4. Permission data is synced back to watch for transaction signing

## Development Notes

### Current Implementation
- **Real Apple Watch Integration**: Uses native WatchConnectivity framework
- **Native Bridge**: Communicates directly with Apple Watch app
- **Secure Key Generation**: Keys generated on watch using secure enclave
- **Error Handling**: Comprehensive error handling for connection issues

### Implementation Details

1. **Native Bridge**: Uses React Native native modules for WatchConnectivity
2. **Watch App**: Requires companion Apple Watch app with key generation
3. **Secure Communication**: Encrypted data transmission between devices
4. **Background Handling**: Properly handles watch app lifecycle states

### Watch App Requirements
The Apple Watch app should implement:
- Key pair generation using secure enclave
- Secure storage of private keys
- Communication with mobile app
- Permission data storage
- Transaction signing capabilities

## Testing

### Unit Tests
```typescript
// Test key generation
const bridge = SmartWatchBridge.getInstance();
const keyPair = await bridge.requestKeyGeneration();
expect(keyPair.publicKey).toBeDefined();
expect(keyPair.address).toBeDefined();

// Test permission sync
const permissionData = { /* ... */ };
const success = await bridge.syncPermissionData(permissionData);
expect(success).toBe(true);
```

### Integration Tests
- Test complete workflow from key creation to permission sync
- Test error handling and recovery
- Test connection state management
- Test UI integration with hook

## Future Enhancements

1. **Biometric Authentication**: Require Face ID/Touch ID for key operations
2. **Multiple Watch Support**: Handle multiple connected watches
3. **Offline Mode**: Queue operations when watch is disconnected
4. **Transaction History**: Sync transaction history to watch
5. **Push Notifications**: Notify watch of important events
6. **Backup/Restore**: Secure backup of watch data

## Troubleshooting

### Common Issues

1. **Watch Not Connected**
   - Check Bluetooth connection
   - Ensure watch app is installed
   - Restart both devices

2. **Key Generation Fails**
   - Check watch storage space
   - Restart watch app
   - Try again after a few minutes

3. **Permission Sync Fails**
   - Check network connection
   - Verify watch app is running
   - Check for storage issues

### Debug Mode
Enable debug logging by setting:
```typescript
// In SmartWatchBridge constructor
console.log('Smart Watch Bridge: Debug mode enabled');
```

This will provide detailed logs of all communication between mobile app and watch.
