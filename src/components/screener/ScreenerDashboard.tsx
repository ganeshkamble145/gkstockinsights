import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { runScreener, type ScreenerResult, type ScreenerStock } from "@/lib/screener.functions";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/report/Badge";
import { LivePriceBlock } from "./LivePriceBlock";
import { MarketStatusBadge } from "./MarketStatusBadge";
import { useLiveQuotes, type LiveQuoteState } from "@/hooks/use-live-quotes";
import { formatIst } from "@/hooks/use-market-status";
import {
  computeEquityScore,
  parseNumeric,
  quoteOf,
  recommendationFor,
  type CompositeBreakdown,
} from "@/lib/scoring";
import { RankBadgeChip, ScorePill, RecommendationBadge } from "./RankedBadges";
import { PdfExportButton } from "./PdfExportButton";
import { exportCompactPdf, exportDetailedPdf } from "@/lib/pdf-export";
import { BudgetFilterBar, BudgetChip, isWithinBudget, calcEquityMinInvestment } from "./BudgetFilterBar";
import { useUserPrefs } from "@/hooks/use-user-prefs";
import { ErrorCard, MarketClosedBanner, PerformanceFooter, SkeletonCard, SkeletonTable, LoadProgress } from "./PerfUI";

/** Convert a ScreenerStock.ticker like "NSE:RELIANCE" or "RELIANCE" into a plain NSE ticker. */
function tickerToSymbol(ticker: string): string {
  return ticker.replace(/^NSE:/i, "").replace(/\.NS$/i, "").trim().toUpperCase();
}

type Kind = "penny" | "nifty100";
type ViewMode = "table" | "cards";

interface RankedRow {
  stock: ScreenerStock;
  symbol: string;
  score: CompositeBreakdown;
  liveState: LiveQuoteState | undefined;
}

const inrFmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

export function ScreenerDashboard({ kind, onBack }: { kind: Kind; onBack: () => void }) {
  const run = useServerFn(runScreener);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScreenerResult | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [activeSector, setActiveSector] = useState<string>("All");
  const [view, setView] = useState<ViewMode>("table");
  const [regenerating, setRegenerating] = useState(false);
  const { prefs } = useUserPrefs();
  const [budget, setBudget] = useState<number>(Infinity);

  const fetchPicks = async () => {
    setError(null);
    try {
      const res = await run({ data: { kind } });
      if (res.error) setError(res.error);
      else { setResult(res.result); setFromCache(res._fromCache ?? false); }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setResult(null);
      await fetchPicks();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const title =
    kind === "penny"
      ? "Penny Stocks — Top 20 Ranked Picks"
      : "NIFTY 100 — Top 20 Ranked Picks";
  const subtitle =
    kind === "penny"
      ? "Small & micro caps under ₹100 · ranked by composite live + fundamental score"
      : "Large-cap multibagger candidates · ranked by composite live + fundamental score";

  // Pull symbol list before filtering (so live data covers all picks)
  const allSymbols = useMemo(
    () => (result?.picks ?? []).map((p) => tickerToSymbol(p.ticker)).filter(Boolean),
    [result],
  );
  const { quotes: liveQuotes, lastUpdated, refreshing, refresh, retrySingle, marketStatus, stats } = useLiveQuotes(allSymbols);

  // Compute composite scores for every pick using live data + AI fundamentals.
  const ranked: RankedRow[] = useMemo(() => {
    if (!result) return [];
    
    // Deduplicate by symbol
    const seen = new Set<string>();
    const uniquePicks = result.picks.filter(stock => {
      const sym = tickerToSymbol(stock.ticker);
      if (seen.has(sym)) return false;
      seen.add(sym);
      return true;
    });

    return uniquePicks
      .map((stock) => {
        const symbol = tickerToSymbol(stock.ticker);
        const liveState = liveQuotes[symbol];
        const live = quoteOf(liveState);
        const pe = parseNumeric(stock.pe);
        const sectorPe = parseNumeric(stock.sectorMedianPe);
        const marketCapCr = parseNumeric(stock.marketCap);
        const analystTarget = parseNumeric(stock.analystTarget);
        const score = computeEquityScore(live, { pe, sectorPe, marketCapCr, analystTarget });
        return { stock, symbol, score, liveState };
      })
      .sort((a, b) => b.score.total - a.score.total);
  }, [result, liveQuotes]);

  // Sync budget from user prefs once loaded
  useEffect(() => {
    if (prefs?.max_investment) setBudget(prefs.max_investment);
  }, [prefs?.max_investment]);

  const sectors = useMemo(() => {
    if (!result) return ["All"];
    const set = new Set(result.picks.map((p) => p.sector));
    return ["All", ...Array.from(set)];
  }, [result]);

  const filtered = useMemo(() => {
    const bySector = activeSector === "All" ? ranked : ranked.filter((r) => r.stock.sector === activeSector);
    // Sort: within budget + highest score first, then over-budget + highest score
    const within = bySector.filter((r) => {
      const live = quoteOf(r.liveState);
      const minInv = live ? calcEquityMinInvestment(live.price) : null;
      return isWithinBudget(minInv?.amount ?? null, budget);
    });
    const over = bySector.filter((r) => {
      const live = quoteOf(r.liveState);
      const minInv = live ? calcEquityMinInvestment(live.price) : null;
      return !isWithinBudget(minInv?.amount ?? null, budget);
    });
    return [...within, ...over];
  }, [ranked, activeSector, budget]);

  const handleRegenerate = async () => {
    setRegenerating(true);
    await fetchPicks();
    setRegenerating(false);
  };

  const handleExport = (mode: "compact" | "detailed") => {
    const filename = `${kind}-top20-${new Date().toISOString().slice(0, 10)}.pdf`;
    if (mode === "compact") {
      exportCompactPdf({
        title,
        subtitle: `${subtitle} · Generated ${new Date().toLocaleString("en-IN")}`,
        filename,
        columns: [
          { header: "Rank", key: "badge" },
          { header: "Symbol", key: "symbol" },
          { header: "Sector", key: "sector" },
          { header: "Score", key: "score" },
          { header: "CMP", key: "cmp" },
          { header: "% Chg", key: "changePct" },
          { header: "P/E", key: "pe" },
          { header: "ROCE", key: "roce" },
          { header: "Mkt Cap", key: "mcap" },
          { header: "Recommendation", key: "recommendation" },
        ],
        rows: filtered.map((r) => {
          const live = quoteOf(r.liveState);
          return {
            rank: ranked.indexOf(r) + 1,
            badge: rankLabelPlain(ranked.indexOf(r) + 1),
            symbol: r.symbol,
            score: r.score.total,
            recommendation: recommendationFor(r.score.total).label,
            extra: {
              sector: r.stock.sector,
              cmp: live ? `₹${inrFmt.format(live.price)}` : "—",
              changePct: live ? `${live.changePercent >= 0 ? "+" : ""}${live.changePercent.toFixed(2)}%` : "—",
              pe: r.stock.pe,
              roce: r.stock.roce,
              mcap: r.stock.marketCap,
            },
          };
        }),
      });
    } else {
      exportDetailedPdf({
        title,
        subtitle: `${subtitle} · Generated ${new Date().toLocaleString("en-IN")}`,
        filename,
        stocks: filtered.map((r) => {
          const live = quoteOf(r.liveState);
          const rank = ranked.indexOf(r) + 1;
          return {
            rank,
            badge: rankLabelPlain(rank),
            symbol: `${r.symbol} — ${r.stock.company}`,
            sector: r.stock.sector,
            cmp: live ? `₹${inrFmt.format(live.price)}` : undefined,
            changePct: live ? `${live.changePercent >= 0 ? "+" : ""}${live.changePercent.toFixed(2)}%` : undefined,
            score: r.score.total,
            recommendation: recommendationFor(r.score.total).label,
            metrics: [
              { label: "P/E", value: r.stock.pe },
              { label: "ROCE", value: r.stock.roce },
              { label: "D/E", value: r.stock.de },
              { label: "Mkt Cap", value: r.stock.marketCap },
              { label: "Promoter", value: r.stock.promoterHolding },
              { label: "1Y Return", value: r.stock.return1y },
              { label: "RSI", value: live?.rsi14 ? live.rsi14.toFixed(1) : "—" },
              { label: "5d momentum", value: live?.momentum5d != null ? `${live.momentum5d.toFixed(1)}%` : "—" },
            ],
            thesis: r.stock.thesis,
          };
        }),
      });
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-12">
      <button onClick={onBack} className="mb-6 text-xs text-muted-foreground hover:text-foreground transition-colors">
        ← Back to home
      </button>

      <header className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        </div>
        <MarketStatusBadge />
      </header>

      {loading && <LoadingState />}

      {error && (
        <ErrorCard rawError={error} onRetry={handleRegenerate} />
      )}

      {!loading && !error && result && (
        <>
          <div className="rounded-lg border border-a-border bg-a-fill px-4 py-2.5 mb-4 text-xs text-a-text">
            {result.dataNotice}
          </div>

          <p className="text-sm text-muted-foreground mb-5">{result.summary}</p>

          {/* Market closed banner */}
          <MarketClosedBanner lastUpdated={lastUpdated} marketStatus={marketStatus ?? "closed"} />

          {/* Budget filter */}
          <BudgetFilterBar selected={budget} onChange={setBudget} />

          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div className="flex flex-wrap gap-2">
              {sectors.map((s) => (
                <button
                  key={s}
                  onClick={() => setActiveSector(s)}
                  className={cn(
                    "px-3 py-1.5 rounded-full border text-xs transition-colors",
                    activeSector === s
                      ? "border-foreground text-foreground font-medium"
                      : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-1 rounded-full border border-border p-0.5">
                <button
                  onClick={() => setView("table")}
                  className={cn(
                    "px-3 py-1 text-xs rounded-full transition-colors",
                    view === "table" ? "bg-foreground text-background" : "text-muted-foreground",
                  )}
                >
                  Table
                </button>
                <button
                  onClick={() => setView("cards")}
                  className={cn(
                    "px-3 py-1 text-xs rounded-full transition-colors",
                    view === "cards" ? "bg-foreground text-background" : "text-muted-foreground",
                  )}
                >
                  Cards
                </button>
              </div>
              <PdfExportButton onExport={handleExport} disabled={ranked.length === 0} />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-[11px] text-muted-foreground">
            <div>
              Showing {filtered.length} of {ranked.length} picks · ranked by composite score (live momentum, volume, 52W proximity, P/E, RSI, market cap)
            </div>
            <div className="flex items-center gap-2">
              {refreshing && (
                <span className="flex items-center gap-1">
                  <span className="h-3 w-3 rounded-full border-2 border-muted-foreground/30 border-t-foreground animate-spin" />
                  Refreshing prices
                </span>
              )}
              {lastUpdated && <span>Updated {formatIst(lastUpdated)}</span>}
              <button
                onClick={refresh}
                disabled={refreshing}
                className="px-2.5 py-1 rounded-full border border-border hover:border-foreground/40 transition-colors disabled:opacity-50"
              >
                🔄 Refresh prices
              </button>
              <button
                onClick={handleRegenerate}
                disabled={regenerating}
                className="px-2.5 py-1 rounded-full border border-border hover:border-foreground/40 transition-colors disabled:opacity-50"
              >
                {regenerating ? "Regenerating…" : "🤖 Regenerate picks"}
              </button>
            </div>
          </div>

          {view === "table" && <RankedTable rows={filtered} ranked={ranked} kind={kind} retrySingle={retrySingle} />}
          {view === "cards" && (
            <div className="grid gap-4 sm:grid-cols-2">
              {filtered.map((r) => (
                <StockCard
                  key={r.symbol}
                  row={r}
                  rank={ranked.indexOf(r) + 1}
                  kind={kind}
                  budget={budget}
                  onRetry={() => retrySingle(r.symbol)}
                />
              ))}
            </div>
          )}
          <PerformanceFooter stats={stats ?? null} fromCache={fromCache} />

          <div className="mt-8 border-t border-border pt-6">
            <h4 className="text-sm font-semibold mb-3">Scoring & Recommendation Logic</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs mb-4 text-muted-foreground">
              <div className="bg-secondary/40 p-3 rounded">
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">⭐ STRONG BUY (80-100)</span>
                <p className="mt-1">Exceptional composite score. High momentum, strong volume, excellent fundamentals, and significant upside potential.</p>
              </div>
              <div className="bg-secondary/40 p-3 rounded">
                <span className="font-semibold text-emerald-500 dark:text-emerald-300">✅ BUY (60-79)</span>
                <p className="mt-1">Good composite score indicating a solid entry point. Price has not yet exceeded its analyst target.</p>
              </div>
              <div className="bg-secondary/40 p-3 rounded">
                <span className="font-semibold text-amber-500 dark:text-amber-400">⚠️ HOLD (40-59)</span>
                <p className="mt-1">Average score or stock has already exceeded its analyst target. Better to wait for a dip before entering.</p>
              </div>
              <div className="bg-secondary/40 p-3 rounded">
                <span className="font-semibold text-orange-500 dark:text-orange-400">🔻 AVOID (20-39)</span>
                <p className="mt-1">Weak momentum or poor fundamentals. High risk of downside.</p>
              </div>
              <div className="bg-secondary/40 p-3 rounded">
                <span className="font-semibold text-red-500 dark:text-red-400">❌ SELL (0-19)</span>
                <p className="mt-1">Very poor technicals and fundamentals. Negative catalysts or highly overvalued.</p>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              <strong>Equity Scoring:</strong> Composite scores computed in-browser combining live technicals (5-day momentum, volume vs 3M avg, 52W proximity, RSI) and AI-supplied fundamentals (P/E vs sector, Market Cap).
              <br/><em>Note: If a stock's current market price exceeds the stated analyst target, the score is penalized and capped at 59 (HOLD) maximum to prevent buying overvalued assets.</em>
            </p>
          </div>

          <p className="text-[11px] text-muted-foreground border-t border-border pt-4 mt-6 leading-relaxed">
            Live prices from NSE/BSE via Yahoo Finance. Composite scores computed in-browser from
            live momentum (5-day), volume vs 3M avg, 52W proximity, RSI(14), P/E vs sector, and
            market cap. Fundamental data (P/E, sector P/E, holdings) supplied by AI — verify before
            trading.
          </p>
          <p className="text-[11px] text-muted-foreground border-t border-border pt-4 mt-4 leading-relaxed">
            Sources: {result.sources.join(" · ")}. SEBI disclaimer: this is a fundamental screening
            and education tool only. NOT investment advice, not a buy/sell recommendation, not
            SEBI-registered research. AI can make errors — verify all numbers on NSE, BSE, or
            Screener.in before making any decision.
          </p>
        </>
      )}
    </div>
  );
}

function rankLabelPlain(rank: number): string {
  if (rank === 1) return "#1 🥇";
  if (rank === 2) return "#2 🥈";
  if (rank === 3) return "#3 🥉";
  return `#${rank}`;
}

// ───────────────────── Table view ─────────────────────

type SortKey = "rank" | "symbol" | "score" | "cmp" | "changePct" | "pe" | "roce";

function RankedTable({
  rows,
  ranked,
  kind,
  retrySingle,
}: {
  rows: RankedRow[];
  ranked: RankedRow[];
  kind: Kind;
  retrySingle?: (symbol: string) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      const live = (r: RankedRow) => quoteOf(r.liveState);
      const get = (r: RankedRow): number | string => {
        switch (sortKey) {
          case "rank":
            return ranked.indexOf(r);
          case "symbol":
            return r.symbol;
          case "score":
            return r.score.total;
          case "cmp":
            return live(r)?.price ?? 0;
          case "changePct":
            return live(r)?.changePercent ?? 0;
          case "pe":
            return parseNumeric(r.stock.pe) ?? 0;
          case "roce":
            return parseNumeric(r.stock.roce) ?? 0;
        }
      };
      const av = get(a);
      const bv = get(b);
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return arr;
  }, [rows, sortKey, sortDir, ranked]);

  const toggle = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "rank" || key === "symbol" ? "asc" : "desc");
    }
  };

  const Th = ({ k, label, align = "left" }: { k: SortKey; label: string; align?: "left" | "right" }) => (
    <th
      onClick={() => toggle(k)}
      className={cn(
        "px-3 py-2 cursor-pointer select-none whitespace-nowrap",
        align === "right" ? "text-right" : "text-left",
      )}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === k && <span className="text-[9px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
      </span>
    </th>
  );

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-secondary text-muted-foreground">
            <tr>
              <Th k="rank" label="#" />
              <Th k="symbol" label="Symbol" />
              <th className="px-3 py-2 text-left">Sector</th>
              <Th k="score" label="Score" align="right" />
              <Th k="cmp" label="CMP" align="right" />
              <Th k="changePct" label="% Chg" align="right" />
              <Th k="pe" label="P/E" align="right" />
              <Th k="roce" label="ROCE" align="right" />
              <th className="px-3 py-2 text-right">RSI</th>
              <th className="px-3 py-2 text-right">5d mom</th>
              <th className="px-3 py-2 text-left">Recommendation</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const rank = ranked.indexOf(r) + 1;
              const live = quoteOf(r.liveState);
              const chgTone =
                live && live.changePercent > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : live && live.changePercent < 0
                    ? "text-red-600 dark:text-red-400"
                    : "text-muted-foreground";
              return (
                <tr key={r.symbol} className="border-t border-border hover:bg-secondary/40">
                  <td className="px-3 py-2"><RankBadgeChip rank={rank} /></td>
                  <td className="px-3 py-2 font-medium">{r.symbol}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {kind === "nifty100" && r.stock.niftyWeight ? `${r.stock.sector} · ${r.stock.niftyWeight}` : r.stock.sector}
                  </td>
                  <td className="px-3 py-2 text-right"><ScorePill score={r.score.total} /></td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {live
                      ? `₹${inrFmt.format(live.price)}`
                      : r.liveState?.status === "loading"
                        ? "…"
                        : r.liveState?.status === "error"
                          ? <span className="text-[10px] text-amber-600 dark:text-amber-400 cursor-pointer" onClick={() => retrySingle?.(r.symbol)}>⚠ Retry</span>
                          : "—"}
                  </td>
                  <td className={cn("px-3 py-2 text-right tabular-nums", chgTone)}>
                    {live ? `${live.changePercent >= 0 ? "+" : ""}${live.changePercent.toFixed(2)}%` : ""}
                  </td>
                  <td className="px-3 py-2 text-right">{r.stock.pe}</td>
                  <td className="px-3 py-2 text-right">{r.stock.roce}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{live?.rsi14 ? live.rsi14.toFixed(0) : "—"}</td>
                  <td className={cn("px-3 py-2 text-right tabular-nums", chgTone)}>
                    {live?.momentum5d != null ? `${live.momentum5d >= 0 ? "+" : ""}${live.momentum5d.toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-3 py-2"><RecommendationBadge score={r.score.total} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ───────────────────── Card view ─────────────────────

function StockCard({ row, rank, kind, budget, onRetry }: { row: RankedRow; rank: number; kind: Kind; budget: number; onRetry?: () => void }) {
  const [open, setOpen] = useState(false);
  const { stock, score, liveState, symbol } = row;
  const live = quoteOf(liveState);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      {/* Header: rank + score */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <RankBadgeChip rank={rank} />
          <div className="min-w-0">
            <div className="text-base font-semibold truncate">{symbol}</div>
            <div className="text-[11px] text-muted-foreground truncate">
              {stock.company} · {stock.sector}
              {kind === "nifty100" && stock.niftyWeight ? ` · ${stock.niftyWeight}` : ""}
            </div>
          </div>
        </div>
        <ScorePill score={score.total} />
      </div>

      {/* Live price + recommendation */}
      <div className="flex items-end justify-between gap-3">
        <LivePriceBlock state={liveState} align="left" />
        <RecommendationBadge score={score.total} />
      </div>

      {/* 52W range bar */}
      {live?.fiftyTwoWeekHigh && live.fiftyTwoWeekLow && (
        <div className="mt-3">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>52W: ₹{inrFmt.format(live.fiftyTwoWeekLow)}</span>
            <span>₹{inrFmt.format(live.fiftyTwoWeekHigh)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-secondary relative overflow-hidden">
            <div
              className="absolute top-0 h-full w-1.5 bg-foreground rounded-full"
              style={{
                left: `${((live.price - live.fiftyTwoWeekLow) / (live.fiftyTwoWeekHigh - live.fiftyTwoWeekLow)) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Quick metrics */}
      <div className="grid grid-cols-4 gap-2 mt-3 text-center">
        <Mini label="RSI" value={live?.rsi14 ? live.rsi14.toFixed(0) : "—"} />
        <Mini label="5d mom" value={live?.momentum5d != null ? `${live.momentum5d.toFixed(1)}%` : "—"} />
        <Mini label="P/E" value={stock.pe} />
        <Mini label="ROCE" value={stock.roce} />
      </div>

      {kind === "penny" && live && (
        <div className="mt-3 text-[11px] text-muted-foreground">
          {(() => {
            const minInv = calcEquityMinInvestment(live.price);
            if (!minInv) return null;
            return (
              <span>
                Min to buy: <span className="text-foreground font-medium">₹{inrFmt.format(minInv.amount)}</span>
                {" "}({minInv.shares} shares of {symbol} at ₹{inrFmt.format(live.price)})
              </span>
            );
          })()}
        </div>
      )}
      {/* Budget chip */}
      {(() => {
        const live2 = quoteOf(liveState);
        const minInv = live2 ? calcEquityMinInvestment(live2.price) : null;
        return <BudgetChip minInvestment={minInv?.amount ?? null} budget={budget} />;
      })()}

      {/* Score breakdown */}
      <div className="mt-3 grid grid-cols-3 gap-1.5 text-[10px]">
        <ScoreBit label="Mom" v={score.momentum} />
        <ScoreBit label="Vol" v={score.volume} />
        <ScoreBit label="52W" v={score.proximity52w} />
        <ScoreBit label="P/E" v={score.pe} />
        <ScoreBit label="RSI" v={score.rsi} />
        <ScoreBit label="Cap" v={score.mcap} />
      </div>

      <button
        onClick={() => setOpen((v) => !v)}
        className="mt-4 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? "− Hide details" : "+ Show thesis & risks"}
      </button>

      {open && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          {stock.undervaluedReason && <Block title="Why it's undervalued" body={stock.undervaluedReason} />}
          <Block title="Thesis" body={stock.thesis} />
          <List title="Catalysts" items={stock.catalysts} tone="ok" />
          <List title="Risks" items={stock.risks} tone="bad" />
          {stock.analystTarget && (
            <div className="text-xs">
              <span className="text-muted-foreground">Analyst target: </span>
              <span className="font-medium">{stock.analystTarget}</span>
              {(() => {
                const targetNum = parseNumeric(stock.analystTarget);
                if (live && targetNum) {
                  const realUpside = ((targetNum - live.price) / live.price) * 100;
                  const color = realUpside >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";
                  return (
                    <span className={cn("ml-1 font-medium", color)}>
                      ({realUpside > 0 ? "+" : ""}{realUpside.toFixed(1)}%)
                    </span>
                  );
                }
                return stock.upsidePct !== undefined ? (
                  <span className="text-muted-foreground ml-1">({stock.upsidePct > 0 ? "+" : ""}{stock.upsidePct}%)</span>
                ) : null;
              })()}
            </div>
          )}
          {stock.riskReward && (
            <div className="mt-2">
              <span className="text-[11px] text-muted-foreground mr-2">Risk-reward:</span>
              <Badge
                label={stock.riskReward}
                tone={stock.riskReward === "LOW" ? "ok" : stock.riskReward === "MEDIUM" ? "warn" : "bad"}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary py-1.5 px-1">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-xs font-medium mt-0.5 truncate">{value}</div>
    </div>
  );
}

function ScoreBit({ label, v }: { label: string; v: number }) {
  const tone =
    v >= 70 ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" :
    v >= 40 ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" :
    "bg-red-500/10 text-red-700 dark:text-red-300";
  return (
    <div className={cn("rounded px-1.5 py-1 text-center tabular-nums", tone)}>
      <span className="text-muted-foreground mr-1">{label}</span>{v}
    </div>
  );
}

function Block({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{title}</div>
      <p className="text-sm">{body}</p>
    </div>
  );
}

function List({ title, items, tone }: { title: string; items: string[]; tone: "ok" | "bad" }) {
  const dot = tone === "ok" ? "bg-g-accent" : "bg-r-accent";
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">{title}</div>
      <ul className="space-y-1">
        {items?.map((it, i) => (
          <li key={i} className="text-sm flex gap-2">
            <span className={cn("mt-1.5 h-1.5 w-1.5 rounded-full shrink-0", dot)} />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground animate-pulse">Researching 20 picks… this can take 30–60 seconds.</p>
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-10 rounded-lg border border-border bg-card animate-pulse" />
        ))}
      </div>
    </div>
  );
}
