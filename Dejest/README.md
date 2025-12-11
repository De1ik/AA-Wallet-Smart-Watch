# Dejest Mobile (Expo Router)

React Native app for delegated-key wallets, built with Expo Router. Includes iOS/Android targets and an Apple Watch companion for delegated key generation.

## Prerequisites

- Node 18+ and npm
- Xcode (iOS) and/or Android SDK/Emulator
- Expo CLI: `npm install -g expo`

## Setup

1) Install dependencies`npm install`
2) Copy env template and fill in values`cp .env.example .env`
3) Start Metro bundler`npm run start`
4) Launch a target:
   - iOS simulator: `npm run ios`
   - Android emulator: `npm run android`
   - Web preview: `npm run web`

Environment variables (see `.env.example`):

- `PRIVATE_KEY` / `KERNEL`  — test-mode wallet config
- `SKIP_SEED` — skip seed verification flow
- `ZERODEV_RPC` — bundler/project config

## Useful scripts

- `npm run start` — start Expo
- `npm run ios` / `npm run android` / `npm run web` — platform targets
- `npm run reset-project` — restore the starter template
- `npm run lint` — lint with Expo config

## Project layout

- `src/app` — Expo Router entry points
- `src/modules` — feature modules (account, transactions, delegated keys, settings, etc.)
- `src/services` — API and data-layer helpers
- `src/shared` — UI primitives and utilities
- `ios` / `android` — native projects (including Apple Watch integration under iOS)

## Notes

- Apple Watch features rely on the native bridge in `ios/`; ensure a paired device/simulator when testing watch flows.
- Metro must stay running while you use simulators or devices.
