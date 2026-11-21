"use client";

import { Check, Copy, ExternalLink, RefreshCw, Wallet } from "lucide-react";
import { useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { CHAIN, explorerAddress } from "@/lib/config";
import { copyToClipboard, formatQor, shortAddress } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PqcStatusBadge } from "@/components/security/pqc-status-badge";

export function WalletSummary() {
  const { address, balance, chainId, isQoreChain, refreshBalance } = useWallet();
  const [copied, setCopied] = useState(false);

  if (!address) return null;

  const copy = async () => {
    try {
      await copyToClipboard(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <Wallet className="h-5 w-5" />
          </span>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-mono text-sm">{shortAddress(address, 6)}</p>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => void copy()}
                aria-label="Copy address"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
              <a
                href={explorerAddress(address)}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-primary"
                aria-label="View on explorer"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={isQoreChain ? "success" : "warning"}>
                {isQoreChain ? CHAIN.name : `Chain ${chainId ?? "?"}`}
              </Badge>
              <PqcStatusBadge address={address} />
            </div>
          </div>
        </div>
        <div className="flex items-end justify-between gap-4 sm:flex-col sm:items-end">
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Balance
            </p>
            <p className="font-mono text-xl font-semibold tabular">
              {balance === null ? "—" : formatQor(balance, 4)}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                QOR
              </span>
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => void refreshBalance()}
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
