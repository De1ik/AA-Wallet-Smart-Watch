# Call Policy Module

Endpoints and helpers that surface CallPolicy data from the kernel.

## Key files
- `src/modules/callpolicy/handlers.ts` — business logic
- `src/modules/callpolicy/callpolicy.routes.ts` — route wiring under `/wallet/callpolicy/*`
- `src/modules/callpolicy/schema.ts` — zod validation
- `src/utils/native-code.ts` — bridge into on-chain/kernel helpers (`getDelegatedKeyInfo`, `getTokenDailyUsageInfo`, etc.)

## Endpoints
- `POST /wallet/callpolicy/info` — returns policy status, allowed tokens/recipients, usage stats for a delegated key.
- `POST /wallet/callpolicy/delegated-keys` — lists delegated keys for an owner.
- `POST /wallet/callpolicy/allowed-tokens` — returns enabled tokens for a policy.
- `POST /wallet/callpolicy/allowed-recipients` — returns recipient allow-list.
- `POST /wallet/callpolicy/token-usage` — returns per-day usage for a token.

## Data sources
Handlers pull from `native-code` helpers that wrap contract calls:
- `getDelegatedKeyInfo(owner, policyId, delegatedKey)`
- `getTokenDailyUsageInfo(owner, policyId, token)`
- `getCallPolicyPermissionByIndex`, `getCallPolicyPermissionsCount`, etc.

## Notes
- Validation is enforced via zod schemas (addresses, hashes, indexes).
- Responses normalise bigint to string (see `src/index.ts` BigInt JSON override).
- If you enable Etherscan-backed history elsewhere, set `ETHERSCAN_API_KEY` in `.env`.
