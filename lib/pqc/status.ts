import type { Provider } from "ethers";
import { getKeyStatusContract } from "@/lib/contracts/qoreflow";
import { CHAIN, PQC } from "@/lib/config";

export interface PqcKeyStatus {
  registered: boolean;
  algorithmId: number;
  pubkey: string;
  possessionProven: boolean;
}

/** Reads the account's registered key from the on-chain precompile. */
export async function fetchPqcKeyStatus(
  provider: Provider,
  address: string,
): Promise<PqcKeyStatus> {
  const contract = getKeyStatusContract(provider);
  const result = (await contract.pqcKeyStatus(address)) as [
    boolean,
    bigint | number,
    string,
    boolean,
  ];
  return {
    registered: Boolean(result[0]),
    algorithmId: Number(result[1]),
    pubkey: result[2],
    possessionProven: Boolean(result[3]),
  };
}

export interface EvmWindowSummary {
  found: boolean;
  /**
   * True only when the payload contained a field we actually recognise. The
   * REST shape is documented per-field below, but the parser stays tolerant:
   * an unrecognised object is never presented as "verified".
   */
  confident: boolean;
  /** Verified shape: `found` can be true while the window is no longer live. */
  live?: boolean;
  nativeOnly?: boolean;
  allowedTargets?: string[];
  remainingTxs?: number;
  maxTxs?: number;
  usedTxs?: number;
  remainingBlocks?: number;
  remainingValueUqor?: string;
  maxValueUqor?: string;
  usedValueUqor?: string;
  openedHeight?: number;
  expiryHeight?: number;
  /** Older aliases kept for tolerant parsing. */
  expiresAtBlock?: number;
  currentBlock?: number;
  raw: unknown;
}

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function pickNumber(
  record: Record<string, unknown>,
  keys: string[],
): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function pickBoolean(
  record: Record<string, unknown>,
  keys: string[],
): boolean | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") return value;
  }
  return undefined;
}

/**
 * The REST API returns uqor amounts as decimal strings. Accept a number too, so
 * a future shape change degrades to a usable value instead of "unknown".
 */
function pickDecimalString(
  record: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim() !== "") return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function pickStringArray(
  record: Record<string, unknown>,
  keys: string[],
): string[] | undefined {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
      return value as string[];
    }
  }
  return undefined;
}

/**
 * Tolerant parser for the EVM window payload. The verified Diana shape is
 * documented in docs/QORECHAIN_INTEGRATION.md; older spellings are still
 * accepted so a node upgrade does not silently turn a real window into
 * "unknown". Unknown fields are never invented.
 */
export function parseEvmWindow(payload: unknown): EvmWindowSummary {
  const root = asRecord(payload);
  if (!root) return { found: false, confident: false, raw: payload };

  const nested = asRecord(root.window) ?? asRecord(root.evm_window) ?? root;
  const pick = <T>(
    keys: string[],
    fn: (record: Record<string, unknown>, keys: string[]) => T | undefined,
  ): T | undefined => fn(nested, keys) ?? fn(root, keys);

  const explicitFound = pick(["found", "active", "open"], pickBoolean);
  const live = pick(["live", "is_live"], pickBoolean);
  const nativeOnly = pick(["native_only", "nativeOnly"], pickBoolean);
  const allowedTargets = pick(
    ["allowed_targets", "allowedTargets"],
    pickStringArray,
  );
  const remainingTxs = pick(
    ["remaining_txs", "remainingTxs", "txs_remaining"],
    pickNumber,
  );
  const maxTxs = pick(["max_txs", "maxTxs"], pickNumber);
  const usedTxs = pick(["used_txs", "usedTxs"], pickNumber);
  const remainingBlocks = pick(
    ["remaining_blocks", "remainingBlocks"],
    pickNumber,
  );
  const remainingValueUqor = pick(
    [
      "remaining_value",
      "remainingValue",
      "remaining_value_uqor",
      "max_value_remaining",
    ],
    pickDecimalString,
  );
  const maxValueUqor = pick(["max_value", "maxValue"], pickDecimalString);
  const usedValueUqor = pick(["used_value", "usedValue"], pickDecimalString);
  const openedHeight = pick(
    ["opened_height", "openedHeight"],
    pickNumber,
  );
  const expiryHeight = pick(
    ["expiry_height", "expiryHeight", "expires_at_block", "expiresAtBlock"],
    pickNumber,
  );
  const currentBlock = pick(["current_block", "currentBlock", "height"], pickNumber);

  // The REST shape is not fully documented. Only call the payload "confident"
  // when a recognised field or a nested window object is present; otherwise an
  // arbitrary object must stay labelled unknown.
  const confident =
    explicitFound !== undefined ||
    live !== undefined ||
    nested !== root ||
    [
      nativeOnly,
      allowedTargets,
      remainingTxs,
      maxTxs,
      usedTxs,
      remainingBlocks,
      remainingValueUqor,
      maxValueUqor,
      usedValueUqor,
      openedHeight,
      expiryHeight,
      currentBlock,
    ].some((value) => value !== undefined);

  return {
    found: explicitFound ?? true,
    confident,
    live,
    nativeOnly,
    allowedTargets,
    remainingTxs,
    maxTxs,
    usedTxs,
    remainingBlocks,
    remainingValueUqor,
    maxValueUqor,
    usedValueUqor,
    openedHeight,
    expiryHeight,
    currentBlock,
    raw: payload,
  };
}

/**
 * Single source of truth for "can this window admit a call to QoreFlow?".
 *
 * A consumed or expired window still returns `found: true`, so `found` alone is
 * not enough. Verified shape: `live`, `remaining_txs`, `remaining_value`,
 * `remaining_blocks`, `expiry_height`.
 */
export function isEvmWindowUsable(
  window: EvmWindowSummary | undefined,
  contractAddress: string,
): boolean {
  if (!window || !window.confident || !window.found) return false;
  if (window.live === false) return false;
  if (window.nativeOnly) return false;
  if (
    window.allowedTargets &&
    window.allowedTargets.length > 0 &&
    !window.allowedTargets.some(
      (target) => target.toLowerCase() === contractAddress.toLowerCase(),
    )
  ) {
    return false;
  }
  if (window.remainingTxs !== undefined && window.remainingTxs <= 0) return false;
  if (window.remainingBlocks !== undefined && window.remainingBlocks <= 0) {
    return false;
  }
  if (
    window.remainingValueUqor !== undefined &&
    Number(window.remainingValueUqor) <= 0
  ) {
    return false;
  }
  if (
    window.expiryHeight !== undefined &&
    window.currentBlock !== undefined &&
    window.currentBlock >= window.expiryHeight
  ) {
    return false;
  }
  return true;
}

export async function fetchEvmWindow(
  address: string,
): Promise<EvmWindowSummary> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    // Same-origin proxy: the upstream REST service is not guaranteed to send
    // CORS headers, so the browser must never call it directly.
    const response = await fetch(
      `/api/evm-window?address=${encodeURIComponent(address)}`,
      {
        signal: controller.signal,
        cache: "no-store",
        headers: { accept: "application/json" },
      },
    );
    if (!response.ok) {
      throw new Error(`REST responded ${response.status}`);
    }
    const payload = (await response.json()) as Json;
    return parseEvmWindow(payload);
  } finally {
    clearTimeout(timeout);
  }
}

export function windowRpcUrl(): string {
  return CHAIN.restUrl;
}

export { PQC };
