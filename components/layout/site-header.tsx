"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { ConnectButton } from "@/components/wallet/connect-button";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/streams/create", label: "Create" },
  { href: "/security", label: "Security" },
];

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="QoreFlow home">
      <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/25 to-secondary/20 ring-1 ring-primary/30">
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M4 8.5c4.5 0 6.5-3 11-3M4 15c4.5 0 6.5-3 11-3M9 21c4.5 0 6.5-3 11-3"
            stroke="hsl(160 84% 55%)"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span className="text-[15px] font-semibold tracking-tight">
        Qore<span className="text-primary">Flow</span>
      </span>
    </Link>
  );
}

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-lg">
      <div className="container flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {NAV.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <ConnectButton />
          <details className="relative md:hidden">
            <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-lg border border-border bg-card/70 hover:bg-muted">
              <Menu className="h-4 w-4" />
              <span className="sr-only">Open menu</span>
            </summary>
            <div className="absolute right-0 z-50 mt-2 w-48 rounded-xl border border-border bg-card p-1.5 shadow-xl">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
