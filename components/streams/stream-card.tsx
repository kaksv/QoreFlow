"use client";

import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Clock3, Droplets } from "lucide-react";
import { useNow } from "@/hooks/useNow";
import {
  computeAccrued,
  progressPercent,
  streamStatus,
  type Stream,
} from "@/lib/blockchain/streams";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StreamStatusBadge } from "./status-badge";
import {
  formatDateTime,
  formatDuration,
  formatQor,
  shortAddress,
} from "@/lib/utils";

export function StreamCard({
  stream,
  role,
}: {
  stream: Stream;
  role: "outgoing" | "incoming";
}) {
  const now = useNow();
  const status = streamStatus(stream, now);
  const accrued = computeAccrued(stream, now);
  const withdrawable = accrued > stream.withdrawn ? accrued - stream.withdrawn : 0n;
  const progress = progressPercent(stream, now);
  const counterparty = role === "outgoing" ? stream.recipient : stream.sender;

  return (
    <Card className="transition-colors hover:border-primary/25">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-lg ring-1 ${
                role === "incoming"
                  ? "bg-primary/10 text-primary ring-primary/20"
                  : "bg-secondary/10 text-secondary ring-secondary/20"
              }`}
            >
              {role === "incoming" ? (
                <ArrowDownLeft className="h-4 w-4" />
              ) : (
                <ArrowUpRight className="h-4 w-4" />
              )}
            </span>
            <div>
              <p className="text-sm font-medium">
                Stream #{stream.id.toString()}
              </p>
              <p className="font-mono text-xs text-muted-foreground">
                {role === "incoming" ? "from " : "to "}
                {shortAddress(counterparty, 5)}
              </p>
            </div>
          </div>
          <StreamStatusBadge status={status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Deposit</p>
            <p className="mt-0.5 font-mono text-sm tabular">
              {formatQor(stream.deposit)} QOR
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              {stream.cancelled ? "Vested at cancel" : "Vested"}
            </p>
            <p className="mt-0.5 font-mono text-sm tabular text-primary">
              {formatQor(accrued)} QOR
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Withdrawn</p>
            <p className="mt-0.5 font-mono text-sm tabular">
              {formatQor(stream.withdrawn)} QOR
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Withdrawable</p>
            <p className="mt-0.5 font-mono text-sm tabular">
              {formatQor(withdrawable)} QOR
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-3 w-3" />
              {formatDuration(stream.endTime - stream.startTime)}
            </span>
            <span className="tabular">{progress.toFixed(1)}%</span>
          </div>
          <Progress value={progress} />
          <p className="text-xs text-muted-foreground">
            {stream.cancelled
              ? `Cancelled ${formatDateTime(stream.cancelledAt)}`
              : `${formatDateTime(stream.startTime)} → ${formatDateTime(stream.endTime)}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href={`/streams/${stream.id.toString()}`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full">
              Details
            </Button>
          </Link>
          {role === "incoming" && withdrawable > 0n && !stream.cancelled && (
            <Link href={`/streams/${stream.id.toString()}`}>
              <Button size="sm">
                <Droplets />
                Withdraw
              </Button>
            </Link>
          )}
          {role === "incoming" && stream.cancelled && withdrawable > 0n && (
            <Link href={`/streams/${stream.id.toString()}`}>
              <Button size="sm">
                <Droplets />
                Withdraw
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
