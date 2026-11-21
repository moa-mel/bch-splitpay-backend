# SplitPay — Bitcoin Cash Group Payments

SplitPay is a Bitcoin Cash (BCH) group payment backend that makes it easier to distribute payments between multiple recipients and collect contributions towards shared goals.

Built with NestJS, TypeScript, CashScript, Prisma, and PostgreSQL, SplitPay uses Bitcoin Cash smart contracts to enforce payment conditions on-chain.

The project currently targets **Bitcoin Cash Chipnet** for development and testing.

## Features

### 1. SplitRouter — Multi-recipient payments

SplitRouter allows users to divide a BCH payment between two recipients through a CashScript smart contract.

The contract enforces:

- Exactly two recipient outputs.
- A fixed recipient order.
- Exact satoshi amounts for each recipient.
- A minimum output amount of 547 satoshis.
- A fixed miner fee allowance of 1,000 satoshis.
- Exact contract funding requirements.

These rules prevent the transaction from changing the intended recipient addresses or payment amounts.

### 2. GroupVault — Group contributions

GroupVault allows multiple participants to contribute BCH towards a shared funding target.

Each group includes:

- A group name and optional description.
- A target contribution amount.
- A creator/beneficiary BCH address.
- A derived GroupVault contract address.
- Individual contribution records.
- Transaction verification against the contract address.

The GroupVault contract supports settlement using up to 10 funding UTXOs. It enforces the required funding amount and beneficiary output.

### 3. Invitation export and import

SplitPay includes a signed invitation system for sharing split and group payment information.

The invitation service supports:

- Exporting SPLIT and GROUP invitations.
- Encoding invitation data into a portable Base64URL string.
- Signing invitation payloads with HMAC-SHA256.
- Configurable expiration between 1 and 168 hours.
- Importing and validating invitation signatures.
- Checking invitation expiration.
- Checking that the invitation belongs to the configured BCH network.

Invitations are stateless: they are signed and encoded without being stored in the database.

**Important:** Invitations are signed, not encrypted. Do not include private keys, passwords, or other secrets in invitation data. Export/import provides portable data sharing; it does not automatically synchronize wallets or execute payments.

## Technology stack

| Technology | Purpose |
|---|---|
| NestJS 10 | Backend framework |
| TypeScript | Application development |
| PostgreSQL | Persistent application data |
| Prisma 7 | Database ORM |
| CashScript 0.14 | BCH smart contracts |
| Cashc 0.14 | CashScript compiler |
| Libauth | BCH address and bytecode utilities |
| Electrum | Chipnet blockchain connectivity |
| WebSocket (`ws`) | Electrum communication |
| Jest | Automated testing |

## Architecture

```text
Frontend (Next.js)
       |
       v
NestJS REST API
       |
       +----------------------+
       |                      |
       v                      v
   SplitRouter             GroupVault
       |                      |
       v                      v
 CashScript Worker       CashScript Worker
       |                      |
       +----------+-----------+
                  |
                  v
          BCH Chipnet
                  |
                  v
          Electrum Server

NestJS API
    |
    +---- PostgreSQL / Prisma
    |
    +---- Invitation Service
    |       |
    |       +---- HMAC-SHA256 signing
    |       +---- Invitation export/import
    |
    +---- Blockchain Services
            |
            +---- Transaction broadcasting
            +---- Transaction retrieval
            +---- Confirmation verification
```

## Project structure

```text
bch-splitpay-backend/
├── contracts/
│   ├── SplitRouter.cash
│   ├── GroupVault.cash
│   └── artifacts/
│       ├── SplitRouter.json
│       └── GroupVault.json
│
├── scripts/
│   └── cashscript-worker.mjs
│
├── prisma/
│   └── schema.prisma
│
├── src/
│   ├── health/
│   ├── common/
│   │   └── interceptors/
│   ├── modules/
│   │   ├── blockchain/
│   │   ├── contracts/
│   │   │   ├── split-router/
│   │   │   └── group-vault/
│   │   ├── groups/
│   │   ├── invitations/
│   │   └── splits/
│   ├── prisma/
│   ├── app.module.ts
│   └── main.ts
│
├── package.json
└── README.md
```

## Requirements

- Node.js 22 or later.
- npm.
- PostgreSQL.
- Access to a BCH Chipnet Electrum server over WebSocket.
- BCH Chipnet test funds for on-chain transactions.

You do not need to run a local Bitcoin Cash node. The backend connects to an Electrum server for blockchain operations.

## Installation

Clone the repository:

```bash
git clone https://github.com/moa-mel/bch-splitpay-backend.git
cd bch-splitpay-backend
```

Install dependencies:

```bash
npm install
```

## Environment configuration

Create a `.env` file in the project root.

```env
# Application
PORT=3000

# PostgreSQL
DATABASE_URL="postgresql://postgres:password@localhost:5432/splitpay?schema=public"

# Bitcoin Cash network
BCH_NETWORK=chipnet

# BCH Chipnet Electrum WebSocket endpoint
BCH_ELECTRUM_URL=wss://electrum-chipnet.optnlabs.com

# Invitation signing secret
INVITATION_SECRET=replace_with_a_random_secret_of_at_least_32_characters

# Frontend URL
FRONTEND_URL=http://localhost:3001
```

Generate a secure invitation secret:

```bash
openssl rand -hex 32
```

Copy the generated value into `INVITATION_SECRET`.

Keep your `.env` file private. Never commit secrets or production credentials to GitHub.

The Electrum endpoint must support the Electrum JSON-RPC methods used by the application. Confirm server availability before relying on it for live transactions.

**Note:** The current blockchain provider uses `BCH_ELECTRUM_URL`. The previous `BCH_RPC_URL`, `BCH_RPC_USER`, and `BCH_RPC_PASSWORD` configuration is not used by the current Electrum provider.

## Database setup

Make sure PostgreSQL is running and the database specified in `DATABASE_URL` exists.

Generate the Prisma client:

```bash
npx prisma generate
```

Run database migrations:

```bash
npx prisma migrate dev
```

## Compile the smart contracts

Compile the contracts whenever their source files change.

SplitRouter:

```bash
npx cashc contracts/SplitRouter.cash -o contracts/artifacts/SplitRouter.json
```

GroupVault:

```bash
npx cashc contracts/GroupVault.cash -o contracts/artifacts/GroupVault.json
```

The generated artifacts are used by the CashScript worker.

## Run the application

Start the backend in development mode:

```bash
npm run start:dev
```

Build the application:

```bash
npm run build
```

Start the production build:

```bash
npm run start:prod
```

The API uses the following base URL:

```text
http://localhost:3000/api/v1
```

## API documentation

All endpoints use the `/api/v1` prefix.

| Method | Endpoint | Description |
|---|---|---|
| POST | `/splits/preview` | Preview and validate a split payment |
| POST | `/splits/execute` | Execute a funded SplitRouter contract |
| POST | `/groups` | Create a group and derive its GroupVault address |
| GET | `/groups` | Retrieve existing groups |
| POST | `/groups/:groupId/contributions` | Verify and record a contribution |
| POST | `/invitations/export` | Create a signed invitation |
| POST | `/invitations/import` | Decode and validate an invitation |

### 1. Preview a split payment

**Endpoint**

```http
POST /api/v1/splits/preview
```

**Request**

```json
{
  "totalAmount": 0.1,
  "recipients": [
    {
      "name": "Recipient One",
      "address": "bchtest:YOUR_FIRST_RECIPIENT_ADDRESS",
      "percentage": 60
    },
    {
      "name": "Recipient Two",
      "address": "bchtest:YOUR_SECOND_RECIPIENT_ADDRESS",
      "percentage": 40
    }
  ]
}
```

The service calculates the recipient allocations in satoshis and prepares the SplitRouter contract information.

This endpoint provides a preview. It does not broadcast a blockchain transaction.

### 2. Execute a split payment

**Endpoint**

```http
POST /api/v1/splits/execute
```

Submit the split details after funding the returned SplitRouter contract address with the required amount.

The execution workflow uses the CashScript worker to:

1. Derive the contract address.
2. Retrieve the contract UTXO.
3. Validate the funding amount.
4. Construct the required recipient outputs.
5. Execute the contract's `distribute()` function.
6. Broadcast the transaction to BCH Chipnet.

Use Chipnet test funds only.

### 3. Create a group

**Endpoint**

```http
POST /api/v1/groups
```

**Request**

```json
{
  "name": "Birthday Celebration",
  "description": "Group contributions for a birthday celebration.",
  "targetAmount": 0.5,
  "creatorAddress": "bchtest:YOUR_BENEFICIARY_ADDRESS"
}
```

The service creates the group and derives its GroupVault contract address.

Participants can send BCH contributions to the returned vault address.

### 4. Retrieve groups

**Endpoint**

```http
GET /api/v1/groups
```

Returns the groups stored by the application.

### 5. Record a group contribution

**Endpoint**

```http
POST /api/v1/groups/:groupId/contributions
```

**Request**

```json
{
  "contributor": "Participant One",
  "amount": 0.1,
  "transactionId": "YOUR_64_CHARACTER_BCH_TRANSACTION_ID"
}
```

The backend verifies the submitted transaction before recording the contribution.

The verification process checks:

- That the transaction can be retrieved.
- That one of its outputs pays the group's GroupVault address.
- That the output amount matches the submitted contribution.
- That the transaction has not already been recorded for the same group.
- The transaction's confirmation status.

A transaction ID alone is not accepted as proof of payment.

### 6. Export an invitation

**Endpoint**

```http
POST /api/v1/invitations/export
```

**Request**

```json
{
  "type": "GROUP",
  "data": {
    "groupId": "YOUR_GROUP_ID",
    "name": "Birthday Celebration",
    "targetAmount": 0.5,
    "vaultAddress": "bchtest:YOUR_GROUP_VAULT_ADDRESS"
  },
  "expiresInHours": 24
}
```

For a split invitation, use `"type": "SPLIT"` and provide the relevant split information in `data`.

The expiration value is optional and defaults to 24 hours. The allowed range is 1–168 hours.

The response includes:

- Invitation ID.
- Invitation type.
- BCH network.
- Expiration timestamp.
- Encoded invitation string.

The encoded string can be shared with another participant.

### 7. Import an invitation

**Endpoint**

```http
POST /api/v1/invitations/import
```

**Request**

```json
{
  "encoded": "PASTE_BASE64URL_ENCODED_INVITATION_HERE"
}
```

The service:

1. Decodes the invitation.
2. Validates its structure.
3. Verifies its HMAC-SHA256 signature.
4. Checks that it has not expired.
5. Checks that it belongs to the configured BCH network.

A valid invitation returns the original invitation payload.

Importing an invitation does not automatically execute a payment or synchronize wallet balances.

## Smart contract funding rules

### SplitRouter

The SplitRouter contract enforces:

- One contract funding UTXO.
- Exactly two recipient outputs.
- Distinct recipient public-key hashes.
- Exact recipient payment amounts.
- A total input value equal to the combined payouts plus the fixed miner fee allowance.

### GroupVault

The GroupVault contract enforces:

- Between 1 and 10 funding inputs.
- All inputs belonging to the same GroupVault contract.
- Combined funding equal to the target amount plus the fixed miner fee allowance.
- Exactly one settlement output.
- Payment to the configured beneficiary.

Both contracts currently use a fixed miner fee allowance of 1,000 satoshis. Transactions must satisfy the contract's exact funding conditions.

## Blockchain connectivity

SplitPay targets Bitcoin Cash Chipnet.

The current integration uses:

- **CashScript:** Contract compilation and execution.
- **Electrum WebSocket:** Blockchain communication.
- **Transaction broadcasting:** Electrum transaction broadcast method.
- **Transaction retrieval:** Electrum transaction retrieval.
- **Confirmation verification:** Transaction height and current chain height.

The backend uses a WebSocket Electrum endpoint rather than a local BCH node JSON-RPC endpoint.

The Electrum connection and live transaction flow should be tested against the selected server before production use.

## Frontend integration

The frontend is maintained separately:

[SplitPay Frontend](https://github.com/moa-mel/bch-split-pay-frontend)

Configure the frontend to use the backend API:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
```

For local development, run the Next.js frontend on port 3001 because the backend defaults to port 3000.

```bash
npm run dev -- -p 3001
```

Configure the backend CORS environment variable accordingly:

```env
FRONTEND_URL=http://localhost:3001
```

The core split and group API operations are available to the frontend. Invitation export/import endpoints are available in the backend; frontend invitation UI and API integration must be implemented separately.

## Implementation status

| Feature | Status |
|---|---|
| NestJS REST API | Implemented |
| PostgreSQL and Prisma integration | Implemented |
| SplitRouter smart contract | Implemented |
| GroupVault smart contract | Implemented |
| CashScript worker integration | Implemented |
| Split preview endpoint | Implemented |
| Split execution endpoint | Implemented |
| Group creation and vault address derivation | Implemented |
| Contribution transaction verification | Implemented |
| Invitation export endpoint | Implemented |
| Invitation import endpoint | Implemented |
| HMAC-SHA256 invitation signing | Implemented |
| Electrum WebSocket provider | Implemented in code; live connectivity requires testing |
| Funded Chipnet end-to-end testing | Requires verification |
| GroupVault settlement API endpoint | Not yet exposed |
| Frontend invitation interface | Not yet integrated |
| Automatic cross-wallet synchronization | Not implemented |

Implementation status describes the current code structure. It does not mean that every blockchain operation has passed funded end-to-end testing.

## Testing

Run the backend tests:

```bash
npm test
```

Build the application:

```bash
npm run build
```

Before relying on the application, verify:

1. The backend starts successfully with the configured environment.
2. PostgreSQL connects and Prisma migrations complete.
3. The Electrum WebSocket server responds to the required methods.
4. SplitRouter can execute a funded Chipnet transaction.
5. GroupVault contributions are verified against actual Chipnet transactions.
6. Invitation export and import work with matching signing secrets.
7. Expired, invalidly signed, and wrong-network invitations are rejected.

## Roadmap

- Complete funded Chipnet testing for SplitRouter.
- Verify GroupVault contributions using multiple funding UTXOs.
- Implement and expose the GroupVault settlement API.
- Integrate invitation export/import into the frontend.
- Improve contribution accounting and confirmation handling.
- Add more comprehensive automated integration and contract tests.
- Evaluate replay prevention and invitation revocation requirements.

## Security considerations

- Never commit private keys, signing secrets, or database credentials.
- Use BCH Chipnet for development and testing.
- Keep the invitation signing secret secure and consistent across backend instances that need to validate the same invitations.
- Do not treat imported invitation data as automatically trusted payment instructions.
- Independently review smart contract assumptions before handling real funds.
- Validate all transaction details before recording contributions.

## Disclaimer

SplitPay is a development project targeting Bitcoin Cash Chipnet. It is intended for testing and demonstration purposes.

Do not use it to manage real funds until its smart contracts, transaction workflows, and security assumptions have been independently reviewed and tested.

## License

No license has been specified yet. Add an appropriate open-source license before distributing or accepting external contributions.