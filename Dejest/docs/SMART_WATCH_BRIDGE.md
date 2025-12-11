# Smart Watch Bridge

Native bridge for Apple Watch connectivity (iOS only) used to generate delegated keys and sync permissions.

## Where it lives
- Bridge implementation: `src/services/native/smartWatchBridge.ts`
- React hook wrapper: `src/shared/hooks/useSmartWatch.ts`
- Main UI flow: `src/modules/delegated-keys/screens/smart-watch-connection/create-delegated-key/create-key.tsx`

## Current capabilities
- `pingWatch()` — connectivity check (iOS/WalletBridge required)
- `requestKeyGeneration(data)` — asks the watch to generate a key pair (returns `address`)
- `syncPermissionData(data)` — pushes permission metadata (ids, tokens, recipients) to the watch
- `getAccountData()` — placeholder; replace with real wallet data when available
- `sendToWatch(payload)` — generic payload bridge
- Helpers: `validatePermissionData`, `formatWatchError`, `getBridgeStatus`

Types:
```ts
interface WatchGenarteKeyData {
  kernelAddress: string;
  whitelist?: { name: string; address: string }[];
  allowedTokens?: { address: string; symbol: string; name?: string; decimals: number }[];
}

interface WatchPermissionData {
  permissionId: string;
  vId: string;
  deviceName: string;
  keyType: PermissionPolicyType; // sudo | call-policy
  createdAt: string;
  allowedTokens?: ...
  allowedRecipients?: string[];
}
```

## Usage flow (Create Delegated Key screen)
1. `useSmartWatch.checkConnection()` on mount to set `isConnected`.
2. User starts creation → `requestKeyGeneration` with kernel address/whitelist/token data.
3. Watch returns `address`; app saves a pending device and continues blockchain ops.
4. After on-chain setup, `syncPermissionData` sends permission/vId/token/recipient info to the watch.
5. Optional messages to watch via `smartWatchBridge.sendToWatch` (e.g., `START_INSTALLATION`).

## Platform notes
- Bridge works on iOS via `NativeModules.WalletBridge`; Android currently returns false/throws.
- `getAccountData` is stubbed; wire it to wallet context/service for real balances/history.
- Errors surface in `useSmartWatch` via `error`/`isLoading`; show user-friendly messaging in UI.

## Security notes
- Private keys are generated on the watch; the bridge only receives the derived address.
- Validate payloads (`validatePermissionData`) before syncing.

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
