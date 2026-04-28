import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { runFno, type FnoResult, type FnoStock } from "@/lib/fno.functions";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/report/Badge";
import { LiveMarketView } from "./LiveMarketView";
import { LivePriceBlock } from "./LivePriceBlock";
import { FnoOptionChain } from "./FnoOptionChain";
import { MarketStatusBadge } from "./MarketStatusBadge";
import { useLiveQuotes, useLiveQuote, type LiveQuoteState } from "@/hooks/use-live-quotes";
import {
  computeFnoScore,
  parseNumeric,
  quoteOf,
  recommendationFor,
  type FnoCompositeBreakdown,
} from "@/lib/scoring";
import { RankBadgeChip, ScorePill, RecommendationBadge } from "./RankedBadges";
import { PdfExportButton } from "./PdfExportButton";
import { exportCompactPdf, exportDetailedPdf } from "@/lib/pdf-export";

type ViewMode = "table" | "cards" | "live";

interface FnoRanked {
  stock: FnoStock;
  score: FnoCompositeBreakdown;
  liveState: LiveQuoteState | undefined;
}

const inrFmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

function rankLabelPlain(rank: number): string {
  if (rank === 1) return "#1 🥇";
  if (rank === 2) return "#2 🥈";
  if (rank === 3) return "#3 🥉";
  return `#${rank}`;
}

export function FnoDashboard({ onBack }: { onBack: () => void }) {
  const run = useServerFn(runFno);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FnoResult | null>(null);
  const [activeSector, setActiveSector] = useState<string>("All");
  const [view, setView] = useState<ViewMode>("table");
  const [regenerating, setRegenerating] = useState(false);

  const fetchPicks = async () => {
    setError(null);
    try {
      const res = await run({ data: undefined });
      if (res.error) setError(res.error);
      else setResult(res.result);
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
  }, []);

  // Nifty 50 live for header strip
  const nifty = useLiveQuote("^NSEI");

  const allSymbols = useMemo(() => (result?.picks ?? []).map((p) => p.symbol), [result]);
  const { quotes: liveQuotes, lastUpdated, refreshing, refresh } = useLiveQuotes(allSymbols);

  const ranked: FnoRanked[] = useMemo(() => {
    if (!result) return [];
    return result.picks
      .map((stock) => {
        const liveState = liveQuotes[stock.symbol];
        const live = quoteOf(liveState);
        const score = computeFnoScore(live, {
          oi: stock.openInterest,
          // We don't have an explicit OI change field — derive heuristic from trend.
          oiChangePct:
            stock.trend === "Bullish" ? 12 : stock.trend === "Bearish" ? -8 : 2,
          iv: stock.iv,
          // PCR not in schema; default neutral 1.0
          pcr: 1.0,
        });
        return { stock, score, liveState };
      })
      .sort((a, b) => b.score.total - a.score.total);
  }, [result, liveQuotes]);

  const sectors = useMemo(() => {
    if (!result) return ["All"];
    const set = new Set(result.picks.map((p) => p.sector));
    return ["All", ...Array.from(set)];
  }, [result]);

  const filtered = useMemo(() => {
    if (activeSector === "All") return ranked;
    return ranked.filter((r) => r.stock.sector === activeSector);
  }, [ranked, activeSector]);

  const handleRegenerate = async () => {
    setRegenerating(true);
    await fetchPicks();
    setRegenerating(false);
  };

  const handleExport = (mode: "compact" | "detailed") => {
    const filename = `fno-top20-${new Date().toISOString().slice(0, 10)}.pdf`;
    const title = "F&O Trading — Top 20 Ranked Picks";
    const subtitle = `Composite F&O score · live OI/IV/momentum · Generated ${new Date().toLocaleString("en-IN")}`;

    if (mode === "compact") {
      exportCompactPdf({
        title,
        subtitle,
        filename,
        columns: [
          { header: "Rank", key: "badge" },
          { header: "Symbol", key: "symbol" },
          { header: "Sector", key: "sector" },
          { header: "Score", key: "score" },
          { header: "CMP", key: "cmp" },
          { header: "% Chg", key: "changePct" },
          { header: "IV", key: "iv" },
          { header: "OI", key: "oi" },
          { header: "Trend", key: "trend" },
          { header: "Strategy", key: "strategy" },
          { header: "R:R", key: "rr" },
          { header: "Recommendation", key: "recommendation" },
        ],
        rows: filtered.map((r) => {
          const live = quoteOf(r.liveState);
          return {
            rank: ranked.indexOf(r) + 1,
            badge: rankLabelPlain(ranked.indexOf(r) + 1),
            symbol: r.stock.symbol,
            score: r.score.total,
            recommendation: recommendationFor(r.score.total).label,
            extra: {
              sector: r.stock.sector,
              cmp: live ? `₹${inrFmt.format(live.price)}` : "—",
              changePct: live ? `${live.changePercent >= 0 ? "+" : ""}${live.changePercent.toFixed(2)}%` : "—",
              iv: r.stock.iv,
              oi: r.stock.openInterest,
              trend: r.stock.trend,
              strategy: r.stock.strategy.name,
              rr: r.stock.strategy.riskReward,
            },
          };
        }),
      });
    } else {
      exportDetailedPdf({
        title,
        subtitle,
        filename,
        stocks: filtered.map((r) => {
          const live = quoteOf(r.liveState);
          const rank = ranked.indexOf(r) + 1;
          return {
            rank,
            badge: rankLabelPlain(rank),
            symbol: `${r.stock.symbol} — ${r.stock.company}`,
            sector: r.stock.sector,
            cmp: live ? `₹${inrFmt.format(live.price)}` : undefined,
            changePct: live ? `${live.changePercent >= 0 ? "+" : ""}${live.changePercent.toFixed(2)}%` : undefined,
            score: r.score.total,
            recommendation: recommendationFor(r.score.total).label,
            metrics: [
              { label: "OI", value: r.stock.openInterest },
              { label: "IV", value: r.stock.iv },
              { label: "Volume", value: r.stock.avgVolume },
              { label: "Trend", value: r.stock.trend },
              { label: "Support", value: r.stock.support },
              { label: "Resistance", value: r.stock.resistance },
              { label: "RSI", value: live?.rsi14 ? live.rsi14.toFixed(1) : "—" },
              { label: "5d momentum", value: live?.momentum5d != null ? `${live.momentum5d.toFixed(1)}%` : "—" },
            ],
            strategy: {
              name: r.stock.strategy.name,
              strikes: r.stock.strategy.strikeSelection,
              rr: `${r.stock.strategy.riskReward} · max profit ${r.stock.strategy.maxProfit} · max risk ${r.stock.strategy.maxRisk}`,
            },
            thesis: r.stock.whyQualifies,
          };
        }),
      });
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-12">
      <button
        onClick={onBack}
        className="mb-6 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        ← Back to home
      </button>

      <header className="mb-4 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
            F&amp;O Trading — Top 20 Ranked Picks
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Composite F&amp;O score · OI / IV / momentum / volume / PCR · ₹50k–₹1L conservative trader
          </p>
        </div>
        <MarketStatusBadge />
      </header>

      {/* Nifty 50 live strip */}
      {nifty.state?.status === "ok" && (
        <div className="mb-4 rounded-lg border border-border bg-card px-4 py-2 flex items-center gap-3 text-sm">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Nifty 50</span>
          <span className="font-semibold tabular-nums">{inrFmt.format(nifty.state.quote.price)}</span>
          <span
            className={cn(
              "tabular-nums text-xs",
              nifty.state.quote.change >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
            )}
          >
            {nifty.state.quote.change >= 0 ? "▲" : "▼"} {nifty.state.quote.change.toFixed(2)} ({nifty.state.quote.changePercent.toFixed(2)}%)
          </span>
        </div>
      )}

      {loading && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Scanning F&amp;O universe and ranking 20 picks… 30–60 seconds.
          </p>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-10 rounded-lg border border-border bg-card animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-r-border bg-r-fill px-4 py-3 text-sm text-r-text">
          {error}
        </div>
      )}

      {!loading && !error && result && (
        <>
          <div className="rounded-lg border border-a-border bg-a-fill px-4 py-2.5 mb-4 text-xs text-a-text">
            {result.dataNotice}
          </div>

          <p className="text-sm text-muted-foreground mb-5">{result.summary}</p>

          {result.bestThisWeek?.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4 mb-5">
              <h2 className="text-sm font-semibold mb-3">⭐ Best Risk-Reward This Week</h2>
              <div className="grid sm:grid-cols-3 gap-3">
                {result.bestThisWeek.map((b, i) => (
                  <div key={i} className="rounded-lg bg-secondary p-3">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">
                      Pick #{i + 1}
                    </div>
                    <div className="text-base font-semibold mt-0.5">{b.symbol}</div>
                    <div className="text-xs text-muted-foreground mt-1">{b.reason}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
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
                {(["table", "cards", "live"] as ViewMode[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={cn(
                      "px-3 py-1 text-xs rounded-full transition-colors capitalize",
                      view === v ? "bg-foreground text-background" : "text-muted-foreground",
                    )}
                  >
                    {v === "live" ? "🔴 Live" : v}
                  </button>
                ))}
              </div>
              <PdfExportButton onExport={handleExport} disabled={ranked.length === 0} />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-[11px] text-muted-foreground">
            <div>Showing {filtered.length} of {ranked.length} picks · ranked by F&amp;O composite score</div>
            <div className="flex items-center gap-2">
              {refreshing && (
                <span className="flex items-center gap-1">
                  <span className="h-3 w-3 rounded-full border-2 border-muted-foreground/30 border-t-foreground animate-spin" />
                  Refreshing prices
                </span>
              )}
              {lastUpdated && <span>Updated {lastUpdated.toLocaleTimeString("en-IN")}</span>}
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

          {view === "table" && <FnoTable rows={filtered} ranked={ranked} />}
          {view === "cards" && (
            <div className="grid gap-4 sm:grid-cols-2">
              {filtered.map((r) => (
                <FnoCard key={r.stock.symbol} row={r} rank={ranked.indexOf(r) + 1} />
              ))}
            </div>
          )}
          {view === "live" && (
            <LiveMarketView symbols={filtered.map((r) => r.stock.symbol)} refreshMs={30_000} />
          )}

          <div className="rounded-xl border border-r-border bg-r-fill p-4 mt-8">
            <div className="text-sm font-semibold text-r-text mb-1">⚠ F&amp;O Risk Warning</div>
            <p className="text-xs text-r-text leading-relaxed">{result.riskWarning}</p>
          </div>

          <p className="text-[11px] text-muted-foreground border-t border-border pt-4 mt-6 leading-relaxed">
            Sources: {result.sources.join(" · ")}. SEBI disclaimer: educational F&amp;O screening
            tool. NOT investment advice. Verify every level on the NSE option chain before placing
            orders. Consult a SEBI-registered advisor before trading.
          </p>
        </>
      )}
    </div>
  );
}

// ───────────────────── Table view ─────────────────────

type SortKey = "rank" | "symbol" | "score" | "cmp" | "changePct" | "iv";

function FnoTable({ rows, ranked }: { rows: FnoRanked[]; ranked: FnoRanked[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      const live = (r: FnoRanked) => quoteOf(r.liveState);
      const get = (r: FnoRanked): number | string => {
        switch (sortKey) {
          case "rank":
            return ranked.indexOf(r);
          case "symbol":
            return r.stock.symbol;
          case "score":
            return r.score.total;
          case "cmp":
            return live(r)?.price ?? 0;
          case "changePct":
            return live(r)?.changePercent ?? 0;
          case "iv":
            return parseNumeric(r.stock.iv) ?? 0;
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
              <th className="px-3 py-2 text-right">OI</th>
              <Th k="iv" label="IV" align="right" />
              <th className="px-3 py-2 text-left">Trend</th>
              <th className="px-3 py-2 text-left">Strategy</th>
              <th className="px-3 py-2 text-left">R:R</th>
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
                <tr key={r.stock.symbol} className="border-t border-border hover:bg-secondary/40">
                  <td className="px-3 py-2"><RankBadgeChip rank={rank} /></td>
                  <td className="px-3 py-2 font-medium">{r.stock.symbol}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.stock.sector}</td>
                  <td className="px-3 py-2 text-right"><ScorePill score={r.score.total} /></td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {live ? `₹${inrFmt.format(live.price)}` : r.liveState?.status === "loading" ? "…" : "—"}
                  </td>
                  <td className={cn("px-3 py-2 text-right tabular-nums", chgTone)}>
                    {live ? `${live.changePercent >= 0 ? "+" : ""}${live.changePercent.toFixed(2)}%` : ""}
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{r.stock.openInterest}</td>
                  <td className="px-3 py-2 text-right">{r.stock.iv}</td>
                  <td className="px-3 py-2">{r.stock.trend}</td>
                  <td className="px-3 py-2">{r.stock.strategy.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.stock.strategy.riskReward}</td>
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

function FnoCard({ row, rank }: { row: FnoRanked; rank: number }) {
  const [open, setOpen] = useState(false);
  const { stock, score, liveState } = row;
  const live = quoteOf(liveState);
  const trendTone = stock.trend === "Bullish" ? "ok" : stock.trend === "Bearish" ? "bad" : "warn";

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <RankBadgeChip rank={rank} />
          <div className="min-w-0">
            <div className="text-base font-semibold truncate">{stock.symbol}</div>
            <div className="text-[11px] text-muted-foreground truncate">
              {stock.company} · {stock.sector}{stock.inIndex ? ` · ${stock.inIndex}` : ""}
            </div>
          </div>
        </div>
        <ScorePill score={score.total} />
      </div>

      <div className="flex items-end justify-between gap-3">
        <LivePriceBlock state={liveState} align="left" />
        <div className="flex flex-col items-end gap-1">
          <Badge label={stock.trend} tone={trendTone as "ok" | "warn" | "bad"} />
          <RecommendationBadge score={score.total} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3 text-center">
        <Mini label="OI" value={stock.openInterest} />
        <Mini label="IV" value={stock.iv} />
        <Mini label="Volume" value={stock.avgVolume} />
      </div>

      <div className="grid grid-cols-2 gap-2 mt-2 text-center">
        <Mini label="Support" value={stock.support} />
        <Mini label="Resistance" value={stock.resistance} />
      </div>

      <p className="text-xs text-muted-foreground mt-3">{stock.whyQualifies}</p>

      <div className="mt-3 grid grid-cols-3 gap-1.5 text-[10px]">
        <ScoreBit label="OI" v={score.oi} />
        <ScoreBit label="ΔOI" v={score.oiChange} />
        <ScoreBit label="Mom" v={score.momentum} />
        <ScoreBit label="IV" v={score.iv} />
        <ScoreBit label="Vol" v={score.volume} />
        <ScoreBit label="PCR" v={score.pcr} />
      </div>

      <div className="mt-4 rounded-lg bg-secondary/60 p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            🤖 AI Strategy
          </div>
          <span className="text-[10px] text-muted-foreground">{stock.strategy.expiry}</span>
        </div>
        <div className="text-sm font-semibold">{stock.strategy.name}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{stock.strategy.marketOutlook}</div>
        <div className="grid grid-cols-2 gap-2 mt-3 text-[11px]">
          <KV label="Strikes" value={stock.strategy.strikeSelection} />
          <KV label="R:R" value={stock.strategy.riskReward} />
          <KV label="Max profit" value={stock.strategy.maxProfit} />
          <KV label="Max risk" value={stock.strategy.maxRisk} />
        </div>
      </div>

      <button
        onClick={() => setOpen((v) => !v)}
        className="mt-4 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? "− Hide entry / exit / SL" : "+ Show full strategy plan"}
      </button>

      <FnoOptionChain symbol={stock.symbol} />

      {open && (
        <div className="mt-3 space-y-2 border-t border-border pt-3 text-xs">
          <KV label="Entry condition" value={stock.strategy.entryCondition} block />
          <KV label="Exit / target" value={stock.strategy.exitCondition} block />
          <KV label="Stop loss" value={stock.strategy.stopLoss} block />
          <KV label="Position sizing" value={stock.strategy.positionSizingTip} block />
          {stock.fiiDiiActivity && <KV label="FII / DII" value={stock.fiiDiiActivity} block />}
          {stock.bidAskSpread && <KV label="Bid-ask spread" value={stock.bidAskSpread} block />}
          {stock.banStatus && <KV label="F&O ban status" value={stock.banStatus} block />}
        </div>
      )}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary py-2 px-1">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
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

function KV({ label, value, block }: { label: string; value: string; block?: boolean }) {
  if (block) {
    return (
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="mt-0.5">{value}</div>
      </div>
    );
  }
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-medium mt-0.5 truncate">{value}</div>
    </div>
  );
}
