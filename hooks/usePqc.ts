"use client";

import { useQuery } from "@tanstack/react-query";
import { getReadProvider } from "@/lib/blockchain/provider";
import {
  fetchEvmWindow,
  fetchPqcKeyStatus,
  type EvmWindowSummary,
  type PqcKeyStatus,
} from "@/lib/pqc/status";

export function usePqcKeyStatus(address: string | null) {
  return useQuery<PqcKeyStatus>({
    queryKey: ["pqc-key-status", address],
    enabled: Boolean(address),
    queryFn: () => fetchPqcKeyStatus(getReadProvider(), address as string),
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: 1,
  });
}

export function useEvmWindow(address: string | null) {
  return useQuery<EvmWindowSummary>({
    queryKey: ["evm-window", address],
    enabled: Boolean(address),
    queryFn: () => fetchEvmWindow(address as string),
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: false,
  });
}
