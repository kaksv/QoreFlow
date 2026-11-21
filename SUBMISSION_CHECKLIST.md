# Submission Checklist

Deadline: **2 December 2026, 23:59 UTC**. Category: **Post-Quantum dApp**.

Status legend: **DONE** = in this repository and verified locally · **BLOCKED** = requires owner action or external account · **HUMAN** = not a code deliverable.

## 1. Code and tests

- [x] **DONE** — `QoreFlow.sol` streams, accrues, withdraws, cancels with PQC auth.
- [x] **DONE** — `QorePQCVerifier.sol` account→key binding, PoP, length/empty-return guards.
- [x] **DONE** — 47 unit tests + 2 invariant tests passing.
- [x] **DONE** — TypeScript strict typecheck clean.
- [x] **DONE** — ESLint clean.
- [x] **DONE** — Production build clean.
- [x] **DONE** — Real-precompile testnet suite written (`test/testnet/PQC.testnet.ts`).
- [ ] **BLOCKED** — Real-precompile suite executed against chain 9800.
- [x] **DONE** — Contracts deployed to Diana testnet on 20 Nov 2026 (`QoreFlow 0x5963…3140`, verifier `0x1694…61f4`).
- [x] **DONE** — `deployments/9800.json` produced from verified on-chain reads.
- [ ] **BLOCKED** — Stream transactions (`createStream`, `withdraw`, `cancelStream`) linked in `docs/TESTNET_EVIDENCE.md`; the deployment window is consumed.

## 2. Post-quantum requirements

- [x] **DONE** — `pqcVerify` called on the real precompile address in production wiring.
- [x] **DONE** — `pqcKeyStatus` read and enforced (`registered`, `algorithmId == 1`, `possessionProven`).
- [x] **DONE** — Supplied pubkey must match the registered pubkey byte-for-byte.
- [x] **DONE** — No classical-only cancellation fallback.
- [x] **DONE** — Authorization binds domain, action, sender, stream, nonce, deadline.
- [x] **DONE** — Nonce increments before refund (single-use).
- [x] **DONE** — Withdrawal is recipient-only.
- [x] **DONE** — UI never labels a connected wallet "quantum secure".
- [x] **DONE** — Registered ML-DSA-87 key with proof of possession on the deployer account (`registered=true`, `algorithmId=1`, `possessionProven=true`).
- [ ] **BLOCKED** — Open EVM window scoped to QoreFlow for the demo.

## 3. QCAI audit (two stages)

- [ ] **HUMAN/BLOCKED** — Stage 1 run in `dashboard.qorechain.io/audit` with EVM/Solidity setting.
- [ ] **HUMAN/BLOCKED** — `docs/audits/stage-1.pdf` exported unchanged.
- [ ] **HUMAN/BLOCKED** — Every Stage 1 finding mapped in `docs/AUDIT.md`.
- [ ] **HUMAN/BLOCKED** — Stage 2 run with the same setting.
- [ ] **HUMAN/BLOCKED** — `docs/audits/stage-2.pdf` exported unchanged.
- [ ] **HUMAN/BLOCKED** — README links both reports.

## 4. Frontend

- [x] **DONE** — Landing page with product, security model, FAQ.
- [x] **DONE** — Dashboard with live incoming/outgoing streams and activity.
- [x] **DONE** — Create-stream form with RHF + Zod validation.
- [x] **DONE** — Stream detail with recipient withdraw.
- [x] **DONE** — Sender cancellation panel with local ML-DSA-87 signing and on-chain verification.
- [x] **DONE** — Security page with verified / wallet-reported / unknown tiers.
- [x] **DONE** — Wrong-network and no-wallet states.
- [x] **DONE** — `NEXT_PUBLIC_CONTRACT_ADDRESS` set in `.env.local` to the deployed QoreFlow.
- [x] **DONE** — Window REST calls proxied with 0x → bech32 conversion (0x is rejected upstream).
- [ ] **HUMAN** — Hosted URL (Vercel or equivalent).

## 5. Documentation

- [x] **DONE** — `README.md` with verified results and honest limitations.
- [x] **DONE** — `docs/QORECHAIN_INTEGRATION.md` with sources and exact ABIs.
- [x] **DONE** — `docs/ARCHITECTURE.md`.
- [x] **DONE** — `docs/SECURITY.md` threat model.
- [x] **DONE** — `docs/AUDIT.md` template (reports blocked).
- [x] **DONE** — `docs/TESTNET_EVIDENCE.md` template (evidence blocked).
- [x] **DONE** — `docs/DEMO_SCRIPT.md`.
- [x] **DONE** — `AI_USAGE.md`.
- [x] **DONE** — `SUBMISSION_CHECKLIST.md`.
- [x] **DONE** — `IMPLEMENTATION_STATUS.md`.
- [x] **DONE** — `LICENSE`.
- [x] **DONE** — Deployment hashes and canonical-wiring evidence recorded in `docs/TESTNET_EVIDENCE.md`.
- [ ] **BLOCKED** — Stream-transaction hashes and `test:testnet` output still missing.

## 6. Submission package

- [ ] **HUMAN** — Public GitHub repository (or zip).
- [ ] **HUMAN** — Demo video ≤ 3 minutes, following `docs/DEMO_SCRIPT.md`.
- [ ] **HUMAN** — Hosted frontend URL.
- [ ] **HUMAN** — Confirm originality/licence rules against `build.qorechain.io/rules`.
- [ ] **HUMAN** — Submit before **2 Dec 2026 23:59 UTC**.

## 7. Final pre-submission commands

```bash
npm ci
npm run compile
npm run test:unit
npm run test:invariants
npm run typecheck
npm run lint
npm run build
```

All must pass with no warnings that affect correctness. Then run `npm run test:testnet` with the real environment.

## 8. Claims audit

Read the submitted text and confirm:

- [ ] No sentence says EVM transactions carry post-quantum signatures.
- [ ] No sentence calls a connected wallet quantum secure.
- [ ] No sentence claims a QCAI audit has passed.
- [ ] No screenshot or hash is fabricated.
- [ ] "Testnet only" is stated where deployment is discussed.
