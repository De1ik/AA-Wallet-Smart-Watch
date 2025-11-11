# Wallet Routes Overview

The `server-side/src/routes` folder hosts every HTTP surface that powers the smart-watch onboarding flow, delegated key management, account abstraction utilities, and supporting diagnostics. All routes are mounted under the `/wallet` prefix by `wallet.ts`, which wires each feature-specific registrar into a single `express.Router`.

## Route Registrars

| File | Purpose | Base Paths |
|------|---------|------------|
| `wallet.healthRoutes.ts` | Basic readiness probes. | `GET /wallet/test`, `GET /wallet/health` |
| `wallet.accountRoutes.ts` | Balance lookup, transaction history, and kernel-owned transfers. | `GET /wallet/balances`, `GET /wallet/transactions`, `POST /wallet/send` |
| `wallet.entryPointRoutes.ts` | EntryPoint deposit tooling and prefund snapshots. | `GET /wallet/entrypoint/status`, `POST /wallet/entrypoint/deposit` |
| `wallet.userOpRoutes.ts` | Two-step user-operation flow used by the watch (prepare → broadcast). | `POST /wallet/userOp/prepare`, `POST /wallet/userOp/broadcast` |
| `wallet.delegatedRoutes.ts` | Full delegated-key installation lifecycle plus revocation. | `POST /wallet/delegated/create`, `POST /wallet/revoke` |
| `wallet.callPolicyRoutes.ts` | Fetching and maintaining call-policy permissions/daily usage. | `POST /wallet/callpolicy/fetch`, `/callpolicy/regenerate`, `/callpolicy/all-permissions-with-usage` |

Supporting modules (`wallet.constants.ts`, `wallet.errors.ts`, `wallet.prefund.ts`, and `wallet.transactions.ts`) provide shared helpers and do not register endpoints directly.

---

## Health & Diagnostics (`wallet.healthRoutes.ts`)

| Endpoint | Description |
| --- | --- |
| `GET /wallet/test` | Lightweight “is the process alive?” ping used by local scripts and CI. Always returns `{ message: "Backend is alive" }`. |
| `GET /wallet/health` | Richer health probe that returns `{ status, timestamp, message }` and surfaces a 500 if something unexpected bubbles up inside the handler. |

Use these routes for container liveness and smoke checks.

---

## Account APIs (`wallet.accountRoutes.ts`)

### `GET /wallet/balances`
*Inputs:* `address` query param (checks `0x...` format).  
*Behavior:* Calls `fetchAllTokenBalances` to return native ETH plus any non-zero ERC‑20s tracked in `walletData`. Response includes `ethBalance` and a `tokens[]` array with symbol/name/amount metadata.

### `GET /wallet/transactions`
*Inputs:* `address`, optional `limit` (default 20), optional `useEtherscan`.  
*Behavior:* Uses Etherscan v2 APIs when enabled, falling back to the on-chain history helper. Results are normalized via `convertEtherscanToApiFormat` into `{ hash, from, to, value, type, status, tokenSymbol, ... }`.

### `POST /wallet/send`
*Payload:* `{ to: string, amount: string, tokenAddress?: string }`.  
*Behavior:* Builds an AA user operation either for native ETH (`buildSendRootUO`) or ERC‑20s (`buildSendTokenUO`) after validating addresses/amounts, then submits it with `sendUserOpV07`. Returns `{ txHash }` when the bundler accepts the op.

---

## EntryPoint Funding (`wallet.entryPointRoutes.ts`)

### `GET /wallet/entrypoint/status`
Uses `checkPrefundSimple` to report whether the configured kernel already deposited enough ETH into EntryPoint. Useful before installing delegates.

### `POST /wallet/entrypoint/deposit`
*Payload:* `{ amountEth?: string }` (defaults to `0.01`).  
Builds a deposit user operation via `buildDepositUserOp`, submits it through the bundler, and mirrors bundler errors (including revert reasons) back to the client.

---

## Delegated Key Lifecycle (`wallet.delegatedRoutes.ts`)

### `POST /wallet/delegated/create`
*Payload:* `{ delegatedEOA, keyType: "sudo" | "restricted" | "callpolicy", clientId?, permissions? }`.  
- Validates the delegated EOA and requested key type.  
- For `callpolicy` keys, enforces that a non-empty permissions array is provided and well-formed.  
- Runs `checkPrefundSimple`; if prefund is missing, aborts early.  
- Kicks off `performDelegatedKeyInstallation`, which:
  1. Installs either the sudo policy or call policy (with custom restrictions).  
  2. Enables and/or grants the `execute` selector depending on key type.  
  3. Streams `InstallationStatus` updates (installing → granting → completed/failed) over WebSocket via `wsService.broadcastToClient(clientId, status)`.  
The HTTP response simply acknowledges `{ installationId }` while the heavy work continues asynchronously.

### `POST /wallet/revoke`
*Payload:* `{ delegatedEOA }`.  
Performs the inverse of installation: validates the address, ensures prefund, builds an uninstall user operation (with retry/backoff on rate limits), sends it, and returns `{ success, txHash }`. Friendly error messages are emitted if prefund checks or bundler submissions fail.

---

## User Operation Helpers (`wallet.userOpRoutes.ts`)

These endpoints back the watch app’s two-phase UX (prepare, sign locally, broadcast).

| Endpoint | Purpose |
| --- | --- |
| `POST /wallet/userOp/prepare` | Validates payload `{ delegatedEOA, kernelAddress, to, amountWei, data }`, derives the deterministic `permissionId`, and calls `buildDelegatedSendUO` with `signature = 0x`. Responds with `{ userOpHash, echo }` so the watch can sign the hash locally. |
| `POST /wallet/userOp/broadcast` | Expects `{ delegatedEOA, kernelAddress, to, amountWei, data, signature, opHash }`. Performs a prefund-ish balance check with `ensureSufficientNativeBalance`, rebuilds the signed user op, ensures the hash matches `opHash`, and submits it via `sendUserOpV07`. Errors funnel through `buildBroadcastErrorResponse` to provide human-friendly messages (limits exceeded, permission issues, etc.). |

---

## Call Policy Utilities (`wallet.callPolicyRoutes.ts`)

| Endpoint | Notes |
| --- | --- |
| `POST /wallet/callpolicy/fetch` | Pulls raw permissions for `{ kernelAddress, delegatedEOA, permissionId }` and serializes the numeric fields into strings for UI display. |
| `POST /wallet/callpolicy/regenerate` | Deterministically recomputes `{ permissionId, vId }` for a delegated EOA using the same hashing scheme as installation. Handy when the watch loses the IDs in local storage. |
| `POST /wallet/callpolicy/all-permissions-with-usage` | Aggregates every permission for a policy/owner pair along with the current day’s spend via `getAllCallPolicyPermissionsWithUsage`. Returns friendly strings so the client can render limits and usage. |

> Older endpoints (check by index, update limits, daily-usage-only) were consolidated into this reduced surface; add them back if future clients need more granular access.

---

## Prefund Helpers (`wallet.prefund.ts`)

This module is consumed by delegated and entrypoint routes. `checkPrefundSimple()`:
- Reads the kernel’s deposit inside EntryPoint;
- Uses `getCurrentGasPrices` + `getOptimizedGasLimits` to estimate the minimum required prefund;
- Returns `{ hasPrefund, message, depositWei, requiredPrefundWei, shortfallWei, kernelAddress, entryPointAddress }`.

Use it before launching any installation flow.

---

## User Operation Error Helpers (`wallet.errors.ts`)

`ensureSufficientNativeBalance` and `buildBroadcastErrorResponse` live here. The former calls the Sepolia RPC to check the kernel’s ETH balance, and the latter aims to translate bundler or AA revert reasons into end-user-friendly messages while surfacing tx hashes when available.

---

## Transaction Formatting (`wallet.transactions.ts`)

Currently only exports `convertEtherscanToApiFormat`, which takes an `EtherscanTransaction` (from `utils/etherscanHistory`) and emits the shape expected by `/wallet/transactions`.

---

## Adding New Routes

1. Implement your registrar in this folder, exporting `registerXYZRoutes(router: Router): void`.
2. Wire it into `wallet.ts` so the router gets mounted under `/wallet`.
3. Document the new endpoints (input validation, side effects, async behaviors) in this README so future clients understand how to call them.
