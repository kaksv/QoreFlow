/**
 * Maps QoreFlow / QorePQCVerifier custom errors to copy a human can act on.
 *
 * ethers v6 surfaces custom errors in different shapes depending on whether the
 * provider decoded the revert data (`error.revert`, `error.shortMessage`) or
 * only returned the raw `execution reverted` payload. We look for both, and
 * never invent a cause: an unrecognised error keeps the original message.
 */
const DESCRIPTIONS: Record<string, string> = {
  ZeroRecipient: "The recipient address is empty.",
  ZeroDeposit: "The deposit must be greater than zero.",
  ZeroDuration: "The stream duration must be greater than zero.",
  DurationTooLong: "That duration is longer than the 10-year maximum.",
  StreamNotFound: "No stream exists with that id.",
  NotStreamRecipient: "Only the recipient can withdraw from this stream.",
  NotStreamSender: "Only the stream sender can cancel it.",
  StreamIsCancelled: "This stream has already been cancelled.",
  StreamCompleted: "This stream has already finished. Nothing can be cancelled.",
  NothingToWithdraw: "Nothing has vested since the last withdrawal.",
  AuthorizationExpired:
    "The authorization deadline passed. Prepare a fresh ML-DSA-87 authorization.",
  KeyNotRegistered:
    "This account has no registered post-quantum key. Register an ML-DSA-87 key with proof of possession first.",
  KeyPossessionNotProven:
    "The registered key has no proof of possession. Re-register it with --pqc-key.",
  UnsupportedAlgorithm:
    "The registered key is not ML-DSA-87 (algorithm id 1).",
  RegisteredKeyMalformed:
    "The registered public key has an unexpected length. Re-register the key.",
  SuppliedKeyMalformed:
    "The supplied public key is not a 2592-byte ML-DSA-87 key.",
  SignatureMalformed:
    "The supplied signature is not a 4627-byte ML-DSA-87 signature.",
  SuppliedKeyDoesNotMatchRegistration:
    "The supplied public key is not the key registered to this account.",
  InvalidPostQuantumSignature:
    "The post-quantum signature did not verify for this authorization.",
  PrecompileCallFailed:
    "A QoreChain PQC precompile call failed. Check the network and try again.",
  PrecompileReturnedNoData:
    "The PQC precompile returned no data. It may be inactive on this network.",
  ReentrantCallBlocked: "The transfer was rejected by the receiving account.",
};

export function describeTxError(error: unknown): string {
  if (!error || typeof error !== "object") {
    return typeof error === "string" ? error : "Unknown error";
  }

  const candidate = error as {
    shortMessage?: string;
    reason?: string;
    message?: string;
    revert?: { name?: string };
    info?: { error?: { message?: string } };
  };

  const named = candidate.revert?.name;
  if (named && DESCRIPTIONS[named]) return DESCRIPTIONS[named];

  const text =
    candidate.shortMessage ??
    candidate.reason ??
    candidate.info?.error?.message ??
    candidate.message ??
    "";

  for (const [name, description] of Object.entries(DESCRIPTIONS)) {
    if (new RegExp(`\\b${name}\\b`).test(text)) return description;
  }

  const rejected = (error as { code?: string | number }).code;
  if (rejected === 4001 || rejected === "ACTION_REJECTED") {
    return "The transaction was rejected in your wallet.";
  }

  return text || "The transaction failed. Check the browser console for details.";
}
