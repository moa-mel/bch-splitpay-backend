# XO integration plan

This starter deliberately does not guess undocumented XO APIs.

## Before coding the adapter

1. Inspect the official developer-wallet `package.json` and lockfile:
   - https://gitlab.com/GeneralProtocols/xo/xo-web-devtool/-/raw/development/package.json
   - https://gitlab.com/GeneralProtocols/xo/xo-web-devtool/-/raw/development/package-lock.json
2. Pin a mutually compatible set of Engine, templates, primitives, state, types, utils and sync-client packages.
3. Inspect the exact exported types and examples from the pinned packages.
4. Implement `backend/src/xo/xo-adapter.ts` against those verified types. Replace the placeholder interface if the real package types differ.

## SplitRouter

- Define the contract's recipient addresses and amounts as template state/parameters.
- Ensure the template's Cash Assembly evaluation enforces the required transaction outputs.
- Test malformed values, missing outputs, extra outputs, changed addresses and invitation merge paths.
- Backend preview calculations are for UX only. Never rely on them for enforcement.

## GroupVault

- Define contribution records and settlement conditions in the template.
- Specify participant roles, required slots, authority model, and conflict resolution.
- Explicitly decide what state is carried into follow-up invitations.
- Test a multi-wallet contribution and settlement path.

## Invitations

- Do not assume local invitation creation publishes a shareable link.
- Implement explicit export/import and test joining from a separate wallet.
- If integrating the official sync client, follow the exact pinned version's API and test remote commit propagation.

## Chipnet verification

Track these states independently:
`DRAFT -> INVITATION_CREATED -> READY_TO_EXECUTE -> BROADCAST -> CONFIRMED -> SETTLED`

A broadcast response is not confirmation. Verify transaction ID, network, recipient outputs, amounts and confirmation status using an independent Chipnet data source.
