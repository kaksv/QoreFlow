import { Badge } from "@/components/ui/badge";
import type { StreamStatus } from "@/lib/blockchain/streams";

const MAP: Record<
  StreamStatus,
  { label: string; variant: "success" | "outline" | "destructive" | "warning" }
> = {
  active: { label: "Active", variant: "success" },
  completed: { label: "Completed", variant: "outline" },
  cancelled: { label: "Cancelled", variant: "destructive" },
  scheduled: { label: "Scheduled", variant: "warning" },
};

export function StreamStatusBadge({ status }: { status: StreamStatus }) {
  const item = MAP[status];
  return <Badge variant={item.variant}>{item.label}</Badge>;
}
