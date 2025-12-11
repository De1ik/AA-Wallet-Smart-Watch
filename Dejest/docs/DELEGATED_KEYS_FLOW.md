# Delegated Keys Flow

How the delegated-key creation flow works in the app (smart watch + blockchain).

## Key pieces
- Screen: `src/modules/delegated-keys/screens/smart-watch-connection/create-delegated-key/create-key.tsx`
- Hook: `src/shared/hooks/useSmartWatch.ts`
- Bridge: `src/services/native/smartWatchBridge.ts`
- Builders: `create-key.tsx` helpers (`callPolicyBuilders.ts`) for call-policy permissions
- Storage: `src/services/storage/installationState` + `transactionReviewState`

## Happy path
1) Connection: `useSmartWatch.checkConnection()` pings the watch and toggles UI.
2) User selects key type (sudo/call-policy) and inputs device name/settings.
3) `requestKeyGeneration` sends kernel address, allowed tokens/whitelist to watch; returns `address`.
4) App saves device with `installationStatus: "installing"` and shows address confirmation.
5) Blockchain ops (call-policy):
   - `generateCallPolicyPermissions` → permission payloads
   - user ops: install policy, enable selector (restricted), grant access
   - sent via API/websocket helpers (`apiClient`, `wsClient`)
6) After on-chain success, app calls `syncPermissionData` to push permission/vId/token/recipient info to the watch.
7) Device storage updates to completed; UI shows success.

## Error handling
- Watch connectivity errors surface via `useSmartWatch.error`.
- Key generation/sync errors are caught and reported via notifications (`useNotifications`).
- Blockchain/API errors use `transactionReviewState` + `installationState` to persist progress.

## Data sent to watch
- Key generation input: kernel address, optional whitelist and token metadata.
- Permission sync: `permissionId`, `vId`, `deviceName`, `keyType`, allowed tokens/recipients.

## Notes
- Bridge is iOS-only; Android returns false/throws today.
- Replace placeholder account data in `smartWatchBridge.getAccountData` when wallet service is ready.
- Transfer limits/targets/tokens for call-policy are configured in-screen before syncing.
