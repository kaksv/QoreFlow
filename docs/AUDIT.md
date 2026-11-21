# QCAI Audit — Stage 1 and Stage 2

> **STATUS: BLOCKED — no QCAI report has been produced.**
>
> "QCAI audit" in the Build Before Q-Day rules means the QoreChain dashboard **Contract Auditor** (`https://dashboard.qorechain.io/audit`), powered by QCAIA. It is a manual, sign-in-gated, source-only review. It cannot be run from this repository, and this repository does not contain a fabricated report.
>
> This file is the **mapping template** the owner fills in after running each stage. Reports go in `docs/audits/` as the PDFs exported by the dashboard, unchanged.

## 1. How to run the audit (owner action)

1. Sign in at <https://dashboard.qorechain.io/audit>.
2. Select the **EVM/Solidity** audit setting. Do **not** select "QoreChain (CosmWasm + PQC)" — it reports a language mismatch on Solidity and the "Not scored" quantum-readiness rating is expected.
3. Paste the exact source of:
   - `contracts/QoreFlow.sol`
   - `contracts/security/QorePQCVerifier.sol`
   - `contracts/security/IQorePQC.sol`
   - any OpenZeppelin imports the tool requires (or note that they are library code)
4. Run **Stage 1**. Export the PDF to `docs/audits/stage-1.pdf`. Do not edit it.
5. For every finding, record it in §3 below. Either fix it and add a regression test, or document precisely why it is a false positive.
6. Re-run the full local suite after any contract change.
7. Run **Stage 2** with the **same setting**. Export to `docs/audits/stage-2.pdf`.
8. Link both PDFs and this file from the README.

Audit quota: one free audit per UTC day; additional testnet audits cost test QOR.

## 2. Scope submitted

| File | Lines | Notes |
| --- | --- | --- |
| `contracts/QoreFlow.sol` | _fill in_ | Streaming, accrual, withdraw, PQC cancel |
| `contracts/security/QorePQCVerifier.sol` | _fill in_ | Key binding, PoP, length/empty-return guards |
| `contracts/security/IQorePQC.sol` | _fill in_ | Precompile interfaces |
| `@openzeppelin/contracts` | 5.0.2 | `ReentrancyGuard`, `Math` |

Compiler: `solc 0.8.24`, optimizer enabled, 200 runs, `evmVersion: cancun`.

## 3. Stage 1 findings

Replace the placeholder row with one row per finding. Use the dashboard's own severity and title verbatim.

| ID | Severity | Title | Location | Disposition | Evidence |
| --- | --- | --- | --- | --- | --- |
| _S1-01_ | _High/Medium/Low/Info_ | _dashboard title_ | _file:line_ | Fixed / False positive / Accepted risk | _commit, test name, or rationale_ |

### Disposition rules

- **Fixed** — the code changed and a regression test exists. Link both.
- **False positive** — explain the exact guard or invariant the tool missed. Cite the test that proves it.
- **Accepted risk** — only for testnet-scoped, non-fund-moving issues. State why it cannot be exploited and what would change for mainnet.

## 4. Stage 2 findings

Run only after Stage 1 findings are resolved or documented. Same table shape.

| ID | Severity | Title | Location | Disposition | Evidence |
| --- | --- | --- | --- | --- | --- |
| _S2-01_ | _…_ | _…_ | _…_ | _…_ | _…_ |

## 5. Internal review notes (not a QCAI report)

These are the issues found by manual review and covered by the local suite. They are **not** a substitute for the dashboard audit.

| Area | Review note | Covered by |
| --- | --- | --- |
| Arbitrary-key attack | `pqcVerify` alone accepts any valid key/message pair; the verifier must bind the key to the account | `PQCAuthorization.test.ts` → "rejects a supplied key that differs from the registered key" |
| Registration without PoP | `registered` alone is insufficient | "rejects a key registered without proof of possession" |
| Replay | Nonce must increment before refund | "rejects a reused nonce after a successful cancellation" |
| Cross-chain / cross-contract replay | Domain separator binds chain id and address | "rejects a wrong chain id", "rejects a wrong contract address" |
| Cross-stream replay | Stream id and action tag are signed | "rejects a wrong stream id", "rejects a wrong action type" |
| Expired authorization | Deadline checked before verification | "rejects an expired deadline before verifying the signature" |
| Inactive precompile | Empty return must revert, not decode to `false` | "fails loudly if the key-status precompile returns no data" |
| Reentrancy | CEI + `ReentrancyGuard` | "blocks reentrancy and does not increase withdrawals" |
| Excessive refund | Refund = deposit − accrued at cancel time | `invariants/Accounting.test.ts` |
| Accounting drift | Contract balance equals outstanding liabilities | `invariants/Accounting.test.ts` |
| Accrual overflow | `Math.mulDiv` | Unit suite, large-deposit cases |

## 6. Evidence index

| Artifact | Path | Status |
| --- | --- | --- |
| Stage 1 PDF | `docs/audits/stage-1.pdf` | **MISSING — owner must run** |
| Stage 2 PDF | `docs/audits/stage-2.pdf` | **MISSING — owner must run** |
| Local unit tests | `test/QoreFlow.test.ts`, `test/PQCAuthorization.test.ts` | 47 passing |
| Local invariants | `test/invariants/Accounting.test.ts` | 2 passing |
| Testnet integration | `test/testnet/PQC.testnet.ts` | Written; not yet run against the deployment |
| Deployment record | `deployments/9800.json` | **PRESENT** — Remix deployment verified on chain |

## 7. Honesty statement

If a report is not present in `docs/audits/`, the correct statement is **"QCAI audit not yet run"**. Do not describe the internal review above as a QCAI audit, and do not attach an AI-generated report as if it came from the dashboard.
