# Security Model

This document describes what QoreFlow protects, what it explicitly does not protect, and where the trust boundaries are. It is written to be read alongside `contracts/QoreFlow.sol`, `contracts/security/QorePQCVerifier.sol` and `docs/QORECHAIN_INTEGRATION.md`.

## 1. Scope

In scope:

- `QoreFlow` stream accounting and lifecycle.
- The account → post-quantum key binding in `QorePQCVerifier`.
- The cancellation authorization encoding and replay resistance.
- The browser-side handling of the ML-DSA-87 secret key.
- The honesty of the security UI: which signals are verified, which are wallet-reported, which are unknown.

Out of scope:

- QoreChain node, consensus, precompile implementation, or wallet software.
- The Cosmos-lane key registration and EVM-window transactions.
- Compromise of the user's operating system, browser, or wallet extension.
- Mainnet deployment (the PQC precompiles are inactive on mainnet).

## 2. Assets

| Asset | Where it lives | Who can move it |
| --- | --- | --- |
| Stream deposit | `QoreFlow` contract balance | Split between recipient (vested) and sender (unvested on cancel) |
| Vested balance | `Stream.withdrawn` accounting | Recipient only, via `withdraw` |
| Unvested balance | Implicit: `deposit − accrued` | Sender only, via a PQC-authorized `cancelStream` |
| ML-DSA-87 secret key | User's machine / this browser tab's memory | The user |
| Cancellation authority | A 32-byte authorization hash | The holder of the registered ML-DSA-87 secret key |

## 3. Actors

- **Sender** — creates and funds streams; the only account allowed to cancel.
- **Recipient** — accrues and withdraws; cannot cancel.
- **Attacker with a stolen classical key** — can sign EVM transactions, but cannot produce a valid ML-DSA-87 authorization or open an EVM window without the PQ key.
- **Malicious recipient contract** — may attempt reentrancy during `withdraw`.
- **Malicious frontend / MITM** — may alter what the UI shows, but cannot alter what the contract verifies.

## 4. Trust boundaries

```
User intent
   │  (browser, wallet)
   ▼
Wallet signs EVM tx (secp256k1)  ──►  QoreChain node admits only with
   │                                   registered PQC key + live window
   ▼
QoreFlow.cancelStream
   │  reads pqcKeyStatus (0x…0a02)
   │  compares supplied key to registered key
   │  calls pqcVerify (0x…0a01)
   ▼
State change + refund
```

The browser is **untrusted** for security decisions. It may compute accrual for display, but the contract recomputes every value that moves funds.

## 5. Guarantees

**G1 — Only the recipient can withdraw.**
`withdraw` reverts with `NotStreamRecipient` for every other caller. The amount is `accrued − withdrawn`, never more.

**G2 — Withdrawal cannot exceed accrual.**
`_accrued` is `floor(deposit × elapsed / duration)`, clamped to `[0, deposit]`. Effects are applied before the transfer and `nonReentrant` blocks re-entry.

**G3 — Only the stream sender can cancel, and only with a valid PQ authorization.**
`cancelStream` checks `msg.sender == stream.sender`, then calls `pqcVerifier.verifySignature(msg.sender, …)`. There is no classical-only branch.

**G4 — The verified key is the key registered to the account.**
`QorePQCVerifier` requires:
- `registered == true`
- `algorithmId == 1` (ML-DSA-87)
- `possessionProven == true`
- `keccak256(suppliedPubkey) == keccak256(registeredPubkey)`
- `pqcVerify` returns non-empty data equal to `true`

A signature from any other key fails even if the signature itself is valid.

**G5 — Authorizations are single-use and context-bound.**
The signed hash binds the EIP-712-style domain (name, version, `block.chainid`, `address(this)`), the action tag, the sender, the stream id, the sender's current nonce and the deadline. The nonce increments before the refund. Replays across chains, contracts, streams, actions or repeated calls fail.

**G6 — Cancellation cannot steal vested funds.**
`recipientEntitlement = _accrued(stream)` at the cancellation timestamp; `refund = deposit − recipientEntitlement`. Accrual is frozen at `cancelledAt`, and the recipient can still withdraw the entitlement.

**G7 — A cancelled or completed stream cannot be cancelled again.**
`StreamIsCancelled` / `StreamCompleted` are checked before verification and before any state change.

**G8 — Inactive precompiles fail closed.**
An inactive precompile returns success with empty data. `QorePQCVerifier` checks `ret.length` and reverts with `PrecompileReturnedNoData`. A zero-address precompile is rejected at construction.

## 6. Threats and mitigations

| # | Threat | Mitigation | Residual risk |
| --- | --- | --- | --- |
| T1 | Sender's classical key is stolen; attacker cancels streams | Cancellation needs the registered ML-DSA-87 key **and** a live EVM window opened with both keys | If the PQ key is also stolen, the attacker can cancel |
| T2 | Attacker registers their own key to the victim's account | Registration requires control of the account; QoreFlow additionally requires `possessionProven` | A compromised account can re-register; out of scope |
| T3 | Signature from an arbitrary attacker key is accepted by `pqcVerify` | `SuppliedKeyDoesNotMatchRegistration` compares against the registered key first | None known |
| T4 | Replay a cancellation signature on another stream/chain/contract | Domain + action + stream id + nonce + deadline in the hash; nonce increments before refund | None known |
| T5 | Reentrancy during `withdraw` or refund | Checks-effects-interactions + `ReentrancyGuard` | None known |
| T6 | `pqcVerify` returns malformed/empty data | Explicit length checks; reverts loudly | None known |
| T7 | Recipient is a contract that rejects QOR | Transfer reverts with `ReentrantCallBlocked`; state rolls back | Recipient must be able to receive QOR |
| T8 | Frontend lies about "quantum secure" | UI separates verified / wallet-reported / unknown; only on-chain precompile data is green | A tampered frontend can still lie visually — the contract does not |
| T9 | Secret key leaks via storage/logs/network | Key kept in memory for one signing operation, cleared after signing, never persisted or sent | Browser memory is not a secure enclave |
| T10 | User signs an authorization for the wrong chain/contract | Hash comes from the contract itself; the UI displays chain, contract and message hash before submission | User must read the confirmation |
| T11 | EVM window exhaustion | UI checks `live`, `remaining_txs`, `remaining_value` and `remaining_blocks`; chain refuses with code 27 | Fields outside the verified payload stay unknown |
| T12 | Mainnet deployment with inactive precompiles | Deploy script refuses non-9800 chains unless explicitly overridden; docs state testnet-only | A human can override with `ALLOW_NON_TESTNET` |

## 7. Secret-key handling

- The secret key is **never** written to `localStorage`, `sessionStorage`, cookies, IndexedDB, logs, analytics, or any backend.
- In the cancellation panel it is held in React state, used to sign exactly one 32-byte authorization hash, then cleared with `setSecretKeyHex("")` before the transaction is submitted.
- The signature is checked locally against the **registered on-chain public key** before submission. If the secret key does not correspond to that key, the UI refuses to send anything.
- There is no recovery-phrase prompt in the app. If a user wants to derive the ecosystem-standard key offline, the derivation helper exists in `lib/pqc/signer.ts`, but the recommended flow is to import the raw secret key for the session.
- The secret key is not a substitute for wallet security. Anyone with it can authorize cancellation for that account.

## 8. Non-goals

- **Not post-quantum-secure EVM transactions.** Transaction signatures are secp256k1. QoreFlow adds a PQ authorization; it does not change the transaction envelope.
- **Not mainnet-ready.** No independent human audit has been completed. The QCAI reports are pending.
- **Not a custody solution.** The contract holds stream deposits; it is not a bank, vault, or yield product.
- **Not private.** Stream amounts, parties and timestamps are public on chain.
- **Not a key manager.** The app does not generate, back up, or rotate ML-DSA-87 keys.

## 9. Verification checklist

Before trusting a deployment:

1. `scripts/verify-deployment.ts` reports `canonical wiring : true`.
2. `pqcKeyStatus` returns non-empty data for the sender.
3. `registered`, `algorithmId == 1`, `possessionProven` are all true.
4. `npm run test:testnet` passes against the same contract address.
5. The EVM window is scoped to the contract for user transactions.
6. The frontend's `NEXT_PUBLIC_CONTRACT_ADDRESS` and `NEXT_PUBLIC_DEPLOY_BLOCK` match the deployment.

## 10. Reporting

This is a hackathon testnet project. Do not use it with funds you cannot afford to lose. If you find a vulnerability, open an issue in the repository rather than exploiting it on testnet.
