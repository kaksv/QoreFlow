"use client";

import {
  ArrowDownToLine,
  ArrowUpRight,
  Ban,
  ExternalLink,
  History,
} from "lucide-react";
import type { ActivityItem } from "@/lib/blockchain/streams";
import { explorerTx, isContractConfigured } from "@/lib/config";
import { formatDateTime, formatQor, shortAddress } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const META = {
  created: {
    icon: ArrowUpRight,
    label: "Stream created",
    tone: "text-secondary",
    bg: "bg-secondary/10 ring-secondary/20",
  },
  withdrawn: {
    icon: ArrowDownToLine,
    label: "Withdrawal",
    tone: "text-primary",
    bg: "bg-primary/10 ring-primary/20",
  },
  cancelled: {
    icon: Ban,
    label: "Stream cancelled",
    tone: "text-destructive",
    bg: "bg-destructive/10 ring-destructive/20",
  },
} as const;

export function ActivityList({
  items,
  loading,
  error,
}: {
  items: ActivityItem[];
  loading: boolean;
  error: string | null;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          Recent activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!isContractConfigured() ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Set NEXT_PUBLIC_CONTRACT_ADDRESS to load on-chain activity.
          </p>
        ) : loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded-lg bg-muted/60"
              />
            ))}
          </div>
        ) : error ? (
          <p className="py-6 text-sm text-muted-foreground">
            Activity unavailable: {error}
          </p>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No events yet for this account. Create or receive a stream to see
            activity here.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {items.map((item) => {
              const meta = META[item.kind];
              const Icon = meta.icon;
              return (
                <li key={`${item.txHash}-${item.kind}-${item.streamId}`}>
                  <div className="flex items-center gap-3 py-3">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ${meta.bg} ${meta.tone}`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {meta.label} · #{item.streamId.toString()}
                        {item.counterparty
                          ? ` · ${shortAddress(item.counterparty, 3)}`
                          : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(item.timestamp)} · block {item.blockNumber}
                      </p>
                    </div>
                    <div className="text-right">
                      {item.amount !== undefined && (
                        <p className="font-mono text-sm tabular">
                          {formatQor(item.amount)} QOR
                        </p>
                      )}
                      <a
                        href={explorerTx(item.txHash)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                      >
                        {shortAddress(item.txHash, 4)}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
