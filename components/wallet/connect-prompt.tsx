"use client";

import { ExternalLink, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useWallet } from "@/hooks/useWallet";
import { CHAIN } from "@/lib/config";
import { ConnectButton } from "@/components/wallet/connect-button";

export function ConnectPrompt({ what }: { what: string }) {
  const { providerAvailable } = useWallet();

  return (
    <Alert variant="info" className="p-5">
      <Wallet />
      <AlertTitle>Connect a wallet to {what}</AlertTitle>
      <AlertDescription className="space-y-4">
        <p>
          QoreFlow talks to your wallet directly through EIP-1193. It never asks
          for a recovery phrase and never sends keys to a backend.
        </p>
        {!providerAvailable && (
          <p className="rounded-lg border border-border/70 bg-background/40 p-3 text-xs">
            No injected wallet detected. Install{" "}
            <a
              className="text-primary underline"
              href="https://qorechain.io/qorex"
              target="_blank"
              rel="noreferrer"
            >
              QoreX
            </a>{" "}
            or MetaMask, then add {CHAIN.name} (chain ID {CHAIN.id}, RPC{" "}
            {CHAIN.rpcUrl}).
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <ConnectButton />
          <a href={CHAIN.faucetUrl} target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm">
              Get test QOR
              <ExternalLink />
            </Button>
          </a>
        </div>
        <p className="text-xs">
          Use an account created with the coin-type-60 Ethereum key and register
          an ML-DSA-87 key before cancelling streams.
        </p>
      </AlertDescription>
    </Alert>
  );
}
