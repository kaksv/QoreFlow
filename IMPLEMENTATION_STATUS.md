# Implementation Status

Last updated: 21 November 2026.

## Summary

| Phase | State |
| --- | --- |
| 0. Research and verified integration facts | Complete |
| 1. Contracts | Complete and compile-clean |
| 2. Local tests | 47 unit + 2 invariant, all passing |
| 3. Scripts | Deployment + read-only verification written |
| 4. Frontend | Builds clean; typecheck and lint clean |
| 5. Documentation | Complete, with blocked items marked |
| 6. CI | Workflow written |
| 7. Testnet deployment | **Deployed** to Diana 9800 (Remix, 20 Nov 2026); verified by on-chain reads |
| 8. QCAI audit | **Blocked** on owner dashboard session |
| 9. Submission media | Human-owned |

## 1. Contracts

| File | State | Notes |
| --- | --- | --- |
| `contracts/QoreFlow.sol` | Done | Streams, accrual via `Math.mulDiv`, recipient-only withdraw, PQC cancel, `ReentrancyGuard` |
| `contracts/security/QorePQCVerifier.sol` | Done | Key binding, PoP, length checks, empty-return guard, immutable wiring |
| `contracts/security/IQorePQC.sol` | Done | Exact precompile interfaces |
| `contracts/test/MockQorePrecompiles.sol` | Done | Test doubles only; never deployed |
| `contracts/test/TestRecipients.sol` | Done | Reentrancy and rejecting-transfer recipients |

Compiler: `solc 0.8.24`, optimizer enabled (200 runs), `evmVersion: cancun`.

## 2. Tests

| Suite | Count | State |
| --- | --- | --- |
| Stream creation | 8 | Passing |
| Accrual | 10 | Passing |
| Withdrawal and reentrancy | 8 | Passing |
| PQC cancellation | 20 | Passing |
| Authorization encoding | 1 | Passing |
| Accounting invariants | 2 | Passing |
| **Total** | **49** | **Passing** |
| Real testnet PQC | 6 | Written, **not run** (blocked) |

Commands:

```bash
npm run test:unit
npm run test:invariants
npm run test:testnet   # requires real env
```

## 3. Scripts

| Script | State |
| --- | --- |
| `scripts/deploy.ts` | Done — refuses non-9800, asserts canonical wiring, writes `deployments/9800.json` |
| `scripts/verify-deployment.ts` | Done — read-only, checks bytecode, wiring, stream count |

`scripts/deploy.ts` was **not** used: the deployment was made from Remix IDE
(solc 0.8.24, optimizer 200, cancun). The resulting addresses were then verified
with read-only RPC calls, and `deployments/9800.json` records them together with
both deploy transactions. A redeploy should use the script so the artifact is
produced automatically.

## 4. Frontend

| Route / module | State |
| --- | --- |
| `/` landing page | Done |
| `/dashboard` | Done |
| `/streams/create` | Done |
| `/streams/[id]` | Done |
| `/security` | Done |
| Wallet session (`hooks/useWallet.tsx`) | Done — EIP-1193, chain switch, restore, events |
| Stream reads (`lib/blockchain/streams.ts`) | Done — chunked logs, live accrual |
| PQC signer (`lib/pqc/signer.ts`) | Done — import, sign, local verify, fingerprint |
| PQC status (`lib/pqc/status.ts`) | Done — key status + tolerant window parser |
| Cancel panel | Done — hard-blocks on missing key/PoP, wipes secret key after signing |

Verified commands:

```
npm run typecheck  → clean
npm run lint       → clean
npm run build      → clean
```

## 5. Documentation

| File | State |
| --- | --- |
| `README.md` | Done |
| `docs/QORECHAIN_INTEGRATION.md` | Done |
| `docs/ARCHITECTURE.md` | Done |
| `docs/SECURITY.md` | Done |
| `docs/AUDIT.md` | Template; reports blocked |
| `docs/TESTNET_EVIDENCE.md` | Template; evidence blocked |
| `docs/DEMO_SCRIPT.md` | Done |
| `AI_USAGE.md` | Done |
| `SUBMISSION_CHECKLIST.md` | Done |
| `LICENSE` | Done |

## 6. CI

`.github/workflows/ci.yml` runs on Node 22:

1. `npm ci`
2. `npm run compile`
3. `npm run typecheck`
4. `npm run lint`
5. `npm run test:unit`
6. `npm run test:invariants`
7. `npm run build`

The testnet suite is excluded because it needs a funded account and broadcasts nothing but still requires live credentials.

## 7. Blocked items and owners

| Item | Why blocked | Owner |
| --- | --- | --- |
| Stream transactions (`createStream`, `withdraw`, `cancelStream`) | Deployment window is consumed; a new window scoped to QoreFlow must be opened, and broadcasting needs explicit approval | Human |
| `test:testnet` run | Needs `TESTNET_*` env; the suite is read-only and needs no window | Human |
| QCAI Stage 1/2 | Manual dashboard session, source-only | Human |
| Demo video | Recording and narration | Human |
| Hosted frontend | Vercel/host account | Human |
| Public repo | Publishing decision | Human |


## 8. Known gaps

- No independent human audit.
- No mainnet support (precompiles inactive).
- No source verification on the explorer.
- The window REST endpoint requires a bech32 (`qor1…`) address and refuses 0x; the app proxies and converts it. Field names beyond the verified payload are still parsed tolerantly and raw JSON stays visible.
- The app does not generate or back up ML-DSA-87 keys.
- Stream discovery scans event logs; for a very old deployment, set `NEXT_PUBLIC_DEPLOY_BLOCK`.

## 9. Definition of done

The project is submission-complete when:

1. CI is green on the published repository.
2. `docs/audits/stage-1.pdf` and `stage-2.pdf` exist and `docs/AUDIT.md` maps every finding.
3. `docs/TESTNET_EVIDENCE.md` has explorer-linked hashes and the `test:testnet` output.
4. The hosted frontend points at the deployed contract.
5. The demo video follows `docs/DEMO_SCRIPT.md`.
6. The claims audit in `SUBMISSION_CHECKLIST.md` passes.
