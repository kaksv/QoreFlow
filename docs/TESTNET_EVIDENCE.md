# Testnet Evidence

> **STATUS: PARTIALLY COMPLETE.**
>
> The contracts are deployed to QoreChain Diana and the addresses, transactions
> and canonical wiring below were verified by reading chain 9800 on 21 November
> 2026. Stream transactions (`createStream`, `withdraw`, `cancelStream`) and the
> `npm run test:testnet` output are **still pending** — the deployment window was
> consumed, so a new interaction window must be opened first. Nothing in the
> pending rows is invented.

## 1. Prerequisites

- [x] Throwaway EVM account created — deployer `0x2CACF0B81D218fd598A5Ef72A442Fc944ddFe02B`.
- [x] Funded from <https://dashboard.qorechain.io/faucet> — balance read as **98.4399859125 QOR** on 21 Nov 2026.
- [x] ML-DSA-87 key present for the deployer (`algorithmId == 1`, 2592-byte public key).
- [x] Key registered **with proof of possession** — `pqcKeyStatus` returned `registered=true`, `algorithmId=1`, `possessionProven=true`.
- [x] Unscoped EVM window opened for deployment — payload showed `native_only=false`, `allowed_targets=[]`, `max_txs=1`, `used_txs=1`.
- [ ] Nonce read **after** the window opened — not independently observable from chain data; recorded here as unverified.
- [ ] `DEPLOYER_PRIVATE_KEY` in `.env` — **not used**: this deployment was made from **Remix IDE**, not `scripts/deploy.ts`.

The deployment account's Cosmos-lane representation is
`qor19jk0pwqayx8atx99aae2gshuj3xalcptlk6efn`.

## 2. Deployment method

Remix IDE, compiler `0.8.24`, optimizer enabled (200 runs), EVM version
`cancun`. `QorePQCVerifier` was deployed first with the canonical precompile
addresses, then `QoreFlow` with the verifier address.

The equivalent CLI path remains:

```bash
npm run compile
npm run test:unit
npm run test:invariants
npm run deploy:testnet          # refused on any chain other than 9800
QOREFLOW_ADDRESS=0x… npm run verify:deployment
npm run test:testnet            # requires TESTNET_* env
```

## 3. Deployment record

| Field | Value |
| --- | --- |
| Network | `qorechain-diana` (EVM chain 9800) |
| Deployer address | `0x2CACF0B81D218fd598A5Ef72A442Fc944ddFe02B` |
| `QorePQCVerifier` address | `0x1694b895a12Ab327512D01A91E3C9dfe506E61f4` |
| `QorePQCVerifier` tx | [`0xecedb61753573e04c84729127fb7975dc63f2bd90d60d01acfe4a82210a22c56`](https://explore.qore.network/tx/0xecedb61753573e04c84729127fb7975dc63f2bd90d60d01acfe4a82210a22c56) |
| `QorePQCVerifier` block | `10423612` |
| `QoreFlow` address | `0x5963C1Fb94e71BBDaF74AD6d2E9a2573c5d93140` |
| `QoreFlow` tx | [`0x831e02bae7ef2c5b0dd144604532fc259606c9379d4a5dabd64234e28e3b401b`](https://explore.qore.network/tx/0x831e02bae7ef2c5b0dd144604532fc259606c9379d4a5dabd64234e28e3b401b) |
| Deployment block | `10423689` (2026-11-20T08:50:39Z) |
| `NEXT_PUBLIC_CONTRACT_ADDRESS` | `0x5963C1Fb94e71BBDaF74AD6d2E9a2573c5d93140` |
| Canonical wiring check | `true` (`pqcVerify=0x…0a01`, `pqcKeyStatus=0x…0a02`) |

Machine-readable copy: `deployments/9800.json` (git-ignored).

## 4. Transaction evidence

Every row must link to `https://explore.qore.network/tx/<hash>`. Rows 1–2 are
mined and verified. Rows 3–6 are **pending** until an interaction window is open
and the demo transactions are sent.

| # | Action | Tx hash | Block | Result |
| --- | --- | --- | --- | --- |
| 1 | Deploy `QorePQCVerifier` | `0xecedb61753573e04c84729127fb7975dc63f2bd90d60d01acfe4a82210a22c56` | `10423612` | status `1` |
| 2 | Deploy `QoreFlow` | `0x831e02bae7ef2c5b0dd144604532fc259606c9379d4a5dabd64234e28e3b401b` | `10423689` | status `1` |
| 3 | `createStream` | `_PENDING_` | `_PENDING_` | needs a scoped window |
| 4 | `withdraw` | `_PENDING_` | `_PENDING_` | needs a scoped window |
| 5 | `cancelStream` (valid ML-DSA-87 auth) | `_PENDING_` | `_PENDING_` | needs a scoped window |
| 6 | `cancelStream` (replayed auth, expected revert) | `_PENDING_` | `_PENDING_` | needs a scoped window |

## 5. Real-precompile output

`npm run test:testnet` has **not** been run against this deployment yet. Its
output belongs here unchanged once it runs:

```
_PENDING_
```

Read-only checks already performed on 21 Nov 2026, without broadcasting:

```
$ QOREFLOW_ADDRESS=0x5963C1Fb94e71BBDaF74AD6d2E9a2573c5d93140 npm run verify:deployment
chainId          : 9800
bytecode bytes   : 8943
pqcVerifier      : 0x1694b895a12Ab327512D01A91E3C9dfe506E61f4
pqcVerify        : 0x0000000000000000000000000000000000000a01
pqcKeyStatus     : 0x0000000000000000000000000000000000000a02
canonical wiring : true
stream count     : 0
Verification OK.

pqcKeyStatus(0x2CACF0B81D218fd598A5Ef72A442Fc944ddFe02B)
  registered        : true
  algorithmId       : 1
  publicKey bytes   : 2592
  possessionProven  : true
```

Expected assertions once `test:testnet` runs:

- chain id `9800`
- `pqcKeyStatus` returns non-empty data
- deployed verifier `isCanonicalWiring() == true`
- contract-built hash + real ML-DSA-87 signature → `pqcVerify == true`
- tampered message → `false`
- foreign key → `false`

## 6. EVM authorization window evidence

The deployment window is **consumed**: `found=true`, `live=false`,
`remaining_txs=0`. It admits no further transaction. A new window scoped to
QoreFlow is required for the stream demo.

| Field | Deployment window | Interaction window |
| --- | --- | --- |
| Window tx | `_NOT CAPTURED_` | `_PENDING_` |
| Opened height | `10423687` | `_PENDING_` |
| Expiry height | `10423787` | `_PENDING_` |
| Max txs | `1` | `_PENDING_` |
| Used txs | `1` | `_PENDING_` |
| Max value | `483828` uqor | `_PENDING_` |
| Used value | `483828` uqor | `_PENDING_` |
| Scope | unscoped (`allowed_targets=[]`, `native_only=false`) | must target QoreFlow |
| Remaining | `0` txs · `0` blocks · `0` uqor | `_PENDING_` |

Inspect with the **bech32** address (0x is rejected by the REST service):

```bash
curl -s https://api-testnet.qore.host/qorechain/pqc/v1/evm_window/qor19jk0pwqayx8atx99aae2gshuj3xalcptlk6efn | jq
```

## 7. Screenshots / recordings

- [ ] Dashboard: incoming/outgoing stream with live accrual.
- [ ] Stream detail: withdrawal confirmed, balance updated.
- [ ] Security page: ML-DSA-87 key with proof of possession, window scoped to QoreFlow.
- [ ] Cancel panel: locally verified authorization + successful cancellation.
- [ ] Explorer: `StreamCancelled` event with refund and recipient entitlement.

## 8. What "done" means

The file may be marked complete only when:

1. Rows 3–6 resolve on the explorer, and
2. `npm run verify:deployment` reports canonical wiring against this address, and
3. `npm run test:testnet` passes against the same address, and
4. the screenshots or recording are attached.

Until then this file stays **partially complete**.
