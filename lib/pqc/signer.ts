import { getBytes, hexlify, isHexString, keccak256, toUtf8Bytes } from "ethers";
import { mldsa, shake256 } from "@qorechain/pqc";

export interface PqcKeypair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

/**
 * Derives the ecosystem-standard ML-DSA-87 key from a recovery phrase.
 *
 *   seed = SHAKE-256("qorechain:pqc:v1|" + cosmosAddress + "|" + mnemonic)
 *
 * This is the documented QoreChain derivation and is byte-compatible with
 * qorechaind / the SDKs. The key lives in memory for this session only.
 */
export function deriveKeypairFromRecovery(
  mnemonic: string,
  cosmosAddress: string,
): PqcKeypair {
  const normalized = mnemonic.trim().replace(/\s+/g, " ").toLowerCase();
  const input = `qorechain:pqc:v1|${cosmosAddress.trim()}|${normalized}`;
  const seed = shake256(toUtf8Bytes(input), 32);
  return mldsa.keygen(seed);
}

export const ML_DSA_87_SECRET_KEY_LENGTH = 4896;

/** Imports a raw ML-DSA-87 secret key from hex, validating the encoding. */
export function importSecretKey(secretKeyHex: string): Uint8Array {
  const value = secretKeyHex.trim().replace(/\s+/g, "");
  if (!isHexString(value) || value.length <= 2) {
    throw new Error("Secret key must be a 0x-prefixed hex string.");
  }
  const bytes = getBytes(value);
  if (bytes.length !== ML_DSA_87_SECRET_KEY_LENGTH) {
    throw new Error(
      `Expected a ${ML_DSA_87_SECRET_KEY_LENGTH}-byte ML-DSA-87 secret key, got ${bytes.length} bytes.`,
    );
  }
  return bytes;
}

/** Signs a 32-byte authorization hash. Returns the 4627-byte signature. */
export function signAuthorization(
  secretKey: Uint8Array,
  messageHex: string,
): string {
  const message = getBytes(messageHex);
  const signature = mldsa.sign(secretKey, message);
  if (signature.length !== 4627) {
    throw new Error(`Unexpected signature length ${signature.length}`);
  }
  return hexlify(signature);
}

/** Local pre-flight check before sending anything to the chain. */
export function verifyAuthorizationLocally(
  publicKeyHex: string,
  messageHex: string,
  signatureHex: string,
): boolean {
  try {
    return mldsa.verify(
      getBytes(publicKeyHex),
      getBytes(messageHex),
      getBytes(signatureHex),
    );
  } catch {
    return false;
  }
}

export function publicKeyFingerprint(publicKeyHex: string): string {
  return keccak256(publicKeyHex).slice(0, 18);
}

export function isPlausiblePublicKey(publicKeyHex: string): boolean {
  return isHexString(publicKeyHex) && getBytes(publicKeyHex).length === 2592;
}
