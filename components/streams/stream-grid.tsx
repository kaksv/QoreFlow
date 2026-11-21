"use client";

import { Inbox, Loader2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import type { Stream } from "@/lib/blockchain/streams";
import { StreamCard } from "./stream-card";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function StreamGrid({
  streams,
  role,
  loading,
  error,
  emptyTitle,
  emptyBody,
  cta,
}: {
  streams: Stream[];
  role: "outgoing" | "incoming";
  loading: boolean;
  error: string | null;
  emptyTitle: string;
  emptyBody: string;
  cta?: { href: string; label: string };
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-card/40 px-5 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Reading streams from QoreChain…
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="flex items-start gap-3 p-5 text-sm">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div className="space-y-1">
            <p className="font-medium">Could not load streams</p>
            <p className="text-muted-foreground">{error}</p>
            <p className="text-xs text-muted-foreground">
              Check that the contract address and RPC are configured, and that
              the network is reachable.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (streams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/30 px-6 py-14 text-center">
        <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Inbox className="h-5 w-5" />
        </span>
        <p className="text-sm font-medium">{emptyTitle}</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{emptyBody}</p>
        {cta && (
          <Link href={cta.href} className="mt-4">
            <Button size="sm">{cta.label}</Button>
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {streams.map((stream) => (
        <StreamCard key={stream.id.toString()} stream={stream} role={role} />
      ))}
    </div>
  );
}
