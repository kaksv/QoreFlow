"use client";

import { ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { usePqcKeyStatus } from "@/hooks/usePqc";
import { PQC } from "@/lib/config";

export function PqcStatusBadge({ address }: { address: string | null }) {
  const query = usePqcKeyStatus(address);

  if (!address) {
    return <Badge variant="outline">No account</Badge>;
  }
  if (query.isLoading) {
    return <Badge variant="outline">Checking key…</Badge>;
  }
  if (query.isError || !query.data) {
    return (
      <Badge variant="warning" className="gap-1">
        <ShieldQuestion className="h-3 w-3" />
        Unknown
      </Badge>
    );
  }

  const status = query.data;
  if (!status.registered) {
    return (
      <Badge variant="outline" className="gap-1">
        <ShieldAlert className="h-3 w-3" />
        No PQC key
      </Badge>
    );
  }
  if (status.algorithmId !== PQC.algorithmId) {
    return (
      <Badge variant="destructive" className="gap-1">
        <ShieldAlert className="h-3 w-3" />
        Unsupported algorithm
      </Badge>
    );
  }
  if (!status.possessionProven) {
    return (
      <Badge variant="warning" className="gap-1">
        <ShieldAlert className="h-3 w-3" />
        No proof of possession
      </Badge>
    );
  }
  return (
    <Badge variant="success" className="gap-1">
      <ShieldCheck className="h-3 w-3" />
      ML-DSA-87 · proven
    </Badge>
  );
}
