"use client";

import { useState } from "react";
import { Check, Copy, LogOut, RefreshCw, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/useWallet";
import { CHAIN } from "@/lib/config";
import { copyToClipboard, formatQor, shortAddress } from "@/lib/utils";

export function ConnectButton() {
  const {
    status,
    address,
    balance,
    isQoreChain,
    providerAvailable,
    connect,
    disconnect,
    switchNetwork,
  } = useWallet();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!address) return;
    try {
      await copyToClipboard(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  if (status === "uninitialized" || status === "connecting") {
    return (
      <Button variant="outline" disabled className="min-w-[9.5rem]">
        <RefreshCw className="animate-spin" />
        Connecting…
      </Button>
    );
  }

  if (status !== "connected" || !address) {
    return (
      <Button onClick={() => void connect()} className="min-w-[9.5rem]">
        <Wallet />
        {providerAvailable ? "Connect wallet" : "Install a wallet"}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {!isQoreChain && (
        <Button
          variant="outline"
          onClick={() => void switchNetwork()}
          className="border-[hsl(var(--warning)/0.5)] text-[hsl(var(--warning))]"
        >
          Switch to {CHAIN.shortName}
        </Button>
      )}
      <details className="relative">
        <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-lg border border-border bg-card/70 px-3 text-sm hover:bg-muted">
          <span className="relative flex h-2 w-2">
            <span
              className={`absolute inline-flex h-full w-full rounded-full ${
                isQoreChain ? "bg-primary" : "bg-[hsl(var(--warning))]"
              }`}
            />
          </span>
          <span className="font-mono text-xs">{shortAddress(address)}</span>
          {balance !== null && (
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {formatQor(balance, 3)} QOR
            </span>
          )}
        </summary>
        <div className="absolute right-0 z-50 mt-2 w-72 rounded-xl border border-border bg-card p-3 shadow-xl">
          <div className="space-y-1 border-b border-border pb-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Connected account
            </p>
            <p className="break-all font-mono text-xs">{address}</p>
            <p className="text-xs text-muted-foreground">
              {isQoreChain
                ? `${CHAIN.name} · chain ${CHAIN.id}`
                : `Wrong network — expected ${CHAIN.name}`}
            </p>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="justify-start"
              onClick={() => void copy()}
            >
              {copied ? <Check /> : <Copy />}
              {copied ? "Copied" : "Copy address"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="justify-start text-destructive hover:text-destructive"
              onClick={() => void disconnect()}
            >
              <LogOut />
              Disconnect
            </Button>
          </div>
        </div>
      </details>
    </div>
  );
}
