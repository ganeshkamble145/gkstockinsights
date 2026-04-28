import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useMarketStatus } from "@/hooks/use-market-status";

export function MarketStatusBadge({ className }: { className?: string }) {
  const { status, label, istLabel } = useMarketStatus();
  // Avoid SSR hydration mismatch: server clock != browser clock for the
  // IST timestamp string. Render the timestamp only after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const dotTone =
    status === "open"
      ? "bg-emerald-500"
      : status === "preopen"
        ? "bg-amber-500"
        : "bg-red-500";
  const textTone =
    status === "open"
      ? "text-emerald-700 dark:text-emerald-400"
      : status === "preopen"
        ? "text-amber-700 dark:text-amber-400"
        : "text-red-700 dark:text-red-400";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[11px]",
        className,
      )}
      title={mounted ? istLabel : undefined}
      suppressHydrationWarning
    >
      <span className="relative flex h-2 w-2">
        {status === "open" && (
          <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-75", dotTone)} />
        )}
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", dotTone)} />
      </span>
      <span className={cn("font-medium", textTone)}>{label}</span>
      <span className="text-muted-foreground hidden sm:inline" suppressHydrationWarning>
        · {mounted ? istLabel : "—"}
      </span>
    </div>
  );
}

