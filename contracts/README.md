# CallPolicy v3 (Foundry)

Contracts and tooling for deploying the latest CallPolicy module (ERC-7579 compatible). The smart contract code lives in `src/CallPolicy_v3.sol`. This package focuses on tooling, configuration, and documentation.

## Prerequisites

- Foundry installed (`curl -L https://foundry.paradigm.xyz | bash && foundryup`)
- Node.js (optional; only used for package.json scripts)
- Submodules checked out: `git submodule update --init --recursive`

## Setup

1) `cd contracts`
2) Copy environment template and fill in secrets: `cp .env.example .env`
3) Install dependencies: `forge install` (pulls remappings and stdlib)

## Useful commands

- Build: `forge build`
- Test: `forge test`
- Format: `forge fmt`
- Deploy (example to Sepolia):
  `forge script script/DeployCallPolicy.s.sol --rpc-url sepolia --broadcast --verify`

Network URLs and explorer keys are configured in `foundry.toml` and resolve the variables from `.env` (`ALCHEMY_API_KEY`, `ETHERSCAN_API_KEY`, `PRIVATE_KEY`).

## Tests

- Suite lives in `test/CallPolicy.t.sol` and exercises install/uninstall, token limits (per-tx + daily), recipient allow-list, batch execution, and guard rails on setters.
- Run all tests: `forge test`
- With more logs: `forge test -vv`
- Single test: `forge test --match-test Erc20TransferPassesLimitsAndRecipient`

## Project layout

- `src/CallPolicy_v3.sol` — CallPolicy smart contract (unchanged)
- `script/DeployCallPolicy.s.sol` — minimal deployment script
- `lib/` — vendored dependencies (forge-std, kernel)
- `foundry.toml` — compiler/remapping and RPC configuration

## Notes

- Deployment script expects `PRIVATE_KEY` with funds on the target network.
- The repository intentionally omits build artifacts, broadcast logs, and local env files; see `.gitignore`.
