import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  Building2,
  CircleDollarSign,
  Clock3,
  Fingerprint,
  KeyRound,
  Layers,
  LineChart,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { ConnectButton } from "@/components/wallet/connect-button";
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
import { CHAIN, QORECHAIN_DOCS } from "@/lib/config";

const STEPS = [
  {
    icon: CircleDollarSign,
    title: "Fund a stream",
    body: "Deposit QOR and choose a recipient and duration. The deposit is locked atomically with the stream.",
  },
  {
    icon: Clock3,
    title: "Accrue by the second",
    body: "The contract vests floor(deposit × elapsed ÷ duration). No per-second transactions, no keeper.",
  },
  {
    icon: Banknote,
    title: "Withdraw what you earned",
    body: "The recipient withdraws vested funds whenever they like. The chain is the source of truth.",
  },
];

const SECURITY_LAYERS = [
  {
    icon: Layers,
    title: "Network: authorization windows",
    body: "QoreChain admits EVM transactions only from accounts with a registered ML-DSA-87 key and a live, bounded authorization window. A stolen classical key alone cannot open one.",
    tag: "Chain-enforced",
  },
  {
    icon: Fingerprint,
    title: "Contract: pqcVerify",
    body: "Cancellation requires a second, post-quantum signature checked by the 0x…0a01 precompile and bound to the sender's registered key, stream, chain, action, nonce and deadline.",
    tag: "Verified on chain",
  },
  {
    icon: ShieldCheck,
    title: "Interface: honest status",
    body: "The app separates verified on-chain state from wallet-reported state and unknown state. A connected wallet is never labelled quantum secure on its own.",
    tag: "No green-washing",
  },
];

const USE_CASES = [
  {
    icon: Users,
    title: "Freelancers",
    body: "Stop waiting for net-30 invoices. Work accrues into a balance the moment it is delivered.",
  },
  {
    icon: Building2,
    title: "Payroll",
    body: "Continuous salary streams with a cancellation path that still pays every earned second.",
  },
  {
    icon: Zap,
    title: "Subscriptions",
    body: "Recurring access funded by a stream instead of card retries and dunning emails.",
  },
  {
    icon: LineChart,
    title: "Grants & vesting",
    body: "Milestone funding that unlocks linearly, with an auditable on-chain trail.",
  },
];

const FAQ = [
  {
    q: "Are EVM transactions themselves post-quantum signed?",
    a: "No — and we will not pretend otherwise. QoreChain EVM transactions use classical secp256k1 signatures. Post-quantum protection comes from two places: the account's registered ML-DSA-87 key plus a bounded EVM authorization window at the network layer, and an additional ML-DSA-87 signature verified by pqcVerify inside QoreFlow for cancellation.",
  },
  {
    q: "Why is cancellation the sensitive action?",
    a: "Withdrawal is recipient-initiated and can only ever move funds the recipient already earned. Cancellation is different: it decides when accrual stops and returns the unvested balance. QoreFlow requires a post-quantum authorization for that decision, bound to one stream, one chain, one contract and one nonce.",
  },
  {
    q: "What happens if I cancel halfway?",
    a: "Accrual freezes at the cancellation timestamp. The recipient keeps every vested wei and can still withdraw it; only the unvested remainder returns to the sender. Cancelling twice is impossible, and the nonce prevents replaying the authorization.",
  },
  {
    q: "Do I need a special wallet?",
    a: "You need an EIP-1193 EVM wallet configured for QoreChain Diana (chain ID 9800), and the account must use the coin-type-60 Ethereum key. To cancel, the account also needs a registered ML-DSA-87 key with a proof of possession, and an open EVM authorization window.",
  },
  {
    q: "Is this ready for mainnet?",
    a: "No. QoreFlow is testnet software built for the QoreChain Build Before Q-Day fest. The PQC precompiles are active on Diana and not on mainnet, and the contracts have not had an independent human audit.",
  },
];

export default function LandingPage() {
  return (
    <div className="overflow-hidden">
      {/* Hero */}
      <section className="relative">
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-grid-faint opacity-[0.18] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]"
          aria-hidden="true"
        />
        <div className="container grid gap-14 pb-20 pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:pt-24">
          <div className="animate-fade-up space-y-7">
            <Badge variant="outline" className="gap-2 border-primary/30 bg-primary/5 text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              QoreChain Build Before Q-Day · Post-Quantum dApp
            </Badge>
            <div className="space-y-5">
              <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                Money that flows.
                <span className="block bg-gradient-to-r from-primary via-emerald-300 to-secondary bg-clip-text text-transparent">
                  Security built for tomorrow.
                </span>
              </h1>
              <p className="max-w-xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg">
                QoreFlow streams QOR continuously over time. Recipients withdraw
                what they have already earned, second by second — while
                sensitive actions require an ML-DSA-87 post-quantum
                authorization verified on chain.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/streams/create">
                <Button size="lg">
                  Start a stream
                  <ArrowRight />
                </Button>
              </Link>
              <Link href="/security">
                <Button size="lg" variant="outline">
                  <ShieldCheck />
                  Security model
                </Button>
              </Link>
              <div className="ml-1 hidden sm:block">
                <ConnectButton />
              </div>
            </div>
            <dl className="grid max-w-lg grid-cols-3 gap-4 border-t border-border/60 pt-6 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Settlement
                </dt>
                <dd className="mt-1 font-medium">Every second</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Cancellation
                </dt>
                <dd className="mt-1 font-medium">PQC-verified</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Network
                </dt>
                <dd className="mt-1 font-medium">{CHAIN.shortName} · {CHAIN.id}</dd>
              </div>
            </dl>
          </div>

          {/* Illustrative preview */}
          <div className="relative animate-fade-up lg:pt-4">
            <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-primary/10 via-transparent to-secondary/10 blur-2xl" />
            <Card className="overflow-hidden shadow-glow">
              <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-5 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Stream preview · illustration
                </p>
                <Badge variant="success">Active</Badge>
              </div>
              <CardContent className="space-y-6 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Vested so far</p>
                    <p className="mt-1 font-mono text-3xl font-semibold tracking-tight tabular">
                      412.906
                      <span className="ml-1 text-sm font-normal text-muted-foreground">
                        QOR
                      </span>
                    </p>
                  </div>
                  <div className="rounded-lg border border-primary/25 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                    +0.004 QOR/s
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Day 17 of 30</span>
                    <span>57.6%</span>
                  </div>
                  <Progress value={57.6} />
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border border-border/70 bg-background/40 p-3">
                    <p className="text-xs text-muted-foreground">Withdrawn</p>
                    <p className="mt-1 font-mono tabular">300.000 QOR</p>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-background/40 p-3">
                    <p className="text-xs text-muted-foreground">Withdrawable</p>
                    <p className="mt-1 font-mono tabular text-primary">112.906 QOR</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">
                  <LockKeyhole className="h-3.5 w-3.5" />
                  Cancellation requires an ML-DSA-87 signature verified by
                  pqcVerify.
                </div>
              </CardContent>
            </Card>
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <BadgeCheck className="h-3.5 w-3.5 text-primary" />
              Contract is the source of truth · UI estimates between polls
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border/60 bg-background/40">
        <div className="container py-20">
          <div className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">
              How streaming works
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">
              Batched payments are a waiting room. Streams are a flow.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              One deposit, one duration, linear vesting. Nothing needs to run
              every second — the contract computes the vested balance from
              timestamps whenever anyone asks.
            </p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <Card key={step.title} className="relative">
                <CardHeader>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                      <step.icon className="h-5 w-5" />
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      0{index + 1}
                    </span>
                  </div>
                  <CardTitle>{step.title}</CardTitle>
                  <CardDescription>{step.body}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
          <div className="mt-6 rounded-xl border border-border/70 bg-card/50 px-5 py-4 font-mono text-xs text-muted-foreground">
            accrued = floor(deposit × clamp(now − start, 0, duration) ÷ duration)
            <span className="mx-2 text-border">|</span>
            withdrawable = accrued − withdrawn
          </div>
        </div>
      </section>

      {/* Post-quantum */}
      <section className="relative border-t border-border/60">
        <div className="container py-20">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-4">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">
                Post-quantum, honestly
              </p>
              <h2 className="text-3xl font-semibold tracking-tight">
                Security is more than a badge.
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                A wallet connection is not proof of quantum resistance. QoreFlow
                shows three separate signals, each with its own source, and
                never upgrades “connected” to “quantum secure”.
              </p>
              <div className="space-y-3 pt-2">
                {[
                  ["Registered ML-DSA-87 key", "Read from pqcKeyStatus"],
                  ["Proof of possession", "Required — registration alone is not enough"],
                  ["Scoped EVM window", "Read from QoreChain REST"],
                  ["Cancellation authorization", "Bound to chain, contract, stream, action, nonce, deadline"],
                ].map(([label, detail]) => (
                  <div key={label} className="flex items-start gap-3 text-sm">
                    <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div>
                      <p className="font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">{detail}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Link
                href="/security"
                className="inline-flex items-center gap-1.5 pt-2 text-sm font-medium text-primary hover:underline"
              >
                Open the security dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-1">
              {SECURITY_LAYERS.map((layer) => (
                <Card key={layer.title}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary/10 text-secondary ring-1 ring-secondary/20">
                        <layer.icon className="h-5 w-5" />
                      </span>
                      <Badge variant="outline">{layer.tag}</Badge>
                    </div>
                    <CardTitle className="pt-1">{layer.title}</CardTitle>
                    <CardDescription className="leading-relaxed">
                      {layer.body}
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section className="border-t border-border/60 bg-background/40">
        <div className="container py-20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">
                Who it is for
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">
                Anywhere money is earned over time
              </h2>
            </div>
            <p className="max-w-sm text-sm text-muted-foreground">
              The same primitive covers salaries, retainers, subscriptions,
              grants and vesting schedules.
            </p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {USE_CASES.map((useCase) => (
              <Card key={useCase.title}>
                <CardHeader>
                  <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <useCase.icon className="h-5 w-5" />
                  </span>
                  <CardTitle>{useCase.title}</CardTitle>
                  <CardDescription>{useCase.body}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-border/60">
        <div className="container grid gap-10 py-20 lg:grid-cols-[0.7fr_1.3fr]">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">
              FAQ
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">
              The questions that matter
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              No inflated claims. If a guarantee is not enforced on chain, it is
              not on this page.
            </p>
          </div>
          <div className="divide-y divide-border/70 rounded-xl border border-border/70 bg-card/40">
            {FAQ.map((item) => (
              <details key={item.q} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium">
                  {item.q}
                  <span className="text-muted-foreground transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border/60">
        <div className="container py-20">
          <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-secondary/10 p-8 sm:p-12">
            <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  Put money in motion.
                </h2>
                <p className="max-w-xl text-sm text-muted-foreground">
                  Connect an EIP-1193 wallet on {CHAIN.name}, fund a stream, and
                  watch it vest. The security page shows exactly what is
                  verified, what your wallet reports, and what is unknown.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/dashboard">
                  <Button size="lg">
                    Open dashboard
                    <ArrowRight />
                  </Button>
                </Link>
                <a
                  href={QORECHAIN_DOCS.workshop}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button size="lg" variant="outline">
                    <KeyRound />
                    PQC workshop
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
