"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarClock,
  CircleDollarSign,
  ExternalLink,
  Loader2,
  RefreshCw,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { CancelStreamPanel } from "@/components/streams/cancel-stream-panel";
import { StreamStatusBadge } from "@/components/streams/status-badge";
import { WithdrawButton } from "@/components/streams/withdraw-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useNow } from "@/hooks/useNow";
import { useStream } from "@/hooks/useStreams";
import { useWallet } from "@/hooks/useWallet";
import {
  computeAccrued,
  progressPercent,
  streamStatus,
} from "@/lib/blockchain/streams";
import {
  explorerAddress,
  isContractConfigured,
} from "@/lib/config";
import {
  errorMessage,
  formatDateTime,
  formatDuration,
  formatQor,
  formatRate,
  shortAddress,
} from "@/lib/utils";

function Party({
  label,
  address,
  you,
}: {
  label: string;
  address: string;
  you: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm">{shortAddress(address, 6)}</span>
        {you && <Badge variant="success">You</Badge>}
        <a
          href={explorerAddress(address)}
          target="_blank"
          rel="noreferrer"
          className="text-muted-foreground hover:text-primary"
          aria-label={`View ${label} on the explorer`}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}

export function StreamDetail({ id }: { id: string }) {
  const { address } = useWallet();
  const now = useNow();
  const query = useStream(id);
  const stream = query.data;

  if (!isContractConfigured()) {
    return (
      <div className="container max-w-3xl space-y-6 py-12">
        <PageHeader title="Stream" />
        <Alert variant="warning">
          <TriangleAlert />
          <AlertTitle>Contract not configured</AlertTitle>
          <AlertDescription>
            Set NEXT_PUBLIC_CONTRACT_ADDRESS to a deployed QoreFlow instance to
            read streams.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!/^\d+$/.test(id)) {
    return (
      <div className="container max-w-3xl space-y-6 py-12">
        <PageHeader title="Invalid stream id" description={`"${id}" is not a stream id.`} />
        <Link href="/dashboard">
          <Button variant="outline">
            <ArrowLeft />
            Back to dashboard
          </Button>
        </Link>
      </div>
    );
  }

  if (query.isLoading) {
    return (
      <div className="container flex items-center gap-3 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Reading stream #{id} from QoreChain…
      </div>
    );
  }

  if (query.isError || !stream) {
    return (
      <div className="container max-w-3xl space-y-6 py-12">
        <PageHeader title={`Stream #${id}`} />
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Could not load this stream</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              {query.error
                ? errorMessage(query.error)
                : "The stream does not exist on this contract."}
            </p>
            <p className="text-xs">
              Check the id and that the configured contract address matches the
              deployment you expect.
            </p>
          </AlertDescription>
        </Alert>
        <Link href="/dashboard">
          <Button variant="outline">
            <ArrowLeft />
            Back to dashboard
          </Button>
        </Link>
      </div>
    );
  }

  const status = streamStatus(stream, now);
  const accrued = computeAccrued(stream, now);
  const withdrawable = accrued > stream.withdrawn ? accrued - stream.withdrawn : 0n;
  const progress = progressPercent(stream, now);
  const duration = stream.endTime - stream.startTime;
  const isSender =
    address !== null && address.toLowerCase() === stream.sender.toLowerCase();
  const isRecipient =
    address !== null &&
    address.toLowerCase() === stream.recipient.toLowerCase();

  return (
    <div className="container max-w-4xl space-y-8 py-10">
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Link>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
        >
          <RefreshCw className={query.isFetching ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      <PageHeader
        eyebrow="Stream"
        title={`Stream #${stream.id.toString()}`}
        description={`${formatRate(stream.deposit, duration)} · ${formatDuration(duration)}`}
        actions={<StreamStatusBadge status={status} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Deposit
            </p>
            <p className="mt-2 font-mono text-xl font-semibold tabular">
              {formatQor(stream.deposit)}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                QOR
              </span>
            </p>
          </CardContent>
        </Card>
        <Card className="border-primary/25">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {stream.cancelled ? "Vested at cancellation" : "Vested so far"}
            </p>
            <p className="mt-2 font-mono text-xl font-semibold tabular text-primary">
              {formatQor(accrued)}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                QOR
              </span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Withdrawable
            </p>
            <p className="mt-2 font-mono text-xl font-semibold tabular">
              {formatQor(withdrawable)}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                QOR
              </span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Withdrawn
            </p>
            <p className="mt-2 font-mono text-xl font-semibold tabular">
              {formatQor(stream.withdrawn)}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                QOR
              </span>
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
            Lifecycle
          </CardTitle>
          <CardDescription>
            Accrual is linear and computed from block timestamps, not from a
            keeper or a per-second transaction.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{formatDateTime(stream.startTime)}</span>
              <span className="tabular">{progress.toFixed(2)}%</span>
              <span>{formatDateTime(stream.endTime)}</span>
            </div>
            <Progress value={progress} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Party label="Sender" address={stream.sender} you={isSender} />
            <Party label="Recipient" address={stream.recipient} you={isRecipient} />
          </div>
          {stream.cancelled && (
            <p className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs text-muted-foreground">
              Cancelled at {formatDateTime(stream.cancelledAt)}. Accrual froze at
              that timestamp; the recipient keeps every vested wei.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="bg-muted/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">How the numbers are derived</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 font-mono text-xs text-muted-foreground">
          <p>
            accrued = floor({formatQor(stream.deposit)} × clamp(now − start, 0,{" "}
            {duration.toString()}) ÷ {duration.toString()})
          </p>
          <p>withdrawable = accrued − withdrawn</p>
          <p className="font-sans text-xs">
            The client recomputes this every second; the chain remains the source
            of truth and is re-read every 15 seconds.
          </p>
        </CardContent>
      </Card>

      {(isRecipient || isSender) && (
        <div className="space-y-4">
          {isRecipient && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-primary" />
                  Recipient actions
                </CardTitle>
                <CardDescription>
                  Withdrawal is recipient-only. No extra signature is required.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <WithdrawButton stream={stream} />
                {withdrawable === 0n && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {stream.cancelled
                      ? "Everything vested at cancellation has already been withdrawn."
                      : "Nothing has vested since the last withdrawal."}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {isSender && <CancelStreamPanel stream={stream} />}
        </div>
      )}

      {!isRecipient && !isSender && (
        <Alert variant="info">
          <CircleDollarSign />
          <AlertTitle>Read-only view</AlertTitle>
          <AlertDescription>
            Connect the sender or recipient wallet to withdraw or cancel.{" "}
            <a
              href={explorerAddress(stream.recipient)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              View the recipient on the explorer
              <ArrowUpRight className="h-3 w-3" />
            </a>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
