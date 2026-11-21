# QoreChain Integration

Everything in this document was checked against the official documentation on
20 November 2026. Where something could not be verified, it is marked
**UNVERIFIED** and isolated in code. Do not treat this file as a substitute for
reading the upstream pages before changing integration code.

## Sources

| Topic | URL |
| --- | --- |
| Developer Fest landing | https://build.qorechain.io/ |
| Prizes (category requirements incl. "two-stage QCAI audit") | https://build.qorechain.io/prizes |
| Rules, timeline, licence, originality | https://build.qorechain.io/rules |
| Kits and package versions | https://build.qorechain.io/kits |
| Docs root | https://docs.qorechain.io/ |
| EVM development + EVM window | https://docs.qorechain.io/developer-guide/evm-development/ |
| EVM window reference | https://docs.qorechain.io/developer-guide/evm-window-reference/ |
| EVM precompiles (ABI, addresses, gas) | https://docs.qorechain.io/developer-guide/evm-precompiles |
| Post-quantum signing (keys, hybrid, PoP) | https://docs.qorechain.io/developer-guide/post-quantum-signing |
| Workshop 2 (vault pattern, two-stage audit) | https://docs.qorechain.io/build-before-qday/workshop-2/ |
| Contract Auditor (the QCAI audit tool) | https://docs.qorechain.io/dashboard/contract-auditor/ |
| Builder FAQ (audit settings, Stage 2) | https://build.qorechain.io/faq |
| Getting started / deploy in 5 minutes | https://docs.qorechain.io/getting-started/deploy-in-5-minutes/ |

## Verified network settings

| Setting | Value |
| --- | --- |
| Network | QoreChain Diana **testnet** |
| Cosmos chain ID | `qorechain-diana` |
| EVM chain ID | **9800** |
| EVM JSON-RPC | `https://evm-testnet.qore.host` |
| Cosmos REST | `https://api-testnet.qore.host` |
| Native denom | `uqor` (6 decimals); EVM reports 18-decimal wei via `x/precisebank` |
| Faucet | https://dashboard.qorechain.io/faucet |
| Explorer | https://explore.qore.network |
| Contract Auditor | https://dashboard.qorechain.io/audit |

Mainnet (`qorechain-vladi`, EVM 9801) is deliberately **not** configured.
The deploy script refuses any chain other than 9800 unless
`ALLOW_NON_TESTNET=true` is set explicitly.

### Gas and limits

- Per-EVM-transaction gas limit cap: **30,000,000** (node v3.2.8).
- `pqcVerify`: **25,000 + 8 gas/byte** of input; a typical ML-DSA-87 call is
  roughly 85,000–90,000 gas.
- `pqcKeyStatus`: **2,500 gas** flat.
- Inactive precompile behaviour: the call **succeeds and returns `0x`**. This is
  why `QorePQCVerifier` checks `ret.length` before decoding and reverts with
  `PrecompileReturnedNoData` otherwise.

### Precompile status

| Precompile | Address | Testnet | Mainnet |
| --- | --- | --- | --- |
| PQC Verify | `0x0000000000000000000000000000000000000a01` | Active (gov. proposal 21, 27 Oct 2026) | Not active |
| PQC Key Status | `0x0000000000000000000000000000000000000a02` | Active | Not active |
| CrossVM Bridge | `0x…0901` | Active with allowlist | Not active |
| AI Risk / Anomaly | `0x…0b01` / `0x…0b02` | Not active | Not active |
| PRISM params | `0x…0c01` | Active | Not active |

Check the live list yourself:

```bash
curl -s https://api-testnet.qore.host/cosmos/evm/vm/v1/params \
  | jq .params.active_static_precompiles
```

## Precompile ABI (exact)

```solidity
interface IQorePQCVerify {
    function pqcVerify(
        bytes calldata pubkey,     // 2592-byte ML-DSA-87 public key
        bytes calldata signature,  // 4627-byte ML-DSA-87 signature
        bytes calldata message     // original message bytes
    ) external view returns (bool valid);
}

interface IQorePQCKeyStatus {
    function pqcKeyStatus(address account)
        external view
        returns (
            bool registered,
            uint8 algorithmId,   // 1 = ML-DSA-87
            bytes pubkey,        // registered key, empty if none
            bool possessionProven
        );
}
```

These are transcribed from the official precompile page. The exact functions,
argument order, sizes and return values are implemented in
`contracts/security/IQorePQC.sol`.

### Encoding notes

- `pqcVerify` takes the **original message bytes**, not a pre-hashed digest.
  QoreFlow passes the 32-byte authorization hash as the message and signs those
  same 32 bytes off-chain. Both sides use the identical 32 bytes, so there is no
  hashing ambiguity.
- ML-DSA-87 sizes are fixed by FIPS-204 and cannot be shortened. The contract
  rejects any other length with `SuppliedKeyMalformed` / `SignatureMalformed`.
- `pqcKeyStatus` returns four values since node v3.2.4. Older interface
  declarations with three values will misdecode.

## Account → key binding (the critical part)

`pqcVerify` proves only that *some* key signed *some* message. It does **not**
prove the key belongs to the account, and it does **not** enforce nonces,
deadlines or actions. QoreFlow therefore implements all of that explicitly:

1. Read `pqcKeyStatus(sender)`.
2. Require `registered == true`.
3. Require `algorithmId == 1` (ML-DSA-87).
4. Require `possessionProven == true`. Proof of possession is **optional** at
   registration, so `registered` alone is not enough — an attacker could
   register a key they do not control.
5. Require the supplied pubkey to be byte-identical to the registered pubkey
   (`keccak256` comparison). This is what stops an arbitrary attacker key from
   being accepted.
6. Call `pqcVerify` and require a non-empty, `true` return.
7. Only then apply the stream's nonce/deadline/action checks (in `QoreFlow`).

The nonce is per-sender (`cancelNonce`), raised **before** the refund. The
authorization hash binds:

- domain: `QoreFlow` / version `1` / `block.chainid` / `address(this)`
- action tag: `keccak256("QOREFLOW_CANCEL_STREAM_V1")`
- sender address
- stream id
- sender nonce
- deadline

Replay across chains, contracts, streams, actions or repeated calls fails.

## Registering the ML-DSA-87 key

The chain requires a **coin-type-60 `eth_secp256k1`** account. A default
coin-118 Cosmos account cannot sign for its EVM address. In QoreX: *Your
accounts → Add an Ethereum account (coin 60)*.

```bash
# 1. Generate the post-quantum key. The public key hex is printed.
qorechaind tx pqc gen-key mypqc

# 2. Register it once. Registration is exempt from the hybrid requirement,
#    so a brand-new account can bootstrap. --pqc-key attaches the optional
#    proof of possession, which QoreFlow requires to be present.
qorechaind tx pqc register-key-v2 dilithium5 <printed-pubkey-hex> hybrid \
  --pqc-key mypqc \
  --from mykey \
  --chain-id qorechain-diana \
  --gas 600000 --fees 60000uqor -y

# 3. Verify (expect registered=true, possession_proven=true).
# The REST API requires the bech32 form (qor1…). A 0x address returns
# HTTP 400 "invalid bech32 address" — verified on Diana, 21 Nov 2026.
curl -s https://api-testnet.qore.host/qorechain/pqc/v1/account/<qor1-address> | jq
```

`qorechaind` is the release binary; a locally built binary cannot sign. The
CLI is not vendored in this repository.

## Opening the EVM authorization window

An EVM transaction is admitted only if the sender has (1) a registered PQC key
and (2) a live EVM window. The window is opened by a **Cosmos-lane** message
signed with both keys.

| Bound | Meaning |
| --- | --- |
| `blocks` | Window lifetime, 1–17,280 blocks (testnet ≈ 1.3 s/block) |
| `max-txs` | 1–1,000 EVM transactions |
| `max-value` | Total outflow in `uqor`: value **plus** the maximum fee each tx could pay |

Scope options (`--native-only`, `--allowed-targets`) narrow **which** targets are
admitted; `allowed_targets` is not a token amount cap, and a window's value
budget is **not** an ERC-20 spending limit.

### Deployment window (unscoped)

Contract creation is refused by a target-scoped window, so deployment needs an
**unscoped** window:

```bash
qorechaind tx pqc open-evm-window 1200 5 20qor \
  --from mykey --chain-id qorechain-diana \
  --gas 400000 --fees 40000uqor --generate-only > deploy-window.json

qorechaind tx pqc cosign deploy-window.json \
  --from mykey --pqc-key mypqc --chain-id qorechain-diana
```

Then wait ~10 seconds, read the nonce **after** the window is open, and deploy.
Opening the window advances the account sequence, which is the EVM nonce.

### Interaction window (scoped to QoreFlow)

After deployment, open a second window restricted to the contract:

```bash
qorechaind tx pqc open-evm-window 1200 20 10qor \
  --allowed-targets 0x<QoreFlowAddress> \
  --from mykey --chain-id qorechain-diana \
  --gas 400000 --fees 40000uqor --generate-only > app-window.json

qorechaind tx pqc cosign app-window.json \
  --from mykey --pqc-key mypqc --chain-id qorechain-diana
```

Inspect and close:

```bash
# bech32 required: qor1…, not 0x… (verified 21 Nov 2026)
curl -s https://api-testnet.qore.host/qorechain/pqc/v1/evm_window/<qor1-address> | jq
qorechaind tx pqc close-evm-window --from mykey --chain-id qorechain-diana \
  --gas 400000 --fees 40000uqor --generate-only > close.json
qorechaind tx pqc cosign close.json --from mykey --pqc-key mypqc \
  --chain-id qorechain-diana
```

### Verified window payload (Diana, 21 Nov 2026)

A consumed deployment window returned exactly this shape:

```json
{
  "found": true,
  "live": false,
  "opened_height": "10423687",
  "expiry_height": "10423787",
  "max_txs": "1",
  "used_txs": "1",
  "max_value": "483828",
  "used_value": "483828",
  "remaining_blocks": "0",
  "remaining_txs": "0",
  "remaining_value": "0",
  "native_only": false,
  "allowed_targets": [],
  "validators": [],
  "staking_validators": [],
  "ibc_receivers": []
}
```

`found` stays `true` after a window is consumed, so the frontend must also check
`live`, `remaining_txs`, `remaining_value` and `remaining_blocks`. Amounts are
decimal strings in `uqor`; `remaining_value` is the budget left for **value plus
the maximum fee**, so `0` blocks any further transaction.

The browser cannot call this endpoint directly (CORS) and cannot pass a 0x
address anyway, so `app/api/evm-window/route.ts` proxies it and converts the EVM
address to bech32 with the `qor` prefix.

Useful refusal codes: `26` no window / no key, `27` window expired, exhausted or
out of scope, `28` invalid bounds.

## QCAI audit (two stages)

"QCAI audit" is **not** an API. It is the dashboard **Contract Auditor**
(`https://dashboard.qorechain.io/audit`), powered by QCAIA. It is:

- manual and sign-in gated;
- one free audit per UTC day, extra testnet audits paid in test QOR;
- source-only (no compile, test or runtime analysis);
- reportable as PDF.

Required process for the Post-Quantum dApp category:

1. Select an **EVM/Solidity** audit setting (not "QoreChain (CosmWasm + PQC)",
   which reports a mismatch on Solidity).
2. Ignore the "Not scored" quantum-readiness rating on EVM — it is expected.
3. Run **Stage 1**, export the PDF to `docs/audits/`, keep it unchanged.
4. Work through every finding: fix + regression test, or document why it is a
   false positive. Map each one in `docs/AUDIT.md`.
5. Run **Stage 2** with the **same setting**, export the PDF.
6. Link both reports and `docs/AUDIT.md` from the README.

This repository cannot run the audit: it requires the owner's dashboard session.
`docs/AUDIT.md` is prepared as the mapping template, and `docs/audits/` holds the
reports once the human runs them. An internal AI review must never be presented
as a QCAI report.

## Explorer and source verification

`explore.qore.network` currently has **no source verification** and no
Etherscan-compatible API. Keep the exact compiler settings in this repo
(`hardhat.config.ts`: solc 0.8.24, optimizer 200 runs, evmVersion `cancun`) and
link the deployment address in the README. **UNVERIFIED:** any claim that
`hardhat-verify` works against this explorer.

## What the frontend can and cannot show

| Signal | Source | Trust |
| --- | --- | --- |
| Wallet connected / chain id | EIP-1193 provider | Wallet-reported |
| QOR balance | `eth_getBalance` | On-chain |
| PQC key registered / proven | `pqcKeyStatus` via RPC | On-chain |
| EVM window bounds | `GET /qorechain/pqc/v1/evm_window/{qor1…}` | On-chain (REST, bech32 only) |
| Stream state | `QoreFlow.getStreamView` | On-chain |
| Accrual between polls | local timer + integer math | Client estimate |

`lib/pqc` and the Security page must render three distinct states — verified,
wallet-reported, unknown/unavailable — and must never show "Quantum Secure"
merely because a wallet is connected.

### Browser signing of the cancellation authorization

The ML-DSA-87 secret key is **never** persisted. The UI derives or accepts it in
memory for the current session only, signs the 32-byte authorization hash, and
discards it. No localStorage, no cookies, no backend. See
`lib/pqc/signer.ts` and `docs/SECURITY.md`.

## Remaining limitations

1. **EVM transactions remain classically signed.** Only the cancellation
   authorization carries a post-quantum signature. This is the documented chain
   model, not a workaround.
2. **Proof of possession is required by QoreFlow.** Accounts registered without
   it cannot cancel; the UI must explain how to re-register with `--pqc-key`.
3. **Cancellation is disabled in the UI when PQC status cannot be verified.**
   There is deliberately no classical-only fallback.
4. **QCAI reports are human-run.** Not fabricated here.
5. **Testnet evidence requires a funded, PQC-registered account.** Until then,
   `docs/TESTNET_EVIDENCE.md` stays marked BLOCKED.
6. **Mainnet**: precompiles are inactive; QoreFlow is testnet-only.
