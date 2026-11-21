# SplitPay — Bitcoin Cash Group Payments

SplitPay is a Bitcoin Cash-powered group payment and settlement backend. It enables users to distribute BCH between multiple recipients or collect contributions from a group into an on-chain vault.

The backend is built with **NestJS, TypeScript, Prisma, PostgreSQL, CashScript, and Libauth**, with smart contracts designed for the Bitcoin Cash Chipnet network.

## What SplitPay does

SplitPay supports two core payment workflows:

### 1. SplitRouter — Multi-recipient payments

SplitRouter allows a user to distribute one BCH payment between two recipients through a CashScript smart contract.

The contract enforces:

- Exactly two recipient outputs.
- A fixed recipient order.
- The exact satoshi amount assigned to each recipient.
- A minimum output amount of 547 satoshis.
- A fixed miner fee allowance of 1,000 satoshis.
- The exact total contract funding amount.

The contract prevents the transaction from changing the intended recipient addresses or payment amounts.

### 2. GroupVault — Group contributions

GroupVault allows multiple participants to contribute BCH towards a shared funding target.

Each group has:

- A contribution target.
- A beneficiary BCH address.
- A deterministic GroupVault contract address.
- Individual contribution records.
- Transaction verification against the contract address.

The GroupVault contract supports settlement using up to 10 funding UTXOs. It enforces that all inputs belong to the same contract, the combined input value equals the target plus the fixed miner fee, and the output pays the intended beneficiary.

## Technology stack

| Technology | Purpose |
|---|---|
| NestJS 10 | Backend API |
| TypeScript | Application development |
| PostgreSQL | Persistent application data |
| Prisma 7 | Database ORM |
| CashScript 0.14 | BCH smart contract development and execution |
| Cashc 0.14 | CashScript contract compiler |
| Libauth | BCH address decoding and locking bytecode validation |
| Electrum | Chipnet blockchain access |
| Jest | Backend testing |

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

- Node.js 22 or later
- npm
- PostgreSQL
- BCH Chipnet access
- A BCH Chipnet wallet with test funds for on-chain execution

CashScript runs through an isolated JavaScript worker so the NestJS CommonJS application can communicate with the CashScript SDK.

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

Configure the environment:

Create a `.env` file in the project root.

```env
PORT=3000

DATABASE_URL="postgresql://postgres:password@localhost:5432/splitpay?schema=public"

BCH_NETWORK=chipnet
BCH_RPC_URL=https://your-bch-node-rpc-url
BCH_RPC_USER=
BCH_RPC_PASSWORD=

FRONTEND_URL=http://localhost:3000
```

Replace the database credentials and BCH RPC URL with your own values.

`BCH_RPC_URL` is used by the backend transaction verification service. CashScript transaction execution uses its Chipnet Electrum provider.

## Database setup

Generate the Prisma client:

```bash
npx prisma generate
```

Run database migrations:

```bash
npx prisma migrate dev --name init
```

Make sure your PostgreSQL database exists before running migrations.

## Compile the smart contracts

Compile the CashScript contracts whenever their source changes:

```bash
npx cashc contracts/SplitRouter.cash -o contracts/artifacts/SplitRouter.json
```

```bash
npx cashc contracts/GroupVault.cash -o contracts/artifacts/GroupVault.json
```

The generated artifacts are loaded by the CashScript worker at runtime.

## Run the application

Development:

```bash
npm run start:dev
```

Production build:

```bash
npm run build
```

Production:

```bash
npm run start:prod
```

The API runs at:

```text
http://localhost:3000/api/v1
```

## API endpoints

All endpoints use the `/api/v1` prefix.

| Method | Endpoint | Description |
|---|---|---|
| POST | `/splits/preview` | Validate and prepare a split payment |
| POST | `/splits/execute` | Execute a funded SplitRouter contract |
| POST | `/groups` | Create a group and derive its GroupVault address |
| GET | `/groups` | Retrieve existing groups |
| POST | `/groups/:groupId/contributions` | Verify and record a BCH contribution |

### 1. Preview a split

`POST /api/v1/splits/preview`

Example request:

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

The service calculates recipient allocations in satoshis and prepares the SplitRouter contract.

The preview is not a blockchain transaction. It returns the information needed to fund and execute the contract.

### 2. Execute a split

`POST /api/v1/splits/execute`

Send the same split request after funding the returned SplitRouter contract address with the exact required amount.

The CashScript worker:

1. Derives the contract address.
2. Retrieves the contract UTXO.
3. Checks that the funding amount is exact.
4. Builds the transaction with the required recipient outputs.
5. Executes the contract's `distribute()` function.
6. Broadcasts the transaction through Chipnet.

### 3. Create a group

`POST /api/v1/groups`

Example request:

```json
{
  "name": "Birthday Celebration",
  "description": "Group contributions for a birthday celebration.",
  "targetAmount": 0.5,
  "creatorAddress": "bchtest:YOUR_BENEFICIARY_ADDRESS"
}
```

The response includes the group information, derived GroupVault address, network, and required funding amount.

Participants can send their BCH contributions to the returned vault address.

### 4. Record a contribution

`POST /api/v1/groups/:groupId/contributions`

Example request:

```json
{
  "contributor": "Participant One",
  "amount": 0.1,
  "transactionId": "YOUR_64_CHARACTER_BCH_TRANSACTION_ID"
}
```

Before recording the contribution, the backend:

- Retrieves the transaction from the BCH node.
- Checks its outputs for payment to the group's GroupVault address.
- Verifies that the payment amount matches the submitted contribution.
- Prevents duplicate transaction records for the same group.
- Records whether the transaction has confirmations.

A submitted transaction ID alone is not accepted as proof of payment.

## Smart contract security and funding rules

### SplitRouter

- Requires exactly one contract funding UTXO.
- Requires exactly two recipient outputs.
- Requires distinct recipient public-key hashes.
- Enforces the exact recipient amounts.
- Requires total input value to equal both payouts plus 1,000 satoshis.

### GroupVault

- Supports between 1 and 10 contract funding inputs.
- Requires all inputs to belong to the same GroupVault contract.
- Requires combined funding to equal the target plus 1,000 satoshis.
- Allows exactly one settlement output.
- Enforces payment to the configured beneficiary.

Both contracts use a fixed 1,000-satoshi fee allowance. Transactions must satisfy the contract's exact funding conditions.

## Network

The current blockchain integration targets **Bitcoin Cash Chipnet**.

- Contract address generation: CashScript.
- Contract UTXO retrieval: Electrum.
- Transaction execution: CashScript TransactionBuilder.
- Transaction verification: BCH JSON-RPC.

The worker currently accepts Chipnet P2PKH addresses with the `bchtest` prefix.

Use test funds only. Do not send real BCH to these test contracts.

## Current implementation status

| Feature | Status |
|---|---|
| NestJS API | Implemented |
| PostgreSQL and Prisma integration | Implemented |
| SplitRouter CashScript contract | Implemented |
| GroupVault CashScript contract | Implemented |
| Contract artifact generation | Implemented |
| CashScript worker integration | Implemented |
| Split preview endpoint | Implemented |
| Split execution endpoint | Implemented |
| Group creation and vault address derivation | Implemented |
| Contribution transaction verification | Implemented |
| Chipnet live transaction testing | Requires funded end-to-end testing |
| GroupVault settlement API endpoint | Not yet exposed |
| Invitation export/import and cross-wallet synchronization | Not yet implemented |

Implementation status describes the code currently in the project; it does not imply that every blockchain workflow has passed live Chipnet testing.

## Development roadmap

1. Complete funded Chipnet testing for SplitRouter.
2. Test GroupVault contributions using multiple funding UTXOs.
3. Expose and test the GroupVault settlement endpoint.
4. Improve transaction confirmation handling and contribution accounting.
5. Implement invitation export/import and cross-wallet synchronization.
6. Add automated contract and integration tests.

## Contributing

Contributions, bug reports, and suggestions are welcome.

When contributing smart contract changes, compile the contracts and verify the resulting artifacts before submitting a pull request.

## Disclaimer

SplitPay is currently a development project targeting Bitcoin Cash Chipnet. It is intended for testing and demonstration purposes.

Do not use it to manage real funds until the contracts, transaction flows, and security assumptions have been independently reviewed and tested.

## License

Add your chosen open-source license before distributing the project.
