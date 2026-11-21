"use client";

import { useQuery } from "@tanstack/react-query";
import { isContractConfigured } from "@/lib/config";
import { getReadProvider } from "@/lib/blockchain/provider";
import {
  fetchActivity,
  fetchStream,
  fetchStreams,
  type Stream,
  type StreamsResult,
} from "@/lib/blockchain/streams";

export function useStreams(address: string | null) {
  return useQuery<StreamsResult>({
    queryKey: ["streams", address],
    enabled: Boolean(address) && isContractConfigured(),
    queryFn: () => fetchStreams(getReadProvider(), address as string),
    refetchInterval: 15_000,
    staleTime: 5_000,
    retry: 1,
  });
}

export function useStream(id: string | null) {
  const parsed = (() => {
    if (!id || !/^\d+$/.test(id)) return null;
    try {
      return BigInt(id);
    } catch {
      return null;
    }
  })();

  return useQuery<Stream>({
    queryKey: ["stream", id],
    enabled: parsed !== null && isContractConfigured(),
    queryFn: () => fetchStream(getReadProvider(), parsed as bigint),
    refetchInterval: 15_000,
    staleTime: 5_000,
    retry: 1,
  });
}

export function useActivity(address: string | null) {
  return useQuery({
    queryKey: ["activity", address],
    enabled: Boolean(address) && isContractConfigured(),
    queryFn: () => fetchActivity(getReadProvider(), address as string),
    refetchInterval: 20_000,
    staleTime: 10_000,
    retry: 1,
  });
}
