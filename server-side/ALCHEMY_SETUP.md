# Alchemy Integration Setup Guide

This guide explains how to configure Alchemy API to track all transactions including ETH transfers.

## Why Alchemy?

Alchemy provides comprehensive transaction tracking including:
- ✅ ETH transfers (native currency)
- ✅ ERC-20 token transfers (USDC, USDT, DAI, etc.)
- ✅ Internal transactions (smart wallet executions)
- ✅ NFT transfers (ERC-721, ERC-1155)
- ✅ Transaction status and timestamps

## Setup Instructions

### 1. Get Your Alchemy API Key

1. Go to https://dashboard.alchemy.com/
2. Sign up or log in
3. Create a new app or use an existing one
4. Select **Sepolia testnet**
5. Copy your **API Key**

### 2. Add API Key to Environment

Create a `.env` file in the `server-side` directory:

```bash
cd server-side
touch .env
```

Add the following content:

```env
PORT=4000
ALCHEMY_API_KEY=your_alchemy_api_key_here
```

Replace `your_alchemy_api_key_here` with your actual Alchemy API key.

### 3. Restart the Server

```bash
cd server-side
npm run dev
```

## What This Enables

With Alchemy configured, your mobile app will now show:

- ✅ All ETH transfers (sent and received)
- ✅ All token transfers (USDC, USDT, DAI, etc.)
- ✅ Transactions made from mobile
- ✅ Transactions made from smart watch (delegated keys)
- ✅ Internal transactions within your smart wallet
- ✅ Module installation events
- ✅ Complete transaction history with timestamps

## Fallback Behavior

If Alchemy is not configured, the app will still work but will only show:
- ERC-20 token transfers for configured tokens
- No native ETH transfers
- No internal transaction details

## Monitoring

Once configured, check the server logs:

```bash
[Transaction History] Using Alchemy to fetch transactions
[Transaction History] Found X outbound and Y inbound transfers
```

## Free Tier

Alchemy offers a generous free tier that should be sufficient for development:
- 300M compute units per month
- Unlimited requests
- No credit card required

