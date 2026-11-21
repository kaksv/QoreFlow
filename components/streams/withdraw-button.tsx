"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Droplets, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useNow } from "@/hooks/useNow";
import { useWallet } from "@/hooks/useWallet";
import { getWriteContract } from "@/lib/contracts/qoreflow";
import { describeTxError } from "@/lib/blockchain/errors";
import { computeAccrued, type Stream } from "@/lib/blockchain/streams";
import { explorerTx, isContractConfigured } from "@/lib/config";
import { formatQor } from "@/lib/utils";

export function WithdrawButton({
  stream,
  className,
}: {
  stream: Stream;
  className?: string;
}) {
  const { address, isQoreChain, getSigner } = useWallet();
  const queryClient = useQueryClient();
  const now = useNow();
  const [pending, setPending] = useState(false);

  const accrued = computeAccrued(stream, now);
  const withdrawable = accrued > stream.withdrawn ? accrued - stream.withdrawn : 0n;

  const isRecipient =
    address !== null &&
    address.toLowerCase() === stream.recipient.toLowerCase();

  const disabled =
    !isRecipient ||
    !isQoreChain ||
    !isContractConfigured() ||
    withdrawable === 0n ||
    pending;

  async function withdraw() {
    if (!isRecipient || withdrawable === 0n) return;
    setPending(true);
    try {
      const signer = await getSigner();
      const contract = getWriteContract(signer);
      const tx = await contract.withdraw(stream.id);
      const toastId = toast.loading("Withdrawing vested QOR…");
      const receipt = await tx.wait();
      toast.success(`Withdrew ${formatQor(withdrawable)} QOR`, {
        id: toastId,
        description: "Settled on QoreChain.",
        action: {
          label: "View",
          onClick: () => window.open(explorerTx(receipt!.hash), "_blank"),
        },
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["stream"] }),
        queryClient.invalidateQueries({ queryKey: ["streams"] }),
        queryClient.invalidateQueries({ queryKey: ["activity"] }),
      ]);
    } catch (error) {
      toast.error("Withdrawal failed", {
        description: describeTxError(error),
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      onClick={() => void withdraw()}
      disabled={disabled}
      className={className}
    >
      {pending ? <Loader2 className="animate-spin" /> : <Droplets />}
      {pending
        ? "Withdrawing…"
        : withdrawable > 0n
          ? `Withdraw ${formatQor(withdrawable)} QOR`
          : "Nothing to withdraw"}
    </Button>
  );
}
