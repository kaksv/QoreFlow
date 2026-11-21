# AI Usage Disclosure

QoreFlow was built with substantial AI assistance. This file records what that means in practice, so reviewers can weigh the work accurately.

## What AI was used for

- Drafting the Solidity contracts, Hardhat configuration, deployment scripts and tests.
- Drafting the Next.js application, components, hooks and styling.
- Drafting documentation, including the integration record and security model.
- Iterating on compiler errors, TypeScript errors and test failures.

## What was verified by a human against primary sources

- Network constants: Cosmos chain `qorechain-diana`, EVM chain **9800**, RPC `https://evm-testnet.qore.host`, REST `https://api-testnet.qore.host`.
- Precompile addresses and signatures: `pqcVerify` at `0x…0a01`, `pqcKeyStatus` at `0x…0a02`, ML-DSA-87 algorithm id **1**, public key **2592 B**, signature **4627 B**.
- The requirement that `possessionProven` be true, not just `registered`.
- EVM authorization window bounds and the fact that opening a window advances the account sequence.
- QCAI audit process (dashboard Contract Auditor, manual, EVM/Solidity setting, two stages).

These facts are recorded with source URLs in [`docs/QORECHAIN_INTEGRATION.md`](docs/QORECHAIN_INTEGRATION.md).

## What was verified by running code

- `npm run compile` — solc 0.8.24, optimizer 200, cancun.
- `npm run test:unit` — 47 passing.
- `npm run test:invariants` — 2 passing.
- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm run build` — clean.

These are local results from the repository, not claims about a deployment.

## What AI did **not** do

- It did not deploy to QoreChain.
- It did not broadcast any transaction.
- It did not run the QCAI audit.
- It did not produce the audit PDFs or invent findings.
- It did not register a post-quantum key or open an EVM window.
- It did not create the demo video, host the frontend, or publish the repository.

Those remain human-owned actions and are marked **BLOCKED** in [`SUBMISSION_CHECKLIST.md`](SUBMISSION_CHECKLIST.md).

## Review stance

AI-generated code can be plausible and wrong. Treat this repository as an unaudited testnet prototype:

- The contracts have unit and invariant tests, but **no independent human audit**.
- The QCAI Stage 1/2 reports are pending and must not be substituted with an AI review.
- The testnet evidence file contains placeholders until a real deployment happens.

If you reuse any part of this project, re-run the tests, read the contracts, and commission your own review.
