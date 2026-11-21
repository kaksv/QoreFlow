"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ArrowRight, Loader2, PlusCircle, TriangleAlert } from "lucide-react";
import { parseEther } from "ethers";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldError, Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ConnectPrompt } from "@/components/wallet/connect-prompt";
import { WrongNetworkBanner } from "@/components/wallet/wrong-network-banner";
import { useWallet } from "@/hooks/useWallet";
import { describeTxError } from "@/lib/blockchain/errors";
import { getWriteContract } from "@/lib/contracts/qoreflow";
import { explorerTx, isContractConfigured } from "@/lib/config";
import {
  formatDateTime,
  formatQor,
  formatRate,
  isAddress,
} from "@/lib/utils";

const MAX_DURATION = 315_360_000;

const schema = z
  .object({
    recipient: z
      .string()
      .trim()
      .refine((value) => isAddress(value), "Enter a valid 0x… address."),
    amount: z
      .string()
      .trim()
      .refine(
        (value) => /^\d+(\.\d{1,18})?$/.test(value),
        "Enter a positive QOR amount (max 18 decimals).",
      )
      .refine((value) => {
        try {
          return parseEther(value) > 0n;
        } catch {
          return false;
        }
      }, "The deposit must be greater than zero."),
    days: z.coerce.number().int().min(0).max(3650),
    hours: z.coerce.number().int().min(0).max(23),
    minutes: z.coerce.number().int().min(0).max(59),
  })
  .refine(
    (values) => values.days * 86_400 + values.hours * 3_600 + values.minutes * 60 > 0,
    { message: "A stream needs a duration above zero.", path: ["days"] },
  )
  .refine(
    (values) =>
      values.days * 86_400 + values.hours * 3_600 + values.minutes * 60 <=
      MAX_DURATION,
    { message: "The maximum duration is 10 years.", path: ["days"] },
  );

type FormValues = z.infer<typeof schema>;

const PRESETS = [
  { label: "7 days", days: 7, hours: 0, minutes: 0 },
  { label: "30 days", days: 30, hours: 0, minutes: 0 },
  { label: "90 days", days: 90, hours: 0, minutes: 0 },
  { label: "1 year", days: 365, hours: 0, minutes: 0 },
];

export default function CreateStreamPage() {
  const { status, address, balance, isQoreChain, getSigner } = useWallet();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      recipient: "",
      amount: "",
      days: 30,
      hours: 0,
      minutes: 0,
    },
    mode: "onBlur",
  });

  const values = form.watch();
  const duration = useMemo(
    () =>
      Math.max(
        0,
        (Number(values.days) || 0) * 86_400 +
          (Number(values.hours) || 0) * 3_600 +
          (Number(values.minutes) || 0) * 60,
      ),
    [values.days, values.hours, values.minutes],
  );

  const preview = useMemo(() => {
    try {
      if (!values.amount) return null;
      const deposit = parseEther(values.amount);
      if (deposit <= 0n || duration <= 0) return null;
      const end =
        Math.floor(Date.now() / 1000) + duration;
      return {
        deposit,
        rate: formatRate(deposit, BigInt(duration)),
        end,
        durationLabel: `${duration.toLocaleString()} seconds`,
      };
    } catch {
      return null;
    }
  }, [values.amount, duration]);

  if (status === "uninitialized") {
    return (
      <div className="container py-16 text-sm text-muted-foreground">
        Looking for an injected wallet…
      </div>
    );
  }

  if (!address) {
    return (
      <div className="container space-y-8 py-12">
        <PageHeader
          eyebrow="Create"
          title="Fund a stream"
          description="Deposit QOR once, choose who receives it and how long it should vest. The whole deposit is locked when the stream is created."
        />
        <ConnectPrompt what="create a stream" />
      </div>
    );
  }

  async function onSubmit(formValues: FormValues) {
    setFormError(null);
    if (!isQoreChain) {
      setFormError("Switch your wallet to QoreChain Diana before creating a stream.");
      return;
    }
    if (!isContractConfigured()) {
      setFormError("QoreFlow is not configured for this deployment.");
      return;
    }

    const deposit = parseEther(formValues.amount);
    if (balance !== null && deposit > balance) {
      setFormError(
        `Deposit is ${formatQor(deposit)} QOR but the wallet holds ${formatQor(balance)} QOR.`,
      );
      return;
    }

    const seconds =
      formValues.days * 86_400 +
      formValues.hours * 3_600 +
      formValues.minutes * 60;

    setPending(true);
    const toastId = toast.loading("Creating the stream on QoreChain…");
    try {
      const signer = await getSigner();
      const contract = getWriteContract(signer);
      const tx = await contract.createStream(formValues.recipient.trim(), seconds, {
        value: deposit,
      });
      const receipt = await tx.wait();

      let streamId: bigint | null = null;
      for (const log of receipt!.logs) {
        try {
          const parsed = contract.interface.parseLog(log);
          if (parsed?.name === "StreamCreated") {
            streamId = parsed.args.streamId as bigint;
            break;
          }
        } catch {
          // Logs from other contracts are expected; ignore them.
        }
      }

      toast.success("Stream created", {
        id: toastId,
        description: `${formatQor(deposit)} QOR is now vesting.`,
        action: {
          label: "View",
          onClick: () => window.open(explorerTx(receipt!.hash), "_blank"),
        },
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["streams"] }),
        queryClient.invalidateQueries({ queryKey: ["activity"] }),
      ]);

      router.push(streamId !== null ? `/streams/${streamId.toString()}` : "/dashboard");
    } catch (error) {
      const message = describeTxError(error);
      setFormError(message);
      toast.error("Could not create the stream", { id: toastId, description: message });
    } finally {
      setPending(false);
    }
  }

  const errors = form.formState.errors;

  return (
    <div className="container max-w-5xl space-y-8 py-10">
      <PageHeader
        eyebrow="Create"
        title="Fund a stream"
        description="One deposit, linear vesting. The recipient can withdraw every second that has vested; the rest stays locked until it does."
      />

      <WrongNetworkBanner />

      {!isContractConfigured() && (
        <Alert variant="warning">
          <TriangleAlert />
          <AlertTitle>Contract not configured</AlertTitle>
          <AlertDescription>
            Set NEXT_PUBLIC_CONTRACT_ADDRESS after deploying QoreFlow. Until
            then, creation is disabled.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <CardHeader>
            <CardTitle>Stream details</CardTitle>
            <CardDescription>
              The recipient is fixed at creation. You can cancel later, but only
              with a post-quantum authorization — and every vested second still
              belongs to the recipient.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-5"
              onSubmit={form.handleSubmit(onSubmit)}
              noValidate
            >
              <div className="space-y-1.5">
                <Label htmlFor="recipient">Recipient address</Label>
                <Input
                  id="recipient"
                  placeholder="0x…"
                  className="font-mono text-sm"
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={Boolean(errors.recipient)}
                  {...form.register("recipient")}
                />
                <FieldError>{errors.recipient?.message}</FieldError>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="amount">Deposit (QOR)</Label>
                <Input
                  id="amount"
                  inputMode="decimal"
                  placeholder="100.0"
                  aria-invalid={Boolean(errors.amount)}
                  {...form.register("amount")}
                />
                <FieldError>{errors.amount?.message}</FieldError>
                <p className="text-xs text-muted-foreground">
                  Wallet balance:{" "}
                  {balance === null ? "—" : `${formatQor(balance, 4)} QOR`}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Duration</Label>
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map((preset) => {
                    const active =
                      Number(values.days) === preset.days &&
                      Number(values.hours) === preset.hours &&
                      Number(values.minutes) === preset.minutes;
                    return (
                      <Button
                        key={preset.label}
                        type="button"
                        size="sm"
                        variant={active ? "default" : "outline"}
                        onClick={() => {
                          form.setValue("days", preset.days, {
                            shouldValidate: true,
                          });
                          form.setValue("hours", preset.hours);
                          form.setValue("minutes", preset.minutes);
                        }}
                      >
                        {preset.label}
                      </Button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-3 gap-3 pt-1">
                  <div className="space-y-1">
                    <Label htmlFor="days" className="text-xs text-muted-foreground">
                      Days
                    </Label>
                    <Input
                      id="days"
                      type="number"
                      min={0}
                      max={3650}
                      {...form.register("days")}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="hours" className="text-xs text-muted-foreground">
                      Hours
                    </Label>
                    <Input
                      id="hours"
                      type="number"
                      min={0}
                      max={23}
                      {...form.register("hours")}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label
                      htmlFor="minutes"
                      className="text-xs text-muted-foreground"
                    >
                      Minutes
                    </Label>
                    <Input
                      id="minutes"
                      type="number"
                      min={0}
                      max={59}
                      {...form.register("minutes")}
                    />
                  </div>
                </div>
                <FieldError>{errors.days?.message}</FieldError>
              </div>

              {formError && (
                <Alert variant="destructive">
                  <TriangleAlert />
                  <AlertTitle>Could not create the stream</AlertTitle>
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                size="lg"
                disabled={
                  pending || !isQoreChain || !isContractConfigured()
                }
                className="w-full"
              >
                {pending ? <Loader2 className="animate-spin" /> : <PlusCircle />}
                {pending ? "Creating stream…" : "Create stream"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Your wallet will ask you to confirm the deposit transaction.
              </p>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
              <CardDescription>
                The contract stores the deposit and timestamps. Accrual is
                computed on demand.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {preview ? (
                <>
                  <div className="flex items-center justify-between border-b border-border/60 pb-3">
                    <span className="text-muted-foreground">Deposit</span>
                    <span className="font-mono font-medium tabular">
                      {formatQor(preview.deposit)} QOR
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b border-border/60 pb-3">
                    <span className="text-muted-foreground">Rate</span>
                    <span className="font-mono tabular">{preview.rate}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-border/60 pb-3">
                    <span className="text-muted-foreground">Duration</span>
                    <span className="font-mono tabular">
                      {preview.durationLabel}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Ends around</span>
                    <span className="font-mono tabular">
                      {formatDateTime(preview.end)}
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground">
                  Enter an amount and duration to see the rate and end date.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <ArrowRight className="h-4 w-4 text-primary" />
                What happens next
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                The deposit leaves your wallet and is held by QoreFlow. Accrual
                starts at the block timestamp of creation.
              </p>
              <p>
                The recipient withdraws whenever they like. If you cancel, they
                still keep every vested wei.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
