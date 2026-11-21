"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CircleDollarSign,
  Fuel,
  PlusCircle,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ActivityList } from "@/components/streams/activity-list";
import { StatCard } from "@/components/streams/stat-card";
import { StreamGrid } from "@/components/streams/stream-grid";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConnectPrompt } from "@/components/wallet/connect-prompt";
import { WalletSummary } from "@/components/wallet/wallet-summary";
import { WrongNetworkBanner } from "@/components/wallet/wrong-network-banner";
import { useNow } from "@/hooks/useNow";
import { useActivity, useStreams } from "@/hooks/useStreams";
import { useWallet } from "@/hooks/useWallet";
import {
  computeAccrued,
  streamStatus,
  type Stream,
} from "@/lib/blockchain/streams";
import { isContractConfigured } from "@/lib/config";
import { errorMessage, formatQor } from "@/lib/utils";

function withdrawableNow(stream: Stream, now: number): bigint {
  const accrued = computeAccrued(stream, now);
  return accrued > stream.withdrawn ? accrued - stream.withdrawn : 0n;
}

export default function DashboardPage() {
  const { status, address } = useWallet();
  const now = useNow();
  const streamsQuery = useStreams(address);
  const activityQuery = useActivity(address);

  const stats = useMemo(() => {
    const outgoing = streamsQuery.data?.outgoing ?? [];
    const incoming = streamsQuery.data?.incoming ?? [];

    const incomingWithdrawable = incoming.reduce(
      (sum, stream) => sum + withdrawableNow(stream, now),
      0n,
    );
    const incomingVested = incoming.reduce(
      (sum, stream) => sum + computeAccrued(stream, now),
      0n,
    );
    const outgoingRemaining = outgoing.reduce((sum, stream) => {
      const accrued = computeAccrued(stream, now);
      return sum + (stream.deposit > accrued ? stream.deposit - accrued : 0n);
    }, 0n);
    const outgoingTotal = outgoing.reduce(
      (sum, stream) => sum + stream.deposit,
      0n,
    );
    const active =
      [...outgoing, ...incoming].filter(
        (stream) => streamStatus(stream, now) === "active",
      ).length ?? 0;

    return {
      incomingWithdrawable,
      incomingVested,
      outgoingRemaining,
      outgoingTotal,
      active,
      incomingCount: incoming.length,
      outgoingCount: outgoing.length,
    };
  }, [streamsQuery.data, now]);

  if (status === "uninitialized") {
    return (
      <div className="container py-16">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Fuel className="h-4 w-4 animate-spin" />
          Looking for an injected wallet…
        </div>
      </div>
    );
  }

  if (!address) {
    return (
      <div className="container space-y-8 py-12">
        <PageHeader
          eyebrow="Dashboard"
          title="Your streams, live"
          description="Connect the wallet that sends or receives streams on QoreChain. Reads come from the public RPC; transactions come from your wallet."
        />
        <ConnectPrompt what="see your streams" />
      </div>
    );
  }

  return (
    <div className="container space-y-8 py-10">
      <PageHeader
        eyebrow="Dashboard"
        title="Your streams, live"
        description="Everything here is read from QoreFlow on QoreChain Diana. The client re-computes accrual every second between on-chain polls."
        actions={
          <Link href="/streams/create">
            <Button>
              <PlusCircle />
              New stream
            </Button>
          </Link>
        }
      />

      <WrongNetworkBanner />

      {!isContractConfigured() && (
        <Alert variant="warning">
          <Fuel />
          <AlertTitle>Contract address not configured</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              Reads are disabled until{" "}
              <code className="rounded bg-background/60 px-1 py-0.5 text-xs">
                NEXT_PUBLIC_CONTRACT_ADDRESS
              </code>{" "}
              points at a deployed QoreFlow instance. Deploy with{" "}
              <code className="rounded bg-background/60 px-1 py-0.5 text-xs">
                npm run deploy:testnet
              </code>
              , then copy the printed address into{" "}
              <code className="rounded bg-background/60 px-1 py-0.5 text-xs">
                .env.local
              </code>
              .
            </p>
          </AlertDescription>
        </Alert>
      )}

      <WalletSummary />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Withdrawable now"
          value={formatQor(stats.incomingWithdrawable)}
          suffix="QOR"
          tone="positive"
          icon={<ArrowDownLeft className="h-4 w-4" />}
          hint="Vested income you can withdraw"
        />
        <StatCard
          label="Vested income"
          value={formatQor(stats.incomingVested)}
          suffix="QOR"
          icon={<Wallet className="h-4 w-4" />}
          hint={`${stats.incomingCount} incoming stream${stats.incomingCount === 1 ? "" : "s"}`}
        />
        <StatCard
          label="Outgoing committed"
          value={formatQor(stats.outgoingRemaining)}
          suffix="QOR"
          icon={<ArrowUpRight className="h-4 w-4" />}
          hint={`of ${formatQor(stats.outgoingTotal)} QOR deposited`}
        />
        <StatCard
          label="Active streams"
          value={String(stats.active)}
          icon={<CircleDollarSign className="h-4 w-4" />}
          hint="Across both directions"
        />
      </div>

      <Alert variant="info">
        <ShieldCheck />
        <AlertTitle>Sender actions need post-quantum authorization</AlertTitle>
        <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Withdrawals are recipient-only and need no extra signature.
            Cancellation requires a live ML-DSA-87 key and an open EVM window.
          </span>
          <Link href="/security" className="shrink-0">
            <Button variant="outline" size="sm">
              Check security status
            </Button>
          </Link>
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="incoming" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="incoming">
              <ArrowDownLeft className="h-3.5 w-3.5" />
              Incoming
              <Badge variant="outline" className="ml-1">
                {stats.incomingCount}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="outgoing">
              <ArrowUpRight className="h-3.5 w-3.5" />
              Outgoing
              <Badge variant="outline" className="ml-1">
                {stats.outgoingCount}
              </Badge>
            </TabsTrigger>
          </TabsList>
          <p className="text-xs text-muted-foreground">
            {streamsQuery.isFetching
              ? "Refreshing from chain…"
              : "Auto-refreshes every 15 seconds"}
          </p>
        </div>

        <TabsContent value="incoming">
          <StreamGrid
            streams={streamsQuery.data?.incoming ?? []}
            role="incoming"
            loading={streamsQuery.isLoading}
            error={
              streamsQuery.error
                ? errorMessage(streamsQuery.error)
                : null
            }
            emptyTitle="No incoming streams"
            emptyBody="When someone streams QOR to this address, it appears here and starts vesting immediately."
          />
        </TabsContent>

        <TabsContent value="outgoing">
          <StreamGrid
            streams={streamsQuery.data?.outgoing ?? []}
            role="outgoing"
            loading={streamsQuery.isLoading}
            error={
              streamsQuery.error
                ? errorMessage(streamsQuery.error)
                : null
            }
            emptyTitle="No outgoing streams"
            emptyBody="Fund a stream to pay someone continuously instead of in batches."
            cta={{ href: "/streams/create", label: "Create a stream" }}
          />
        </TabsContent>
      </Tabs>

      <ActivityList
        items={activityQuery.data ?? []}
        loading={activityQuery.isLoading}
        error={
          activityQuery.error ? errorMessage(activityQuery.error) : null
        }
      />
    </div>
  );
}
