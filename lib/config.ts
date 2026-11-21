export const CHAIN = {
  id: 9800,
  hexId: "0x2648",
  name: "QoreChain Diana Testnet",
  shortName: "Diana",
  rpcUrl: process.env.NEXT_PUBLIC_QORECHAIN_RPC ?? "https://evm-testnet.qore.host",
  restUrl:
    process.env.NEXT_PUBLIC_QORECHAIN_REST ?? "https://api-testnet.qore.host",
  explorerUrl:
    process.env.NEXT_PUBLIC_EXPLORER_URL ?? "https://explore.qore.network",
  faucetUrl: "https://dashboard.qorechain.io/faucet",
  currency: { name: "QOR", symbol: "QOR", decimals: 18 },
} as const;

export const EXPLORER_TX_PATH = "tx";
export const EXPLORER_ADDRESS_PATH = "address";

export const CONTRACT_ADDRESS = (
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? ""
).trim();

export function isContractConfigured(): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(CONTRACT_ADDRESS);
}

/**
 * First block to scan for QoreFlow events. Set NEXT_PUBLIC_DEPLOY_BLOCK after
 * deployment to keep log queries small. Defaults to 0 so the app still works
 * (slowly) if it is not set.
 */
export const DEPLOY_BLOCK = (() => {
  const raw = process.env.NEXT_PUBLIC_DEPLOY_BLOCK;
  if (!raw) return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
})();

export const PQC = {
  verifyPrecompile: "0x0000000000000000000000000000000000000a01",
  keyStatusPrecompile: "0x0000000000000000000000000000000000000a02",
  algorithmId: 1,
  pubkeyLength: 2592,
  signatureLength: 4627,
} as const;

export const QORECHAIN_DOCS = {
  integration: "https://docs.qorechain.io/developer-guide/evm-development/",
  precompiles: "https://docs.qorechain.io/developer-guide/evm-precompiles",
  pqcSigning: "https://docs.qorechain.io/developer-guide/post-quantum-signing",
  windowReference:
    "https://docs.qorechain.io/developer-guide/evm-window-reference/",
  workshop: "https://docs.qorechain.io/build-before-qday/workshop-2/",
  contractAuditor: "https://docs.qorechain.io/dashboard/contract-auditor/",
} as const;

export function explorerTx(hash: string): string {
  return `${CHAIN.explorerUrl}/${EXPLORER_TX_PATH}/${hash}`;
}

export function explorerAddress(address: string): string {
  return `${CHAIN.explorerUrl}/${EXPLORER_ADDRESS_PATH}/${address}`;
}

/** REST endpoint that reports the live EVM authorization window. Requires bech32. */
export function evmWindowEndpoint(address: string): string {
  return `${CHAIN.restUrl}/qorechain/pqc/v1/evm_window/${address}`;
}
