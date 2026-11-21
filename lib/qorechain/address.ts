import { decode, encode, fromWords, toWords } from "bech32";
import { getBytes, isAddress } from "ethers";

/**
 * QoreChain's Cosmos-lane REST endpoints accept **bech32** account addresses,
 * not 0x EVM addresses. Verified on Diana testnet on 21 Nov 2026:
 *
 *   GET /qorechain/pqc/v1/evm_window/0x…            → 400 "invalid bech32"
 *   GET /qorechain/pqc/v1/evm_window/qor1…          → the live window payload
 *
 * The account address is the same 20 bytes as the EVM address, encoded with the
 * `qor` human-readable prefix. This helper performs only that encoding; it does
 * not derive a key or touch a private key.
 */
export const QORECHAIN_BECH32_PREFIX = "qor";

/** Returns true for a 20-byte bech32 address with QoreChain's `qor` prefix. */
export function isQorBech32Address(value: string): boolean {
  try {
    const { prefix, words } = decode(value);
    return (
      prefix === QORECHAIN_BECH32_PREFIX && fromWords(words).length === 20
    );
  } catch {
    return false;
  }
}

/** Converts a 0x EVM address to its `qor1…` Cosmos-lane representation. */
export function evmAddressToBech32(address: string): string {
  if (!isAddress(address)) {
    throw new Error("A valid 20-byte 0x address is required.");
  }
  return encode(
    QORECHAIN_BECH32_PREFIX,
    toWords(getBytes(address.toLowerCase())),
  );
}
