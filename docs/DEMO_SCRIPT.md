# Demo Script (3 minutes)

## Pre-demo checklist

- [ ] App running: `npm run build && npm start` (or hosted URL).
- [ ] Wallet on QoreChain Diana (chain 9800), funded with test QOR.
- [ ] Account has a registered ML-DSA-87 key **with proof of possession**.
- [ ] EVM window open and scoped to QoreFlow (`--allowed-targets 0x<QoreFlow>`).
- [ ] One active incoming stream and one active outgoing stream.
- [ ] ML-DSA-87 secret key available to paste (do not show it on camera).
- [ ] Explorer tab open at the contract address.
- [ ] `npm run test:testnet` output captured as a fallback screenshot.

If any of the above is missing, do **not** improvise a claim. Say "this part is still blocked on testnet funding" and show the code/tests instead.

## 0:00–0:20 — The problem

**Show:** landing page hero.

**Say:** "Payments are batched: invoices, payroll, retainers. QoreFlow turns them into a continuous flow — one deposit, linear vesting, withdrawal any second. And the one destructive action, cancellation, requires a post-quantum signature."

Point at the honest disclaimer: EVM transactions remain classically signed; PQ is an additional authorization layer.

## 0:20–0:50 — Streams are real

**Show:** `/dashboard`.

**Say:** "This is read live from QoreChain Diana. Incoming streams on the left, outgoing on the right. The vested number ticks every second locally; the chain is re-read every 15 seconds."

Point at the four stat cards and the activity feed. Click **Details** on the incoming stream.

## 0:50–1:20 — Withdrawal is recipient-only

**Show:** stream detail.

**Say:** "Accrual is `floor(deposit × elapsed ÷ duration)` — no keeper, no per-second transaction. The recipient withdraws what has vested. The sender cannot withdraw a single wei."

Click **Withdraw**. Confirm in wallet. Show the toast and the updated **Withdrawn** tile.

## 1:20–2:10 — The post-quantum cancellation

**Show:** same stream, scroll to **Cancel with a post-quantum authorization**.

**Say:** "Cancellation is different. It stops accrual and returns the unvested balance, so it needs an ML-DSA-87 signature. The contract reads the key registered to this account from `pqcKeyStatus`, requires proof of possession, requires the supplied key to match byte-for-byte, and then calls `pqcVerify`."

Point at the checklist: key registered, PoP proven, window admits the call, authorization signed.

Paste the secret key, click **Sign authorization**. Point at the local verification panel: nonce, deadline, key fingerprint, message hash.

**Say:** "The secret key is cleared from memory immediately after signing. The hash is built by the contract itself, so there is no encoding drift. It binds chain, contract, sender, stream, action, nonce and deadline."

Click **Submit cancellation**. Confirm. Show the toast: accrual froze, recipient keeps vested funds.

## 2:10–2:40 — The security page

**Show:** `/security`.

**Say:** "Three signals, three trust levels. Verified on chain: the ML-DSA-87 key and its proof of possession. Wallet-reported: address and chain. Unknown: anything the REST endpoint did not answer. A connected wallet is never labelled quantum secure."

Point at the raw window payload and the "What this page does not claim" card.

## 2:40–3:00 — Evidence and close

**Show:** terminal or a slide with test output.

**Say:** "49 local tests pass, including an accounting invariant and the full negative PQC suite. The real-precompile suite runs against chain 9800 and has no mock fallback. The QCAI audit and mainnet deployment are explicitly out of scope and marked blocked — no fabricated reports."

Close on the landing page.

## Fallback lines

- If the window is exhausted: "The chain refused the transaction because the EVM window is exhausted — that is the second security layer working. Here is the exact refusal and the command to open a new window."
- If the wallet is not PQC-registered: "Cancellation is correctly disabled. Registration without proof of possession is not enough; here is the `--pqc-key` flow."
- If the network is down: play the captured `test:testnet` output and the local test suite; state clearly that the live demo could not run.
