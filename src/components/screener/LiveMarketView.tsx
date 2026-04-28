import { cn } from "@/lib/utils";
import { useLiveQuotes, type LiveQuoteState } from "@/hooks/use-live-quotes";

interface LiveMarketViewProps {
  symbols: string[];
  refreshMs?: number;
}

const inrFmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });
const compactFmt = new Intl.NumberFormat("en-IN", {
  notation: "compact",
  maximumFractionDigits: 2,
});

export function LiveMarketView({ symbols, refreshMs = 30_000 }: LiveMarketViewProps) {
  const { quotes, lastUpdated, refreshing, refresh, secondsToNext, marketStatus, isPolling } =
    useLiveQuotes(symbols, refreshMs);

  const cadenceLabel =
    marketStatus === "open"
      ? "every 60s"
      : marketStatus === "preopen"
        ? "every 2 min"
        : "paused (market closed)";

  return (
    <div>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <h2 className="text-sm font-semibold">Live Market — Yahoo Finance</h2>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
          {refreshing && (
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full border-2 border-muted-foreground/30 border-t-foreground animate-spin" />
              Refreshing
            </span>
          )}
          {isPolling && secondsToNext != null && !refreshing && (
            <span>Refreshing in: {secondsToNext}s</span>
          )}
          <span suppressHydrationWarning>
            {lastUpdated
              ? `Last updated ${lastUpdated.toLocaleTimeString("en-IN")}`
              : "Loading…"}
          </span>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="px-2 py-1 rounded-full border border-border hover:border-foreground/40 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={refreshing ? "animate-spin" : ""}
            >
              <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
            Refresh Now
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {symbols.map((s) => (
          <LiveCard key={s} state={quotes[s] ?? { status: "loading" }} symbol={s} />
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground mt-4">
        Data source: Yahoo Finance (query1.finance.yahoo.com). Auto-refreshes {cadenceLabel}.
        Pauses while the tab is hidden. Prices may be delayed 15 minutes. NSE only (.NS suffix).
      </p>
    </div>
  );
}


function LiveCard({ state, symbol }: { state: LiveQuoteState; symbol: string }) {
  if (state.status === "loading") {
    return (
      <div className="rounded-xl border border-border bg-card p-4 h-32 flex items-center justify-center">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/30 border-t-foreground animate-spin" />
          Loading {symbol}…
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">{symbol}</div>
          <div className="text-[10px] text-muted-foreground">NSE</div>
        </div>
        <div className="mt-3 text-xs text-muted-foreground">⚠ {state.message}</div>
      </div>
    );
  }

  const q = state.quote;
  const up = q.change > 0;
  const down = q.change < 0;
  const arrow = up ? "▲" : down ? "▼" : "—";
  const toneClass = up
    ? "text-emerald-600 dark:text-emerald-400"
    : down
      ? "text-red-600 dark:text-red-400"
      : "text-muted-foreground";

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">{q.symbol}</div>
          {q.name && (
            <div className="text-[10px] text-muted-foreground truncate">{q.name}</div>
          )}
        </div>
        <div className={cn("text-xs font-medium flex items-center gap-1", toneClass)}>
          <span>{arrow}</span>
          <span>{q.changePercent.toFixed(2)}%</span>
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <div className="text-xl font-semibold">₹{inrFmt.format(q.price)}</div>
        <div className={cn("text-xs", toneClass)}>
          {up ? "+" : ""}
          {inrFmt.format(q.change)}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3 text-center">
        <Mini label="High" value={`₹${inrFmt.format(q.dayHigh)}`} />
        <Mini label="Low" value={`₹${inrFmt.format(q.dayLow)}`} />
        <Mini label="Volume" value={compactFmt.format(q.volume)} />
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary py-1.5 px-1">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-[11px] font-medium mt-0.5 truncate">{value}</div>
    </div>
  );
}
