# QoreFlow

**Continuous QOR payment streams with post-quantum authorized cancellation, built for QoreChain Diana testnet.**

QoreFlow is an entry for the **QoreChain Build Before Q-Day** hackathon, **Post-Quantum dApp** category.

A sender locks QOR in a stream. The recipient accrues a pro-rata share every second and can withdraw it at any time. Cancelling a stream — the action that decides when accrual stops and returns the unvested balance — requires an **ML-DSA-87 (FIPS-204) signature** verified on chain by QoreChain's `pqcVerify` precompile, bound to the sender's registered key, this chain, this contract, this stream, an action tag, a per-sender nonce and a deadline.

> **Honest security statement.** EVM transactions on QoreChain are still signed with classical secp256k1, like every EVM transaction. The post-quantum signature is an **additional authorization layer** checked by `QoreFlow`. This repository never claims that EVM transactions carry PQ signatures, and the UI never labels a connected wallet "quantum secure".

---

## Status

| Area | State |
| --- | --- |
| Contracts (`QoreFlow`, `QorePQCVerifier`) | Written, compile clean (solc 0.8.24, optimizer 200, cancun) |
| Local tests | **49 passing**: 47 unit + 2 invariant |
| Frontend | Next.js 15 App Router, builds clean; typecheck and lint clean |
| Testnet deployment | **DEPLOYED** on Diana (chain 9800), 20 Nov 2026 — `QoreFlow` at [`0x5963…3140`](https://explore.qore.network/address/0x5963C1Fb94e71BBDaF74AD6d2E9a2573c5d93140), verifier at [`0x1694…61f4`](https://explore.qore.network/address/0x1694b895a12Ab327512D01A91E3C9dfe506E61f4) |
| Real testnet evidence | **PARTIAL** — deployment and canonical wiring verified on chain; stream transactions and `test:testnet` output pending a new interaction window. See [`docs/TESTNET_EVIDENCE.md`](docs/TESTNET_EVIDENCE.md) |
| QCAI audit (Stage 1 + 2) | **BLOCKED** — must be run manually in the dashboard; see [`docs/AUDIT.md`](docs/AUDIT.md) |
| Demo video / hosted URL / public repo | Human-owned deliverables; see [`SUBMISSION_CHECKLIST.md`](SUBMISSION_CHECKLIST.md) |

Nothing in the "BLOCKED" or "PARTIAL" rows is faked. When an item cannot be produced by code alone, the repository marks it as blocked rather than inventing output.

---

## Why this design

Payment streaming is a good fit for post-quantum authorization because only one action is *sensitive*:

| Action | Who | Extra authorization |
| --- | --- | --- |
| `createStream` | sender | normal EVM transaction |
| `withdraw` | recipient only | normal EVM transaction; can only move already-vested funds |
| `cancelStream` | sender only | **ML-DSA-87 signature verified on chain** |

Cancellation is where an attacker would want to stop a recipient's income or redirect the unvested balance. Withdrawal cannot be abused to take more than the recipient earned. So the expensive post-quantum check (≈85–90k gas) is applied where it matters, and nowhere else.

The network adds a second layer: QoreChain only admits an EVM transaction when the sender has a registered ML-DSA-87 key **and** a live, bounded EVM authorization window. A stolen classical key alone cannot open one.

---

## Architecture

```
┌──────────────────────────── browser ────────────────────────────┐
│ Next.js app                                                     │
│  • EIP-1193 wallet (QoreX / MetaMask)                           │
│  • TanStack Query reads via public RPC                          │
│  • ML-DSA-87 key lives in memory for one signing operation      │
│  • uint256 accrual math mirrors the contract                    │
└───────────────┬──────────────────────────────┬──────────────────┘
                │ eth_call / eth_sendTransaction│ REST
                ▼                               ▼
┌──────────────────── QoreChain Diana (9800) ─────────────────────┐
│  QoreFlow ── cancelStream(...)                                  │
│      │            │                                             │
│      │            └── QorePQCVerifier                           │
│      │                    ├── pqcKeyStatus  (0x…0a02)           │
│      │                    └── pqcVerify     (0x…0a01)           │
│      │                                                          │
│      └── Stream storage, accrual, withdraw, ReentrancyGuard     │
│                                                                 │
│  Cosmos lane: registered PQC key + EVM authorization window     │
└─────────────────────────────────────────────────────────────────┘
```

More detail: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Quickstart

Requires **Node 22** and npm 10+.

```bash
npm install
npm run compile          # solc 0.8.24
npm run test:unit        # 47 tests
npm run test:invariants  # 2 tests
npm run typecheck
npm run lint
npm run build
```

Run the app:

```bash
cp .env.example .env.local
# leave NEXT_PUBLIC_CONTRACT_ADDRESS empty until you deploy
npm run dev
```

The landing page works with no configuration. The dashboard explains what to set when the contract address is missing.

---

## Deploying to QoreChain Diana

**Current deployment (20 Nov 2026, via Remix IDE):**

| Contract | Address | Deploy tx |
| --- | --- | --- |
| `QorePQCVerifier` | `0x1694b895a12Ab327512D01A91E3C9dfe506E61f4` | `0xecedb61753573e04c84729127fb7975dc63f2bd90d60d01acfe4a82210a22c56` |
| `QoreFlow` | `0x5963C1Fb94e71BBDaF74AD6d2E9a2573c5d93140` | `0x831e02bae7ef2c5b0dd144604532fc259606c9379d4a5dabd64234e28e3b401b` |

`QoreFlow` was deployed at block `10423689`; `isCanonicalWiring()` on the
verifier returns `true`. `.env.local` in this workspace already points at this
deployment (it is git-ignored; copy the two values from the table above). The
deployment account's key reports `registered=true`, `algorithmId=1`,
`possessionProven=true`.

Read [`docs/QORECHAIN_INTEGRATION.md`](docs/QORECHAIN_INTEGRATION.md) first. To deploy a fresh instance:

1. Use a **throwaway** coin-type-60 EVM account. Fund it at <https://dashboard.qorechain.io/faucet>.
2. Register an ML-DSA-87 key **with proof of possession** (`--pqc-key`).
3. Open an **unscoped** EVM window (contract creation is refused by a target-scoped window).
4. Open the window **before** reading the nonce — opening it advances the account sequence, which is the EVM nonce.
5. Deploy:

```bash
# .env (never commit)
DEPLOYER_PRIVATE_KEY=0x…
QORECHAIN_RPC_URL=https://evm-testnet.qore.host

npm run deploy:testnet
```

The script refuses any chain other than 9800 unless `ALLOW_NON_TESTNET=true`, asserts the verifier is wired to `0x…0a01` / `0x…0a02`, and writes `deployments/9800.json`.

6. Copy the printed address into `.env.local`:

```bash
NEXT_PUBLIC_CONTRACT_ADDRESS=0x…
NEXT_PUBLIC_DEPLOY_BLOCK=<deployment block>
```

7. Verify (read-only):

```bash
QOREFLOW_ADDRESS=0x… npm run verify:deployment
```

8. Open a second window, scoped to the contract, for user transactions.

---

## Real testnet checks

Once the environment has a funded PQC-registered account and a deployed contract:

```bash
npm run test:testnet
```

This suite has **no mock fallback**. It:

- asserts chain id 9800;
- proves the live `pqcKeyStatus` precompile returns non-empty data;
- asserts the deployed verifier points at the canonical precompiles;
- builds the cancellation hash **from the contract itself**, signs it with a real ML-DSA-87 key, and asks the real `pqcVerify` precompile to validate it;
- checks that a tampered message and a foreign key are rejected.

It is read-only and never broadcasts a transaction.

---

## Repository layout

```
contracts/
  QoreFlow.sol                 streaming + accrual + PQC cancellation
  security/
    IQorePQC.sol               exact precompile interfaces
    QorePQCVerifier.sol        key binding, PoP, length and empty-return guards
  test/                        clearly-labelled test doubles (never deployed)
test/
  QoreFlow.test.ts             creation, accrual, withdrawal, reentrancy
  PQCAuthorization.test.ts     positive/negative PQC authorization suite
  invariants/Accounting.test.ts
  testnet/PQC.testnet.ts       real chain, real precompiles, read-only
app/                           Next.js App Router pages
components/                    UI, wallet, streams, security
lib/                           config, ABI, accrual math, PQC signing/status
scripts/                       guarded deploy + read-only verification
docs/                          integration record, security, audit, evidence
```

---

## Security model (summary)

1. `pqcKeyStatus(sender)` must return `registered == true`, `algorithmId == 1`, and `possessionProven == true`.
2. The supplied public key must be byte-identical to the registered key (`keccak256` comparison). A signature from an arbitrary attacker key is rejected before `pqcVerify` is called.
3. `pqcVerify` must return non-empty data and `true`. An inactive precompile returns `0x` and is rejected loudly.
4. The signed message is the contract's own `cancelAuthorizationHash`, which binds:
   - domain: `QoreFlow` / `1` / chain id / contract address
   - action: `keccak256("QOREFLOW_CANCEL_STREAM_V1")`
   - sender, stream id, sender nonce, deadline
5. The nonce is raised **before** the refund, so a signature cannot be replayed.
6. Withdrawal is recipient-only, uses checks-effects-interactions and `ReentrancyGuard`.
7. Accrual freezes at `cancelledAt`; the recipient keeps every vested wei.

Full threat model: [`docs/SECURITY.md`](docs/SECURITY.md).

---

## Verified results

Last run on 20 November 2026, Node 22.18.0:

```
npm run test:unit        → 47 passing
npm run test:invariants  →  2 passing
npm run typecheck        →  clean
npm run lint             →  clean
npm run build            →  clean (Next.js 15.5.29)
```

Deployment reads on 21 November 2026 (chain 9800, no transaction broadcast):

```
QoreFlow bytecode        → 8943 bytes at 0x5963…3140
QoreFlow.pqcVerifier()   → 0x1694…61f4
verifier.isCanonicalWiring() → true
pqcKeyStatus(deployer)   → registered=true, algorithmId=1, possessionProven=true
deployment window        → found=true, live=false, used_txs=1 (consumed)
```

---

## Limitations (read these)

- **Testnet only.** Both PQC precompiles are active on Diana and inactive on mainnet. QoreFlow is not deployed to mainnet.
- **EVM transactions remain classically signed.** The PQ signature is an additional authorization, not a replacement for the transaction signature.
- **Proof of possession is required by QoreFlow.** Accounts registered without it cannot cancel. Re-register with `--pqc-key`.
- **No classical fallback.** If the key or window cannot be verified, cancellation stays disabled.
- **The UI cannot audit itself.** Browser code can be tampered with; the contract checks the signature on chain regardless of what the page renders.
- **QCAI reports are human-run.** They are not fabricated here; see [`docs/AUDIT.md`](docs/AUDIT.md).
- **Explorer source verification is unavailable** on `explore.qore.network` at the time of writing. Compiler settings are pinned in `hardhat.config.ts`.

---

## Documentation

| Document | Purpose |
| --- | --- |
| [`docs/QORECHAIN_INTEGRATION.md`](docs/QORECHAIN_INTEGRATION.md) | Verified network facts, precompile ABI, key binding, windows, audit process |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Components, data flow, state machines |
| [`docs/SECURITY.md`](docs/SECURITY.md) | Threat model, guarantees, non-goals |
| [`docs/AUDIT.md`](docs/AUDIT.md) | QCAI Stage 1/2 mapping template (BLOCKED until run) |
| [`docs/TESTNET_EVIDENCE.md`](docs/TESTNET_EVIDENCE.md) | Exact commands and placeholders for real evidence |
| [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md) | 3-minute demo script |
| [`AI_USAGE.md`](AI_USAGE.md) | AI assistance disclosure |
| [`SUBMISSION_CHECKLIST.md`](SUBMISSION_CHECKLIST.md) | What remains before submission |
| [`IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md) | Detailed build status |

---

## License

MIT. See [`LICENSE`](LICENSE).
