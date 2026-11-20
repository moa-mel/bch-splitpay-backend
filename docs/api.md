# API notes

Base URL: `http://localhost:3001/api/v1`

## Health
`GET /health`

## Split preview
`POST /splits/preview`

```json
{
  "totalAmount": 1,
  "recipients": [
    { "name": "Recipient A", "address": "bitcoincash:...", "percentage": 50 },
    { "name": "Recipient B", "address": "bitcoincash:...", "percentage": 30 },
    { "name": "Recipient C", "address": "bitcoincash:...", "percentage": 20 }
  ]
}
```

## Create group
`POST /groups`

```json
{ "name": "Team trip fund", "targetAmount": 2, "creatorAddress": "bitcoincash:..." }
```

## List groups
`GET /groups`

## Add contribution
`POST /groups/:groupId/contributions`

```json
{ "contributor": "bitcoincash:...", "amount": 0.5, "transactionId": "optional-txid" }
```

Contribution records are unconfirmed by default. A future verifier must validate the transaction before marking them confirmed.
