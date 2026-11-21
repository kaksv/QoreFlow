import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  suffix,
  hint,
  icon,
  tone = "default",
}: {
  label: string;
  value: string;
  suffix?: string;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: "default" | "positive" | "muted";
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          {icon && <span className="text-muted-foreground">{icon}</span>}
        </div>
        <p
          className={cn(
            "mt-2 font-mono text-2xl font-semibold tracking-tight tabular",
            tone === "positive" && "text-primary",
            tone === "muted" && "text-muted-foreground",
          )}
        >
          {value}
          {suffix && (
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              {suffix}
            </span>
          )}
        </p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
