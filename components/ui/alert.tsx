import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:size-4 [&>svg~*]:pl-6",
  {
    variants: {
      variant: {
        default: "border-border bg-muted/40 text-foreground",
        info: "border-secondary/30 bg-secondary/10 text-foreground",
        success:
          "border-[hsl(var(--positive)/0.35)] bg-[hsl(var(--positive)/0.08)] text-foreground",
        warning:
          "border-[hsl(var(--warning)/0.35)] bg-[hsl(var(--warning)/0.08)] text-foreground",
        destructive:
          "border-destructive/40 bg-destructive/10 text-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

export function Alert({ className, variant, ...props }: AlertProps) {
  return (
    <div
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

export function AlertTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h5
      className={cn("mb-1 font-medium leading-none tracking-tight", className)}
      {...props}
    />
  );
}

export function AlertDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <div
      className={cn("text-sm text-muted-foreground [&_p]:leading-relaxed", className)}
      {...props}
    />
  );
}
