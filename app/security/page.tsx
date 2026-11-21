"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Fingerprint,
  Globe2,
  HelpCircle,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  ShieldQuestion,
  Wallet,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PqcStatusBadge } from "@/components/security/pqc-status-badge";
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
import { ConnectPrompt } from "@/components/wallet/connect-prompt";
import { WalletSummary } from "@/components/wallet/wallet-summary";
import { WrongNetworkBanner } from "@/components/wallet/wrong-network-banner";
import { useEvmWindow, usePqcKeyStatus } from "@/hooks/usePqc";
import { useWallet } from "@/hooks/useWallet";
import {
  CHAIN,
  CONTRACT_ADDRESS,
  isContractConfigured,
  PQC,
  QORECHAIN_DOCS,
} from "@/lib/config";
import { publicKeyFingerprint } from "@/lib/pqc/signer";
import { isEvmWindowUsable } from "@/lib/pqc/status";
import { cn, shortAddress } from "@/lib/utils";

type Signal = "verified" | "wallet" | "unknown" | "missing";

function SignalCard({
  icon,
  title,
  source,
  signal,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  source: string;
  signal: Signal;
  children: React.ReactNode;
}) {
  const meta = {
    verified: {
      label: "Verified on chain",
      variant: "success" as const,
      Icon: CheckCircle2,
    },
    wallet: {
      label: "Wallet-reported",
      variant: "warning" as const,
      Icon: Wallet,
    },
    unknown: {
      label: "Unknown",
      variant: "warning" as const,
      Icon: HelpCircle,
    },
    missing: {
      label: "Not present",
      variant: "destructive" as const,
      Icon: XCircle,
    },
  }[signal];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-foreground ring-1 ring-border">
            {icon}
          </span>
          <Badge variant={meta.variant} className="gap-1">
            <meta.Icon className="h-3 w-3" />
            {meta.label}
          </Badge>
        </div>
        <CardTitle className="pt-1">{title}</CardTitle>
        <CardDescription>Source: {source}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">{children}</CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
  mono = true,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 pb-2 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("text-right", mono && "font-mono text-xs")}>{value}</span>
    </div>
  );
}

function Requirement({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      {ok ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      ) : (
        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      )}
      <span className={ok ? "text-foreground" : "text-muted-foreground"}>
        {children}
      </span>
    </li>
  );
}

export default function SecurityPage() {
  const { status, address, chainId, isQoreChain, providerAvailable } = useWallet();
  const keyStatus = usePqcKeyStatus(address);
  const windowQuery = useEvmWindow(address);

  const registered = keyStatus.data?.registered ?? false;
  const algorithmOk =
    keyStatus.data?.algorithmId === PQC.algorithmId;
  const possessionProven = keyStatus.data?.possessionProven ?? false;
  const keyReady = registered && algorithmOk && possessionProven;
  const fingerprint =
    keyStatus.data?.pubkey && keyStatus.data.pubkey.length > 4
      ? publicKeyFingerprint(keyStatus.data.pubkey)
      : null;

  const evmWindow = windowQuery.data;
  const windowReady = isEvmWindowUsable(evmWindow, CONTRACT_ADDRESS);

  if (status === "uninitialized") {
    return (
      <div className="container py-16 text-sm text-muted-foreground">
        Looking for an injected wallet…
      </div>
    );
  }

  return (
    <div className="container space-y-8 py-10">
      <PageHeader
        eyebrow="Security"
        title="What is actually verified"
        description="A connected wallet is not a quantum-safe wallet. This page separates three signals — verified on chain, wallet-reported, and unknown — so nothing is green-washed."
        actions={
          <Link href="/dashboard">
            <Button variant="outline">
              <LockKeyhole />
              Try cancellation
            </Button>
          </Link>
        }
      />

      <WrongNetworkBanner />

      {!address ? (
        <ConnectPrompt what="inspect your post-quantum status" />
      ) : (
        <>
          <WalletSummary />

          <div className="grid gap-4 md:grid-cols-3">
            <SignalCard
              icon={<KeyRound className="h-5 w-5" />}
              title="Post-quantum key"
              source="pqcKeyStatus precompile · 0x…0a02"
              signal={
                keyStatus.isError
                  ? "unknown"
                  : keyStatus.isLoading
                    ? "unknown"
                    : keyReady
                      ? "verified"
                      : "missing"
              }
            >
              {keyStatus.isLoading && (
                <p className="text-muted-foreground">Reading the precompile…</p>
              )}
              {keyStatus.isError && (
                <p className="text-muted-foreground">
                  The key-status precompile could not be read. This is treated as
                  unknown, never as “secure”.
                </p>
              )}
              {keyStatus.data && (
                <div className="space-y-2">
                  <Row label="Registered" value={registered ? "yes" : "no"} />
                  <Row
                    label="Algorithm"
                    value={
                      keyStatus.data.algorithmId === PQC.algorithmId
                        ? "ML-DSA-87 (1)"
                        : `id ${keyStatus.data.algorithmId}`
                    }
                  />
                  <Row
                    label="Proof of possession"
                    value={possessionProven ? "proven" : "not proven"}
                  />
                  <Row
                    label="Key size"
                    value={`${Math.max(
                      0,
                      (keyStatus.data.pubkey.length - 2) / 2,
                    )} bytes`}
                  />
                  {fingerprint && (
                    <Row
                      label="Fingerprint"
                      value={<span title={keyStatus.data.pubkey}>{fingerprint}</span>}
                    />
                  )}
                </div>
              )}
              <p className="text-xs leading-relaxed text-muted-foreground">
                <code className="rounded bg-muted px-1">registered</code> alone is
                not enough: registration without proof of possession would let an
                attacker register a key they do not control. QoreFlow requires
                both.
              </p>
            </SignalCard>

            <SignalCard
              icon={<Globe2 className="h-5 w-5" />}
              title="EVM authorization window"
              source="QoreChain REST · evm_window (bech32, proxied)"
              signal={
                windowQuery.isLoading || windowQuery.isError
                  ? "unknown"
                  : evmWindow && !evmWindow.confident
                    ? "unknown"
                    : windowReady
                      ? "verified"
                      : "missing"
              }
            >
              {windowQuery.isLoading && (
                <p className="text-muted-foreground">Reading the window…</p>
              )}
              {windowQuery.isError && (
                <p className="text-muted-foreground">
                  The REST endpoint did not answer. The chain may still admit or
                  refuse the transaction; the UI cannot confirm it either way.
                </p>
              )}
              {evmWindow && !evmWindow.confident && (
                <p className="text-muted-foreground">
                  A payload was returned, but none of its fields match the shapes
                  this UI knows. It stays labelled unknown rather than being
                  guessed as open.
                </p>
              )}
              {evmWindow && (
                <div className="space-y-2">
                  <Row
                    label="Open"
                    value={
                      evmWindow.found
                        ? evmWindow.live === false
                          ? "stale"
                          : evmWindow.confident
                            ? "yes"
                            : "unconfirmed"
                        : "no"
                    }
                  />
                  {evmWindow.live !== undefined && (
                    <Row
                      label="Live"
                      value={
                        evmWindow.live
                          ? "yes"
                          : "no — expired, exhausted or replaced"
                      }
                    />
                  )}
                  <Row
                    label="Scope"
                    value={
                      evmWindow.nativeOnly
                        ? "native-only"
                        : evmWindow.allowedTargets && evmWindow.allowedTargets.length > 0
                          ? `${evmWindow.allowedTargets.length} target${evmWindow.allowedTargets.length === 1 ? "" : "s"}`
                          : "unknown / unscoped"
                    }
                  />
                  {evmWindow.allowedTargets &&
                    evmWindow.allowedTargets.length > 0 && (
                      <Row
                        label="Targets"
                        value={
                          <span className="flex flex-col gap-0.5">
                            {evmWindow.allowedTargets.map((target) => (
                              <span key={target}>{shortAddress(target, 6)}</span>
                            ))}
                          </span>
                        }
                      />
                    )}
                  {evmWindow.remainingTxs !== undefined && (
                    <Row
                      label="Transactions left"
                      value={
                        evmWindow.maxTxs !== undefined
                          ? `${evmWindow.remainingTxs} / ${evmWindow.maxTxs}`
                          : String(evmWindow.remainingTxs)
                      }
                    />
                  )}
                  {evmWindow.remainingValueUqor !== undefined && (
                    <Row
                      label="Value left"
                      value={
                        evmWindow.maxValueUqor !== undefined
                          ? `${evmWindow.remainingValueUqor} / ${evmWindow.maxValueUqor} uqor`
                          : `${evmWindow.remainingValueUqor} uqor`
                      }
                    />
                  )}
                  {(evmWindow.expiryHeight !== undefined ||
                    evmWindow.expiresAtBlock !== undefined) && (
                    <Row
                      label="Expires at block"
                      value={
                        evmWindow.currentBlock !== undefined
                          ? `${evmWindow.expiryHeight ?? evmWindow.expiresAtBlock} (now ${evmWindow.currentBlock})`
                          : String(
                              evmWindow.expiryHeight ?? evmWindow.expiresAtBlock,
                            )
                      }
                    />
                  )}
                  {evmWindow.remainingBlocks !== undefined && (
                    <Row
                      label="Blocks left"
                      value={String(evmWindow.remainingBlocks)}
                    />
                  )}
                </div>
              )}
              <p className="text-xs leading-relaxed text-muted-foreground">
                A window is opened by a Cosmos-lane transaction signed with both
                the classical and post-quantum keys. Contract calls need a window
                scoped to QoreFlow; contract creation needs an unscoped one.
              </p>
            </SignalCard>

            <SignalCard
              icon={<Fingerprint className="h-5 w-5" />}
              title="Wallet & network"
              source="EIP-1193 provider (wallet-reported)"
              signal={isQoreChain ? "wallet" : "missing"}
            >
              <div className="space-y-2">
                <Row label="Address" value={shortAddress(address, 6)} />
                <Row label="Chain id" value={String(chainId ?? "unknown")} />
                <Row
                  label="Expected"
                  value={`${CHAIN.name} · ${CHAIN.id}`}
                />
                <Row
                  label="Injected provider"
                  value={providerAvailable ? "detected" : "none"}
                />
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                This signal is reported by your wallet, not proven on chain. It
                says nothing about post-quantum readiness.
              </p>
            </SignalCard>
          </div>

          <Card className="border-primary/25 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Cancellation readiness
              </CardTitle>
              <CardDescription>
                Every requirement below is enforced independently. None of them
                has a classical-only fallback.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-2 sm:grid-cols-2">
                <Requirement ok={isQoreChain}>
                  Wallet on QoreChain Diana (chain {CHAIN.id})
                </Requirement>
                <Requirement ok={isContractConfigured()}>
                  QoreFlow address configured
                </Requirement>
                <Requirement ok={registered}>
                  ML-DSA-87 key registered to this account
                </Requirement>
                <Requirement ok={possessionProven}>
                  Proof of possession recorded at registration
                </Requirement>
                <Requirement ok={windowReady}>
                  EVM window admits calls to QoreFlow
                </Requirement>
                <Requirement ok={keyReady}>
                  Secret key held in memory for this session only
                </Requirement>
              </ul>
              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href={QORECHAIN_DOCS.pqcSigning}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button variant="outline" size="sm">
                    Key registration docs
                    <ExternalLink />
                  </Button>
                </a>
                <a
                  href={QORECHAIN_DOCS.windowReference}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button variant="outline" size="sm">
                    EVM window reference
                    <ExternalLink />
                  </Button>
                </a>
                <a href={CHAIN.faucetUrl} target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm">
                    Faucet
                    <ExternalLink />
                  </Button>
                </a>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">What this page does not claim</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  <strong className="text-foreground">
                    EVM transactions are classically signed.
                  </strong>{" "}
                  Every transaction still carries a secp256k1 signature. The
                  post-quantum signature is an additional authorization checked
                  inside QoreFlow.
                </p>
                <p>
                  <strong className="text-foreground">
                    Connected ≠ quantum secure.
                  </strong>{" "}
                  A wallet connection never upgrades the status shown here. Only
                  the on-chain precompile result does.
                </p>
                <p>
                  <strong className="text-foreground">
                    Testnet only.
                  </strong>{" "}
                  Both PQC precompiles are active on Diana testnet and inactive
                  on mainnet. QoreFlow is not deployed to mainnet.
                </p>
                <p>
                  <strong className="text-foreground">
                    The UI cannot audit itself.
                  </strong>{" "}
                  Browser code can be tampered with. The contract checks the
                  signature on chain regardless of what this page renders.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Raw window payload</CardTitle>
                <CardDescription>
                  The REST shape is not fully documented, so the raw response is
                  kept visible instead of being over-interpreted.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {windowQuery.isError ? (
                  <p className="text-sm text-muted-foreground">
                    No payload: the endpoint did not answer.
                  </p>
                ) : (
                  <pre className="max-h-64 overflow-auto rounded-lg border border-border/70 bg-background/60 p-3 text-[11px] leading-relaxed text-muted-foreground">
                    {evmWindow
                      ? JSON.stringify(evmWindow.raw, null, 2)
                      : "Loading…"}
                  </pre>
                )}
              </CardContent>
            </Card>
          </div>

          <Alert variant="warning">
            <AlertTriangle />
            <AlertTitle>If cancellation stays disabled</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>
                The most common causes are a key registered without proof of
                possession, an expired EVM window, or a window scoped to the
                wrong target. Re-register with{" "}
                <code className="rounded bg-background/60 px-1 py-0.5 text-xs">
                  --pqc-key
                </code>{" "}
                and open a window with{" "}
                <code className="rounded bg-background/60 px-1 py-0.5 text-xs">
                  --allowed-targets {CONTRACT_ADDRESS || "0x<QoreFlow>"}
                </code>
                .
              </p>
              <p className="text-xs">
                Transaction nonce and chain id are part of the signed
                authorization, so an authorization prepared for another chain or
                contract cannot be reused here.
              </p>
            </AlertDescription>
          </Alert>

          {!keyReady && (
            <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-card/40 px-4 py-3 text-sm text-muted-foreground">
              <ShieldQuestion className="h-4 w-4" />
              Current key status:{" "}
              <PqcStatusBadge address={address} />
              <span className="ml-auto text-xs">
                {keyStatus.data?.pubkey && keyStatus.data.pubkey.length > 4
                  ? "A key is present but does not meet QoreFlow's requirements."
                  : "No usable ML-DSA-87 key for this account yet."}
              </span>
            </div>
          )}
        </>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Data refreshes every 30 seconds. Verified values come from the chain;
        wallet values are reported by your wallet.
      </p>
    </div>
  );
}
