import { cn } from "@/lib/utils";
import type { LiveQuoteState } from "@/hooks/use-live-quotes";

const inrFmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

/**
 * Compact live price block for use inside stock cards.
 * Replaces AI training-data prices with Yahoo Finance live (or last close) data.
 */
export function LivePriceBlock({
  state,
  align = "right",
}: {
  state: LiveQuoteState | undefined;
  align?: "right" | "left";
}) {
  if (!state || state.status === "loading") {
    return (
      <div
        className={cn(
          "flex items-center gap-1.5 text-[11px] text-muted-foreground",
          align === "right" ? "justify-end" : "justify-start",
        )}
      >
        <span className="h-3 w-3 rounded-full border-2 border-muted-foreground/30 border-t-foreground animate-spin" />
        Live…
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="text-[10px] text-muted-foreground">⚠ Data unavailable</div>
    );
  }

  const q = state.quote;
  const up = q.change > 0;
  const down = q.change < 0;
  const arrow = up ? "▲" : down ? "▼" : "—";
  const tone = up
    ? "text-emerald-600 dark:text-emerald-400"
    : down
      ? "text-red-600 dark:text-red-400"
      : "text-muted-foreground";

  return (
    <div className={cn(align === "right" ? "text-right" : "text-left")}>
      <div className="text-lg font-semibold">₹{inrFmt.format(q.price)}</div>
      <div className={cn("text-[11px] flex items-center gap-1", tone, align === "right" ? "justify-end" : "justify-start")}>
        <span>{arrow}</span>
        <span>
          {up ? "+" : ""}
          {inrFmt.format(q.change)} ({q.changePercent.toFixed(2)}%)
        </span>
      </div>
    </div>
  );
}
