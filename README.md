# SplitPay

A separate-frontend/separate-backend starter for a Bitcoin Cash group-contribution and payment-distribution app.

## Project layout

- `frontend/` — Next.js + TypeScript dashboard.
- `backend/` — NestJS REST API + Prisma + PostgreSQL.
- `docs/` — implementation notes and XO integration boundary.

## Important implementation boundary

This starter includes working application scaffolding for split previews, group creation, and contribution records. **It does not yet implement or claim to implement XO contract enforcement, XO invitation synchronization, or Chipnet broadcasting.** Those must be connected to the exact compatible XO Engine/template APIs and tested on Chipnet. Backend split calculations are previews only; they are not a substitute for SplitRouter's on-chain output enforcement.

## Requirements

- Node.js 20+
- PostgreSQL 15+
- npm

## 1. Start the backend

```bash
cd backend
cp .env.example .env
npm install
# Create the PostgreSQL database named splitflow first.
npx prisma generate
npx prisma migrate dev --name init
npm run start:dev
```

Backend defaults to `http://localhost:3001/api/v1`.

## 2. Start the frontend

In another terminal:

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`.

## Current API

- `GET /api/v1/health`
- `POST /api/v1/splits/preview`
- `POST /api/v1/groups`
- `GET /api/v1/groups`
- `POST /api/v1/groups/:groupId/contributions`

## Next milestones

1. Confirm the XO Engine and templates versions against the official developer-wallet manifest/lockfile.
2. Implement SplitRouter as a real XO template with contract-enforced outputs.
3. Implement GroupVault contribution and settlement actions.
4. Implement invitation export/import and cross-wallet synchronization.
5. Implement Chipnet transaction broadcast and independent output/confirmation verification.

See `docs/xo-integration.md` before adding XO code.
