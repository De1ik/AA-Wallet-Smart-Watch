# Server-Side (Express + TypeScript)

API and WebSocket backend supporting delegated key installation, call policy queries, and user-op helpers for the mobile app/watch.

## Prerequisites

- Node 18+
- npm

## Setup

1) Install deps: `npm install`
2) Copy env template: `cp .env.example .env` and fill values
3) Run in dev: `npm run dev` (ts-node)

Key envs (`.env`):

- `PORT` — HTTP port (default 4000)
- `RPC_URL` — Ethereum RPC (Alchemy/Infura, etc.)
- `INFURA_API_KEY`, `PIMLICIO_API_KEY`, `ZERODEV_API_KEY` — rpc/bundler/project config
- `ETHERSCAN_API_KEY` — only needed if using etherscan history helpers
- `PAYMASTER_URL`, `PAYMASTER_API_KEY` — if a paymaster is in use

## Structure

- `src/index.ts` — Express bootstrap + WebSocket server
- `src/routes/wallet.ts` — mounts feature routes under `/wallet`
- `src/services/websocket.ts` — installation status WebSocket service
- `src/modules/*` — feature modules:
  - `account` — balance/tx helpers
  - `entrypoint` — prefund/deposit helpers
  - `callpolicy` — call-policy info/usage endpoints
  - `delegated` — delegated key install/revoke flows
  - `userop` — prepare/broadcast user operations
- `src/utils` — paymaster/etherscan/native-code helpers
- `src/shared` — HTTP response helpers, schemas, etc.

## Running

- Dev: `npm run dev`
- (No build script provided; add `tsc` + `node dist/index.js` if you want a build step.)

## WebSocket

The WebSocket server is attached to the same HTTP server. Use it to receive installation status updates keyed by `clientId`. See `src/services/websocket.ts` for message shapes.

## Docs

- `docs/ROUTES.md` — route and payload reference
- `docs/CALL_POLICY.md` — call policy module overview
