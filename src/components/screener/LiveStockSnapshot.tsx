import { cn } from "@/lib/utils";
import { useLiveQuote } from "@/hooks/use-live-quotes";
import { useMarketStatus, formatIst } from "@/hooks/use-market-status";

const inrFmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });
const compactFmt = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 2 });

function nseUrl(symbol: string) {
  return `https://www.nseindia.com/get-quotes/equity?symbol=${encodeURIComponent(symbol)}`;
}

/**
 * Live market snapshot panel — replaces all AI-generated price data on the
 * Single Stock report. Pulls everything from Yahoo Finance.
 */
export function LiveStockSnapshot({ symbol }: { symbol: string }) {
  const cleaned = symbol.replace(/^NSE:/i, "").replace(/^BSE:/i, "").replace(/\.(NS|BO)$/i, "").trim().toUpperCase();
  const { state, lastUpdated, refreshing, refresh, secondsToNext, isPolling } = useLiveQuote(cleaned);
  const market = useMarketStatus();

  const isLive = market.status === "open";
  const badgeTone = isLive
    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
    : market.status === "preopen"
      ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
      : "bg-muted text-muted-foreground border-border";

  const badgeLabel = isLive
    ? "LIVE"
    : market.status === "preopen"
      ? "PRE-OPEN"
      : "CLOSED — LTP";

  if (!state || state.status === "loading") {
    return (
      <div className="rounded-xl border border-border bg-card p-5 mb-3 animate-pulse">
        <div className="h-3 w-24 bg-muted rounded mb-3" />
        <div className="h-8 w-40 bg-muted rounded mb-2" />
        <div className="h-3 w-72 bg-muted rounded" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="rounded-xl border border-r-border bg-r-fill p-5 mb-3">
        <div className="text-sm font-medium text-r-text">Live data unavailable</div>
        <p className="text-xs text-r-text mt-1">
          We couldn't fetch real-time market data right now.{" "}
          <a
            href={nseUrl(cleaned)}
            target="_blank"
            rel="noreferrer"
            className="underline hover:no-underline"
          >
            Verify {cleaned} on NSE ↗
          </a>
        </p>
      </div>
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
    <div className="rounded-xl border border-border bg-card p-5 mb-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wider", badgeTone)}>
              {isLive && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                </span>
              )}
              {badgeLabel}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {q.exchange ?? "NSE"} · {cleaned}
            </span>
          </div>

          <div className="flex items-baseline gap-3 flex-wrap">
            <div className="text-3xl sm:text-4xl font-semibold tracking-tight">
              ₹{inrFmt.format(q.price)}
            </div>
            <div className={cn("flex items-center gap-1 text-sm font-medium", tone)}>
              <span>{arrow}</span>
              <span>
                {up ? "+" : ""}
                {inrFmt.format(q.change)} ({q.changePercent.toFixed(2)}%)
              </span>
            </div>
            <button
              onClick={refresh}
              disabled={refreshing}
              className="ml-1 rounded-full border border-border p-1.5 hover:border-foreground/40 transition-colors disabled:opacity-50"
              title="Refresh live data"
              aria-label="Refresh"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
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
            </button>
          </div>

          <div className="text-[11px] text-muted-foreground mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span suppressHydrationWarning>Last updated {formatIst(lastUpdated)}</span>
            {isPolling && secondsToNext != null && !refreshing && (
              <span>· Refreshing in: {secondsToNext}s</span>
            )}
            {!isPolling && !refreshing && <span>· Auto-refresh paused (market closed)</span>}
            <span>·{" "}
              <a
                href={nseUrl(cleaned)}
                target="_blank"
                rel="noreferrer"
                className="underline hover:no-underline"
              >
                Verify on NSE ↗
              </a>
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mt-5">
        <Mini label="Day High" value={`₹${inrFmt.format(q.dayHigh)}`} />
        <Mini label="Day Low" value={`₹${inrFmt.format(q.dayLow)}`} />
        <Mini label="52W High" value={q.fiftyTwoWeekHigh ? `₹${inrFmt.format(q.fiftyTwoWeekHigh)}` : "—"} />
        <Mini label="52W Low" value={q.fiftyTwoWeekLow ? `₹${inrFmt.format(q.fiftyTwoWeekLow)}` : "—"} />
        <Mini label="Volume" value={compactFmt.format(q.volume)} />
        <Mini label="Avg Vol (3M)" value={q.avgVolume3M ? compactFmt.format(q.avgVolume3M) : "—"} />
        <Mini label="Mkt Cap" value={q.marketCap ? `₹${compactFmt.format(q.marketCap)}` : "—"} />
      </div>

      <p className="text-[10px] text-muted-foreground mt-4 leading-relaxed">
        Prices fetched live from NSE/BSE via Yahoo Finance. During market hours (9:15 AM–3:30 PM IST),
        shows live CMP. Outside market hours, shows last traded price (LTP).
      </p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary py-2 px-2">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-xs font-medium mt-0.5 truncate">{value}</div>
    </div>
  );
}
