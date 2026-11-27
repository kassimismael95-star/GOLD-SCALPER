# GOLD MOBILE EA — New Frontend

This project preserves the original Bolt React/TypeScript/Vite mobile interface and integrates it with the Flask API in `kassimismael95-star/Gold-trading-bot`.

## Run locally

```bash
npm install
cp .env.example .env
npm run dev
```

## Production build

```bash
npm run typecheck
npm run lint
npm run build
```

Vite output: `dist/`.

## Cloudflare Pages

- Connect this repository to Cloudflare Pages.
- Framework preset: Vite.
- Build command: `npm run build`.
- Build output directory: `dist`.
- Environment variable: `VITE_API_BASE_URL=https://gold-trading-bot-1-15n5.onrender.com`.

## Backend integration requirements

The frontend calls the existing Flask API. Before publishing, add the final Cloudflare Pages origin to the backend's `CORS_ORIGINS` Render environment variable. The backend currently owns authentication, entitlement decisions, payment verification, account credential encryption and command authorization.

The API uses JWT access and refresh tokens. Tokens are kept in `sessionStorage` for the active browser session; MT5 passwords are never stored in browser storage. The backend stores encrypted credentials.

### Important existing API constraints

- VIP keys are `BOSSMODE98` and `BOSSMODE99`; the trial is `BOSSMODE01D`; paid entitlements are activated after verified payment using `BOSSMODE30D` internally.
- Paid subscription plans are loaded from `GET /api/plans`; the UI does not hardcode amounts.
- Existing account creation accepts login, server, symbol, broker, mode and MT5 password. Existing account credential update only changes the MT5 password; login/server/symbol are not editable on an existing account through the current API.
- The API returns a one-time EA token on account creation. The UI displays it once; follow the backend's instructions for securely configuring the EA/agent.
- Emergency Stop is sent as `EMERGENCY_STOP`. It stops new entries; it does not close broker positions. Existing positions remain under EA management. It is not a close-all command.
- Real account creation is subject to the backend `ALLOW_LIVE_TRADING` setting and can be rejected while disabled.

## Security

Do not commit `.env`, API secrets, MT5 passwords, payment secrets, or private tokens. `VITE_*` variables are public in a browser bundle. Only the API base URL belongs here.
