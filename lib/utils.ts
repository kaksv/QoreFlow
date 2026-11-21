import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatUnits } from "ethers";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shortAddress(address?: string | null, size = 4): string {
  if (!address) return "";
  if (address.length <= 2 + size * 2) return address;
  return `${address.slice(0, 2 + size)}…${address.slice(-size)}`;
}

/** Formats an 18-decimal wei value, trimming trailing zeros. */
export function formatQor(value: bigint, maxDecimals = 6): string {
  const raw = formatUnits(value, 18);
  const [whole, fraction = ""] = raw.split(".");
  if (!fraction) return whole;
  const trimmed = fraction.slice(0, maxDecimals).replace(/0+$/, "");
  return trimmed.length > 0 ? `${whole}.${trimmed}` : whole;
}

export function formatQorFixed(value: bigint, decimals = 4): string {
  return Number(formatUnits(value, 18)).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatDuration(totalSeconds: bigint | number): string {
  const s = Number(totalSeconds);
  if (!Number.isFinite(s) || s <= 0) return "—";
  const days = Math.floor(s / 86_400);
  const hours = Math.floor((s % 86_400) / 3_600);
  const minutes = Math.floor((s % 3_600) / 60);
  const seconds = Math.floor(s % 60);
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (seconds || parts.length === 0) parts.push(`${seconds}s`);
  return parts.slice(0, 2).join(" ");
}

export function formatDateTime(unixSeconds: bigint | number): string {
  const ms = Number(unixSeconds) * 1000;
  return new Date(ms).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRate(deposit: bigint, durationSeconds: bigint): string {
  if (durationSeconds === 0n) return "—";
  // QOR per day, computed in integer space then rendered with 6 decimals.
  const perDay = (deposit * 86_400n) / durationSeconds;
  return `${formatQor(perDay, 6)} QOR / day`;
}

export function bps(part: bigint, whole: bigint): number {
  if (whole === 0n) return 0;
  return Number((part * 10_000n) / whole) / 100;
}

export function isAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}

export function errorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const maybe = error as {
      shortMessage?: string;
      reason?: string;
      message?: string;
    };
    return maybe.shortMessage ?? maybe.reason ?? maybe.message ?? "Unknown error";
  }
  return "Unknown error";
}

export function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  return Promise.reject(new Error("Clipboard unavailable"));
}
