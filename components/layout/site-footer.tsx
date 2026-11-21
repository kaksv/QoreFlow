import Link from "next/link";
import { CHAIN, QORECHAIN_DOCS } from "@/lib/config";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/70 bg-background/60">
      <div className="container grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-3">
          <p className="text-sm font-semibold">
            Qore<span className="text-primary">Flow</span>
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Continuous QOR payment streams with post-quantum authorized
            cancellation, built on {CHAIN.name}.
          </p>
          <p className="text-xs text-muted-foreground/80">
            Testnet software. No real funds. Not audited for mainnet use.
          </p>
        </div>
        <div className="space-y-2 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Product
          </p>
          <Link href="/dashboard" className="block text-muted-foreground hover:text-foreground">
            Dashboard
          </Link>
          <Link href="/streams/create" className="block text-muted-foreground hover:text-foreground">
            Create a stream
          </Link>
          <Link href="/security" className="block text-muted-foreground hover:text-foreground">
            Security status
          </Link>
        </div>
        <div className="space-y-2 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Resources
          </p>
          <a
            href={QORECHAIN_DOCS.integration}
            target="_blank"
            rel="noreferrer"
            className="block text-muted-foreground hover:text-foreground"
          >
            QoreChain docs
          </a>
          <a
            href={CHAIN.faucetUrl}
            target="_blank"
            rel="noreferrer"
            className="block text-muted-foreground hover:text-foreground"
          >
            Testnet faucet
          </a>
          <a
            href={CHAIN.explorerUrl}
            target="_blank"
            rel="noreferrer"
            className="block text-muted-foreground hover:text-foreground"
          >
            Explorer
          </a>
        </div>
      </div>
      <div className="border-t border-border/60">
        <div className="container flex flex-col gap-2 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} QoreFlow. MIT licensed.</p>
          <p>
            EVM transactions use secp256k1; post-quantum authorization is
            verified separately on chain.
          </p>
        </div>
      </div>
    </footer>
  );
}
