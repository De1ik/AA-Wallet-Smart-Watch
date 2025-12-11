# HTTP Routes (`/wallet` prefix)

Mounted in `src/routes/wallet.ts`.

- **UserOp** (`src/modules/userop/userop.routes.ts`)
  - `POST /wallet/userop/prepare` — prepare user-op payloads
  - `POST /wallet/userop/broadcast` — submit signed user-op

- **EntryPoint** (`src/modules/entrypoint/entrypoint.routes.ts`)
  - `GET /wallet/entrypoint/status` — check prefund/deposit status
  - `POST /wallet/entrypoint/deposit` — build/submit deposit op

- **CallPolicy** (`src/modules/callpolicy/callpolicy.routes.ts`)
  - `POST /wallet/callpolicy/info` — permission/limit info for a delegated key
  - `POST /wallet/callpolicy/delegated-keys` — list delegated keys for owner
  - `POST /wallet/callpolicy/allowed-tokens` — allowed tokens for policy
  - `POST /wallet/callpolicy/allowed-recipients` — allowed recipients for policy
  - `POST /wallet/callpolicy/token-usage` — daily usage for a token

- **Delegated Keys** (`src/modules/delegated/delegated.routes.ts`)
  - `POST /wallet/delegated/install/prepare-data`
  - `POST /wallet/delegated/install/execute`
  - `POST /wallet/delegated/revoke/prepare-data`
  - `POST /wallet/delegated/revoke/execute`

- **Account** (`src/modules/account/account.routes.ts`)
  - `POST /wallet/account/info` — kernel/account info helpers
  - `POST /wallet/account/token-metadata` — token metadata lookup

## WebSocket
Attached to the same server; see `src/services/websocket.ts`. Emits `status_update` messages keyed by `clientId` (provided by the server on connect).
