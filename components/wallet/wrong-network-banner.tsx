"use client";

import { AlertTriangle } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { CHAIN } from "@/lib/config";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function WrongNetworkBanner() {
  const { status, isQoreChain, switchNetwork } = useWallet();
  if (status !== "connected" || isQoreChain) return null;

  return (
    <Alert variant="warning">
      <AlertTriangle />
      <AlertTitle>Wrong network</AlertTitle>
      <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span>
          Your wallet is not on {CHAIN.name} (chain ID {CHAIN.id}). Reads use the
          public RPC, but transactions will fail until you switch.
        </span>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 border-[hsl(var(--warning)/0.5)] text-[hsl(var(--warning))]"
          onClick={() => void switchNetwork()}
        >
          Switch network
        </Button>
      </AlertDescription>
    </Alert>
  );
}
