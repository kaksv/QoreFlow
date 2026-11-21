"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEvmWindow, usePqcKeyStatus } from "@/hooks/usePqc";
import { useWallet } from "@/hooks/useWallet";
import { describeTxError } from "@/lib/blockchain/errors";
import { computeAccrued, type Stream } from "@/lib/blockchain/streams";
import {
  CONTRACT_ADDRESS,
  explorerTx,
  isContractConfigured,
  PQC,
} from "@/lib/config";
import { getReadProvider } from "@/lib/blockchain/provider";
import { getReadContract, getWriteContract } from "@/lib/contracts/qoreflow";
import {
  importSecretKey,
  publicKeyFingerprint,
  signAuthorization,
  verifyAuthorizationLocally,
} from "@/lib/pqc/signer";
import { cn, formatDateTime, formatQor } from "@/lib/utils";

interface PreparedAuthorization {
  hash: string;
  signature: string;
  deadline: bigint;
  nonce: bigint;
}

function ChecklistItem({
  ok,
  pending,
  children,
}: {
  ok: boolean;
  pending?: boolean;
  children: React.ReactNode;
}) {
  const Icon = pending ? Loader2 : ok ? CheckCircle2 : XCircle;
  return (
    <li className="flex items-start gap-2 text-sm">
      <Icon
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          pending
            ? "animate-spin text-muted-foreground"
            : ok
              ? "text-primary"
              : "text-destructive",
        )}
      />
      <span className={ok ? "text-foreground" : "text-muted-foreground"}>
        {children}
      </span>
    </li>
  );
}

export function CancelStreamPanel({ stream }: { stream: Stream }) {
  const { address, isQoreChain, getSigner } = useWallet();
  const queryClient = useQueryClient();
  const keyStatus = usePqcKeyStatus(address);
  const windowQuery = useEvmWindow(address);

  const [secretKeyHex, setSecretKeyHex] = useState("");
  const [deadlineMinutes, setDeadlineMinutes] = useState(30);
  const [prepared, setPrepared] = useState<PreparedAuthorization | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nowSeconds = Math.floor(Date.now() / 1000);
  const isSender =
    address !== null && address.toLowerCase() === stream.sender.toLowerCase();
  const isActive =
    !stream.cancelled && BigInt(nowSeconds) < stream.endTime;
  const liveAccrued = computeAccrued(stream, nowSeconds);

  const registeredPubkey = keyStatus.data?.pubkey ?? "";
  const pqcReady =
    keyStatus.data !== undefined &&
    keyStatus.data.registered &&
    keyStatus.data.algorithmId === PQC.algorithmId &&
    keyStatus.data.possessionProven &&
    keyStatus.data.pubkey.length === PQC.pubkeyLength * 2 + 2;

  const windowVerdict = useMemo(() => {
    if (windowQuery.isLoading) {
      return { state: "pending" as const, reason: "Reading the EVM window…" };
    }
    if (windowQuery.isError || !windowQuery.data) {
      return {
        state: "unknown" as const,
        reason:
          "The EVM window could not be read. The chain may still refuse the transaction.",
      };
    }
    const window = windowQuery.data;
    if (!window.found) {
      return {
        state: "blocked" as const,
        reason:
          "No EVM authorization window is open for this account. Open one with qorechaind tx pqc open-evm-window.",
      };
    }
    const expiredOrExhausted =
      window.live === false ||
      (window.remainingBlocks !== undefined && window.remainingBlocks <= 0) ||
      (window.expiryHeight !== undefined &&
        window.currentBlock !== undefined &&
        window.currentBlock >= window.expiryHeight);
    if (expiredOrExhausted) {
      return {
        state: "blocked" as const,
        reason:
          "The window is no longer live — it expired, ran out of blocks, or was fully used. Open a new window scoped to QoreFlow.",
      };
    }
    if (!window.confident) {
      return {
        state: "unknown" as const,
        reason:
          "A window payload was returned, but it did not contain fields this UI recognises. The chain may still admit or refuse the call.",
      };
    }
    if (window.nativeOnly) {
      return {
        state: "blocked" as const,
        reason:
          "The open window is native-only, so contract calls are refused. Open a window scoped to QoreFlow instead.",
      };
    }
    if (
      window.allowedTargets &&
      window.allowedTargets.length > 0 &&
      !window.allowedTargets.some(
        (target) => target.toLowerCase() === CONTRACT_ADDRESS.toLowerCase(),
      )
    ) {
      return {
        state: "blocked" as const,
        reason:
          "The open window does not allow QoreFlow as a target. Open a window with --allowed-targets set to the contract.",
      };
    }
    if (window.remainingTxs !== undefined && window.remainingTxs <= 0) {
      return {
        state: "blocked" as const,
        reason:
          "The open window has no transactions left. Open a new window before cancelling.",
      };
    }
    if (
      window.remainingValueUqor !== undefined &&
      Number(window.remainingValueUqor) <= 0
    ) {
      return {
        state: "blocked" as const,
        reason:
          "The open window has no value budget left. Cancelling pays a fee, so open a new window first.",
      };
    }
    return {
      state: "ok" as const,
      reason:
        window.remainingTxs !== undefined
          ? `${window.remainingTxs} EVM transaction(s) left${
              window.remainingBlocks !== undefined
                ? `, ${window.remainingBlocks} block(s) until expiry`
                : ""
            }.`
          : "A window appears to be open. Remaining bounds are not reported by the node.",
    };
  }, [windowQuery.data, windowQuery.isError, windowQuery.isLoading]);

  const canPrepare =
    isSender &&
    isQoreChain &&
    isContractConfigured() &&
    isActive &&
    pqcReady &&
    windowVerdict.state !== "blocked" &&
    secretKeyHex.trim().length > 0 &&
    !preparing &&
    !prepared;

  const canSubmit =
    prepared !== null &&
    pqcReady &&
    windowVerdict.state !== "blocked" &&
    !submitting;

  async function prepareAuthorization() {
    if (!address) return;
    setError(null);
    setPreparing(true);
    try {
      if (!pqcReady) throw new Error("This account's post-quantum key is not ready.");
      const read = getReadContract(getReadProvider());
      if (!read) throw new Error("QoreFlow is not configured.");

      const [nonce, block] = await Promise.all([
        read.cancelNonce(address) as Promise<bigint>,
        getReadProvider().getBlock("latest"),
      ]);
      const chainNow = BigInt(
        block?.timestamp ?? Math.floor(Date.now() / 1000),
      );
      const deadline = chainNow + BigInt(Math.max(1, deadlineMinutes) * 60);

      const hash = (await read.cancelAuthorizationHash(
        address,
        stream.id,
        nonce,
        deadline,
      )) as string;

      const secretKey = importSecretKey(secretKeyHex);
      const signature = signAuthorization(secretKey, hash);

      // Never send a signature we have not checked against the key that
      // actually controls this account on chain.
      if (!verifyAuthorizationLocally(registeredPubkey, hash, signature)) {
        throw new Error(
          "The signature does not verify against this account's registered ML-DSA-87 key. Use the secret key that belongs to the registered public key.",
        );
      }

      setPrepared({ hash, signature, deadline, nonce });
      // The secret key is no longer needed: only the public signature is sent.
      setSecretKeyHex("");
      toast.success("Authorization signed locally", {
        description:
          "The secret key was cleared from memory. Review the details, then submit.",
      });
    } catch (err) {
      setError(describeTxError(err));
    } finally {
      setPreparing(false);
    }
  }

  async function submitCancellation() {
    if (!prepared || !registeredPubkey) return;
    setError(null);
    setSubmitting(true);
    try {
      const signer = await getSigner();
      const contract = getWriteContract(signer);
      const tx = await contract.cancelStream(
        stream.id,
        registeredPubkey,
        prepared.signature,
        prepared.deadline,
      );
      const toastId = toast.loading("Submitting cancellation to QoreChain…");
      const receipt = await tx.wait();
      toast.success("Stream cancelled", {
        id: toastId,
        description:
          "Accrual froze at the cancellation timestamp. The recipient keeps every vested second.",
        action: {
          label: "View",
          onClick: () => window.open(explorerTx(receipt!.hash), "_blank"),
        },
      });
      setPrepared(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["stream"] }),
        queryClient.invalidateQueries({ queryKey: ["streams"] }),
        queryClient.invalidateQueries({ queryKey: ["activity"] }),
        queryClient.invalidateQueries({ queryKey: ["pqc-key-status"] }),
        queryClient.invalidateQueries({ queryKey: ["evm-window"] }),
      ]);
    } catch (err) {
      setError(describeTxError(err));
      toast.error("Cancellation failed", {
        description: describeTxError(err),
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (!isSender) {
    return null;
  }

  return (
    <Card className="border-destructive/25">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <LockKeyhole className="h-4 w-4 text-destructive" />
            Cancel with a post-quantum authorization
          </CardTitle>
          <Badge variant="outline">Sender only</Badge>
        </div>
        <CardDescription className="leading-relaxed">
          Cancellation requires an ML-DSA-87 signature verified on chain by the{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">pqcVerify</code>{" "}
          precompile. The authorization is bound to this contract, chain, stream,
          action, your current nonce and a deadline. There is no classical-only
          fallback.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <ul className="grid gap-2 rounded-lg border border-border/70 bg-background/40 p-4 sm:grid-cols-2">
          <ChecklistItem ok={isQoreChain}>
            Wallet on QoreChain Diana (chain {9800})
          </ChecklistItem>
          <ChecklistItem ok={isContractConfigured()}>
            QoreFlow contract configured
          </ChecklistItem>
          <ChecklistItem ok={isActive}>
            Stream is active (not cancelled or completed)
          </ChecklistItem>
          <ChecklistItem
            ok={pqcReady}
            pending={keyStatus.isLoading}
          >
            Registered ML-DSA-87 key with proof of possession
          </ChecklistItem>
          <ChecklistItem
            ok={windowVerdict.state === "ok"}
            pending={windowVerdict.state === "pending"}
          >
            EVM authorization window admits this call
          </ChecklistItem>
          <ChecklistItem ok={prepared !== null}>
            Authorization signed and checked locally
          </ChecklistItem>
        </ul>

        {!pqcReady && !keyStatus.isLoading && (
          <Alert variant="warning">
            <AlertTriangle />
            <AlertTitle>Post-quantum key is not ready</AlertTitle>
            <AlertDescription>
              {keyStatus.isError
                ? "The key-status precompile could not be read. Cancellation stays disabled rather than falling back to a classical signature."
                : keyStatus.data && !keyStatus.data.registered
                  ? "No ML-DSA-87 key is registered to this account. Register one (with --pqc-key for proof of possession) before cancelling."
                  : keyStatus.data && !keyStatus.data.possessionProven
                    ? "The registered key has no proof of possession. Re-register it with --pqc-key; registration alone is not enough."
                    : "The registered key is not ML-DSA-87 (algorithm id 1)."}
            </AlertDescription>
          </Alert>
        )}

        <Alert
          variant={
            windowVerdict.state === "blocked"
              ? "destructive"
              : windowVerdict.state === "unknown"
                ? "warning"
                : "default"
          }
        >
          <ShieldCheck />
          <AlertTitle>
            {windowVerdict.state === "blocked"
              ? "EVM window blocks this call"
              : windowVerdict.state === "unknown"
                ? "EVM window status unknown"
                : "EVM window"}
          </AlertTitle>
          <AlertDescription>{windowVerdict.reason}</AlertDescription>
        </Alert>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>Could not complete the authorization</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {prepared === null ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="deadline">Authorization validity</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="deadline"
                  type="number"
                  min={1}
                  max={1440}
                  value={deadlineMinutes}
                  onChange={(event) =>
                    setDeadlineMinutes(Number(event.target.value) || 1)
                  }
                  className="w-28"
                />
                <span className="text-sm text-muted-foreground">
                  minutes from the latest chain block
                </span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pqc-secret">
                ML-DSA-87 secret key (session only)
              </Label>
              <Input
                id="pqc-secret"
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="0x… 4896-byte secret key"
                value={secretKeyHex}
                onChange={(event) => setSecretKeyHex(event.target.value)}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Kept in this tab&apos;s memory only, cleared immediately after
                signing. It is never stored, logged or sent to a server. The
                signature is checked against the key registered on chain before
                anything is submitted.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={() => void prepareAuthorization()}
                disabled={!canPrepare}
              >
                {preparing ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <KeyRound />
                )}
                {preparing ? "Signing locally…" : "Sign authorization"}
              </Button>
              <span className="text-xs text-muted-foreground">
                No transaction is sent until you review and confirm.
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-4 rounded-lg border border-primary/25 bg-primary/5 p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium">
                Authorization verified locally
              </p>
            </div>
            <dl className="grid gap-2 text-xs sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Stream</dt>
                <dd className="font-mono">#{stream.id.toString()}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Nonce</dt>
                <dd className="font-mono">{prepared.nonce.toString()}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Deadline</dt>
                <dd className="font-mono">
                  {formatDateTime(prepared.deadline)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Key fingerprint</dt>
                <dd className="font-mono">
                  {publicKeyFingerprint(registeredPubkey)}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Message hash</dt>
                <dd className="break-all font-mono">{prepared.hash}</dd>
              </div>
            </dl>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Cancelling now refunds{" "}
              <span className="font-medium text-foreground">
                {formatQor(stream.deposit - liveAccrued)} QOR
              </span>{" "}
              of unvested balance. The recipient keeps{" "}
              <span className="font-medium text-foreground">
                {formatQor(liveAccrued)} QOR
              </span>{" "}
              and can still withdraw it.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="destructive"
                onClick={() => void submitCancellation()}
                disabled={!canSubmit}
              >
                {submitting ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <LockKeyhole />
                )}
                {submitting ? "Submitting…" : "Submit cancellation"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setPrepared(null)}
                disabled={submitting}
              >
                Discard
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
