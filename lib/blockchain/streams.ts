import type { Contract, Log, Provider } from "ethers";
import { DEPLOY_BLOCK } from "@/lib/config";
import { getReadContract } from "@/lib/contracts/qoreflow";

export type StreamStatus = "scheduled" | "active" | "completed" | "cancelled";

export interface Stream {
  id: bigint;
  sender: string;
  recipient: string;
  deposit: bigint;
  startTime: bigint;
  endTime: bigint;
  cancelledAt: bigint;
  withdrawn: bigint;
  cancelled: boolean;
  /** On-chain snapshot at fetch time. */
  accrued: bigint;
  withdrawable: bigint;
  snapshotAt: number;
}

export type ActivityKind = "created" | "withdrawn" | "cancelled";

export interface ActivityItem {
  kind: ActivityKind;
  streamId: bigint;
  txHash: string;
  blockNumber: number;
  timestamp: number;
  amount?: bigint;
  counterparty?: string;
}

const LOG_CHUNK = 50_000;
/** Used only when NEXT_PUBLIC_DEPLOY_BLOCK is unset. */
const FALLBACK_SCAN_BLOCKS = 250_000;

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function toStream(id: bigint, view: StreamViewResult): Stream {
  return {
    id,
    sender: view.stream.sender,
    recipient: view.stream.recipient,
    deposit: view.stream.deposit,
    startTime: view.stream.startTime,
    endTime: view.stream.endTime,
    cancelledAt: view.stream.cancelledAt,
    withdrawn: view.stream.withdrawn,
    cancelled: view.stream.cancelled,
    accrued: view.accrued,
    withdrawable: view.withdrawable,
    snapshotAt: nowSeconds(),
  };
}

interface StreamViewResult {
  stream: {
    sender: string;
    recipient: string;
    deposit: bigint;
    startTime: bigint;
    endTime: bigint;
    cancelledAt: bigint;
    withdrawn: bigint;
    cancelled: boolean;
  };
  accrued: bigint;
  withdrawable: bigint;
}

type RawStreamView = [StreamViewResult["stream"], bigint, bigint];

function decodeView(raw: RawStreamView): StreamViewResult {
  return { stream: raw[0], accrued: raw[1], withdrawable: raw[2] };
}

async function scanLogs(
  contract: Contract,
  provider: Provider,
  filter: Parameters<Contract["queryFilter"]>[0],
): Promise<Log[]> {
  const latest = await provider.getBlockNumber();
  const floor =
    DEPLOY_BLOCK > 0 ? DEPLOY_BLOCK : Math.max(0, latest - FALLBACK_SCAN_BLOCKS);
  if (latest < floor) return [];

  const logs: Log[] = [];
  for (let from = floor; from <= latest; from += LOG_CHUNK) {
    const to = Math.min(from + LOG_CHUNK - 1, latest);
    const batch = await contract.queryFilter(filter, from, to);
    logs.push(...batch);
  }
  return logs;
}

async function idsFromCreated(
  contract: Contract,
  provider: Provider,
  sender?: string,
  recipient?: string,
): Promise<bigint[]> {
  const logs = await scanLogs(
    contract,
    provider,
    contract.filters.StreamCreated(null, sender ?? null, recipient ?? null),
  );
  const ids = new Set<string>();
  for (const log of logs) {
    const parsed = contract.interface.parseLog(log);
    if (parsed) ids.add(parsed.args.streamId.toString());
  }
  return [...ids].map((id) => BigInt(id));
}

export async function fetchStream(
  provider: Provider,
  id: bigint,
): Promise<Stream> {
  const contract = getReadContract(provider);
  if (!contract) throw new Error("Contract address is not configured");
  const raw = (await contract.getStreamView(id)) as unknown as RawStreamView;
  return toStream(id, decodeView(raw));
}

export interface StreamsResult {
  outgoing: Stream[];
  incoming: Stream[];
}

export async function fetchStreams(
  provider: Provider,
  address: string,
): Promise<StreamsResult> {
  const contract = getReadContract(provider);
  if (!contract) throw new Error("Contract address is not configured");

  const [outgoingIds, incomingIds] = await Promise.all([
    idsFromCreated(contract, provider, address, undefined),
    idsFromCreated(contract, provider, undefined, address),
  ]);

  const all = new Map<string, bigint>();
  for (const id of [...outgoingIds, ...incomingIds]) all.set(id.toString(), id);

  const views = await Promise.all(
    [...all.values()].map(async (id) => {
      const raw = (await contract.getStreamView(
        id,
      )) as unknown as RawStreamView;
      return toStream(id, decodeView(raw));
    }),
  );

  const byId = new Map(views.map((stream) => [stream.id.toString(), stream]));
  return {
    outgoing: outgoingIds
      .map((id) => byId.get(id.toString()))
      .filter((s): s is Stream => Boolean(s))
      .sort((a, b) => Number(b.id - a.id)),
    incoming: incomingIds
      .map((id) => byId.get(id.toString()))
      .filter((s): s is Stream => Boolean(s))
      .sort((a, b) => Number(b.id - a.id)),
  };
}

export async function fetchActivity(
  provider: Provider,
  address: string,
): Promise<ActivityItem[]> {
  const contract = getReadContract(provider);
  if (!contract) throw new Error("Contract address is not configured");

  const [createdOut, createdIn, withdrawn, cancelled] = await Promise.all([
    scanLogs(
      contract,
      provider,
      contract.filters.StreamCreated(null, address, null),
    ),
    scanLogs(
      contract,
      provider,
      contract.filters.StreamCreated(null, null, address),
    ),
    scanLogs(
      contract,
      provider,
      contract.filters.StreamWithdrawn(null, address),
    ),
    scanLogs(
      contract,
      provider,
      contract.filters.StreamCancelled(null, address),
    ),
  ]);

  const items: Omit<ActivityItem, "timestamp">[] = [];

  for (const log of [...createdOut, ...createdIn]) {
    const parsed = contract.interface.parseLog(log);
    if (!parsed) continue;
    const isOutgoing = parsed.args.sender.toLowerCase() === address.toLowerCase();
    items.push({
      kind: "created",
      streamId: parsed.args.streamId,
      txHash: log.transactionHash,
      blockNumber: log.blockNumber,
      amount: parsed.args.deposit,
      counterparty: isOutgoing ? parsed.args.recipient : parsed.args.sender,
    });
  }

  for (const log of withdrawn) {
    const parsed = contract.interface.parseLog(log);
    if (!parsed) continue;
    items.push({
      kind: "withdrawn",
      streamId: parsed.args.streamId,
      txHash: log.transactionHash,
      blockNumber: log.blockNumber,
      amount: parsed.args.amount,
    });
  }

  for (const log of cancelled) {
    const parsed = contract.interface.parseLog(log);
    if (!parsed) continue;
    items.push({
      kind: "cancelled",
      streamId: parsed.args.streamId,
      txHash: log.transactionHash,
      blockNumber: log.blockNumber,
      amount: parsed.args.refund,
    });
  }

  const uniqueBlocks = [...new Set(items.map((item) => item.blockNumber))];
  const blocks = await Promise.all(
    uniqueBlocks.map((n) => provider.getBlock(n)),
  );
  const timestamps = new Map<number, number>();
  uniqueBlocks.forEach((n, i) => {
    timestamps.set(n, blocks[i]?.timestamp ?? 0);
  });

  return items
    .map((item) => ({ ...item, timestamp: timestamps.get(item.blockNumber) ?? 0 }))
    .sort((a, b) => b.blockNumber - a.blockNumber)
    .slice(0, 40);
}

/** Client-side accrual estimate in wei. Integer math only. */
export function computeAccrued(
  stream: Pick<
    Stream,
    "deposit" | "startTime" | "endTime" | "cancelled" | "cancelledAt"
  >,
  atSeconds: number,
): bigint {
  const at = BigInt(Math.floor(atSeconds));
  const start = stream.startTime;
  const end = stream.endTime;
  const duration = end - start;
  if (duration <= 0n) return stream.deposit;

  const effectiveNow =
    stream.cancelled && stream.cancelledAt > 0n && stream.cancelledAt < at
      ? stream.cancelledAt
      : at;

  if (effectiveNow <= start) return 0n;
  const elapsed = effectiveNow - start;
  if (elapsed >= duration) return stream.deposit;
  return (stream.deposit * elapsed) / duration;
}

export function streamStatus(stream: Stream, atSeconds: number): StreamStatus {
  if (stream.cancelled) return "cancelled";
  const at = BigInt(Math.floor(atSeconds));
  if (at < stream.startTime) return "scheduled";
  if (at >= stream.endTime) return "completed";
  return "active";
}

export function progressPercent(stream: Stream, atSeconds: number): number {
  if (stream.cancelled && stream.cancelledAt > 0n) {
    return Number(
      ((stream.cancelledAt - stream.startTime) * 10_000n) /
        (stream.endTime - stream.startTime),
    ) / 100;
  }
  const at = BigInt(Math.floor(atSeconds));
  if (at <= stream.startTime) return 0;
  if (at >= stream.endTime) return 100;
  return Number(
    ((at - stream.startTime) * 10_000n) / (stream.endTime - stream.startTime),
  ) / 100;
}
