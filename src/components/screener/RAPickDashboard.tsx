import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { runRAPick, type RAPickResult, type RAPickStock } from "@/lib/ra-pick.functions";
import { useGeminiKey } from "@/hooks/use-gemini-key";
import { cn } from "@/lib/utils";
import { useLiveQuotes, type LiveQuoteState } from "@/hooks/use-live-quotes";
import { LivePriceBlock } from "@/components/screener/LivePriceBlock";
import { TrendingUp, AlertTriangle, RefreshCw, Target, BarChart2, Zap, CheckCircle2, XCircle, ChevronDown, ChevronUp, Star, ShieldCheck, Info } from "lucide-react";

function ScoreDots({ score, max = 10 }: { score: number; max?: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <div key={i} className={cn("w-2 h-2 rounded-full", i < score ? "bg-emerald-500" : "bg-muted")} />
      ))}
    </div>
  );
}

// Safe string coercion helper — prevents .replace() crash when AI returns non-string
function s(val: unknown, fallback = "—"): string {
  if (val == null) return fallback;
  return String(val);
}

function Badge({ label, variant = "default" }: { label?: string; variant?: string }) {
  const safeLabel = s(label, "—");
  const colors: Record<string, string> = {
    STRONG: "bg-emerald-500/15 text-emerald-700 border-emerald-500/20",
    MODERATE: "bg-blue-500/15 text-blue-700 border-blue-500/20",
    WEAK: "bg-red-500/15 text-red-700 border-red-500/20",
    BULLISH_CROSSOVER: "bg-emerald-500/15 text-emerald-700 border-emerald-500/20",
    BEARISH_CROSSOVER: "bg-red-500/15 text-red-700 border-red-500/20",
    NEUTRAL: "bg-slate-400/15 text-slate-600 border-slate-400/20",
    High: "bg-emerald-500/15 text-emerald-700 border-emerald-500/20",
    Medium: "bg-amber-500/15 text-amber-700 border-amber-500/20",
    BULLISH: "bg-emerald-500/15 text-emerald-700 border-emerald-500/20",
    BEARISH: "bg-red-500/15 text-red-700 border-red-500/20",
    INCREASING: "bg-emerald-500/15 text-emerald-700 border-emerald-500/20",
    STABLE: "bg-slate-400/15 text-slate-600 border-slate-400/20",
    DECREASING: "bg-red-500/15 text-red-700 border-red-500/20",
    default: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border", colors[safeLabel] ?? colors.default)}>
      {safeLabel.replace(/_/g, " ")}
    </span>
  );
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center gap-3 py-1.5 border-b border-border/40 last:border-0">
      <span className="text-[11px] text-muted-foreground uppercase tracking-wide shrink-0">{label}</span>
      <span className="text-xs font-semibold text-right">{value}</span>
    </div>
  );
}

function PickCard({ pick, defaultOpen, quoteState }: { pick: RAPickStock; defaultOpen: boolean; quoteState?: LiveQuoteState }) {
  const [open, setOpen] = useState(defaultOpen);
  const upsideBest = Math.max(pick.upsideShortTerm ?? 0, pick.upsideLongTerm ?? 0);
  const convColor = pick.conviction === "High" ? "text-emerald-600" : "text-amber-600";
  const rankColors = ["bg-yellow-400 text-yellow-900", "bg-slate-300 text-slate-800", "bg-amber-700 text-amber-100"];
  const rankBg = rankColors[(pick.rank ?? 1) - 1] ?? "bg-muted text-muted-foreground";
  const livePrice = quoteState?.status === "ok" ? quoteState.quote.price : null;
  // Safe array helpers — AI sometimes returns null instead of []
  const whyList = Array.isArray(pick.whyThisStock) ? pick.whyThisStock : [];
  const catalystList = Array.isArray(pick.catalysts) ? pick.catalysts : [];
  const riskList = Array.isArray(pick.risks) ? pick.risks : [];
  const newsList = Array.isArray(pick.latestNews) ? pick.latestNews : [];
  const filterList = Array.isArray(pick.filtersPass) ? pick.filtersPass : [];
  const flagList = Array.isArray(pick.redFlagsChecked) ? pick.redFlagsChecked : [];
  // Safe pledged parse
  const pledgedNum = parseFloat(s(pick.pledgedShares, "0").replace(/[^0-9.]/g, ""));

  return (
    <div className={cn("rounded-2xl border border-border bg-card overflow-hidden transition-all", open && "shadow-lg ring-1 ring-foreground/5")}>
      {/* Card Header — always visible */}
      <button className="w-full text-left" onClick={() => setOpen(!open)}>
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0", rankBg)}>
                #{pick.rank}
              </div>
              <div>
                <div className="flex items-center flex-wrap gap-1.5 mb-0.5">
                  <span className="font-bold text-base leading-tight">{pick.companyName}</span>
                  <Badge label={pick.conviction} />
                  <Badge label={pick.technicalRating} />
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono">{pick.ticker}</span>
                  <span>·</span>
                  <span>{pick.sector}</span>
                  <span>·</span>
                  <span>{pick.subSector}</span>
                </div>
              </div>
            </div>
            <div className="text-right shrink-0">
              {/* Live NSE price — falls back to AI CMP if not yet loaded */}
              {quoteState ? (
                <div>
                  <LivePriceBlock state={quoteState} align="right" />
                  {livePrice == null && (
                    <div className="text-xl font-black text-muted-foreground">{s(pick.cmp)}</div>
                  )}
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {quoteState.status === "ok"
                      ? <span className="text-emerald-600 font-semibold">● Live NSE</span>
                      : quoteState.status === "loading"
                      ? <span className="animate-pulse">Fetching live…</span>
                      : <span className="text-amber-600">⚠ AI est. {s(pick.cmp)}</span>}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-xl font-black">{s(pick.cmp)}</div>
                  <div className="text-[10px] text-muted-foreground">AI estimate</div>
                </div>
              )}
              <div className={cn("text-xs font-bold mt-1", convColor)}>↑ {upsideBest}% potential</div>
              <div className="text-[10px] text-muted-foreground">{s(pick.marketCap)}</div>
            </div>
          </div>

          {/* Quick stats row */}
          <div className="grid grid-cols-4 gap-2 mt-4">
            <div className="p-2 rounded-xl bg-emerald-500/8 border border-emerald-500/15 text-center">
              <div className="text-[9px] text-emerald-600 font-bold uppercase">ST Target</div>
              <div className="text-xs font-black text-emerald-600">{pick.targetShortTerm ?? "—"}</div>
            </div>
            <div className="p-2 rounded-xl bg-blue-500/8 border border-blue-500/15 text-center">
              <div className="text-[9px] text-blue-600 font-bold uppercase">LT Target</div>
              <div className="text-xs font-black text-blue-600">{pick.targetLongTerm ?? "—"}</div>
            </div>
            <div className="p-2 rounded-xl bg-red-500/8 border border-red-500/15 text-center">
              <div className="text-[9px] text-red-600 font-bold uppercase">Stop-Loss</div>
              <div className="text-xs font-black text-red-600">{pick.stopLoss}</div>
            </div>
            <div className="p-2 rounded-xl bg-purple-500/8 border border-purple-500/15 text-center">
              <div className="text-[9px] text-purple-600 font-bold uppercase">Fund. Score</div>
              <div className="text-xs font-black text-purple-600">{pick.fundamentalScore}/10</div>
            </div>
          </div>

          {/* Primary Catalyst pill */}
          <div className="mt-3 flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <p className="text-xs text-muted-foreground truncate">{pick.primaryCatalyst}</p>
            <div className="ml-auto shrink-0 text-muted-foreground">
              {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>
        </div>
      </button>

      {/* Expanded Detail */}
      {open && (
        <div className="border-t border-border px-5 pb-5 pt-4 space-y-5 animate-in fade-in duration-200 bg-muted/20">

          {/* Why This Stock */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold mb-2"><Star className="w-3.5 h-3.5 text-emerald-500" />WHY THIS STOCK</div>
            <ul className="space-y-1.5">
              {whyList.map((w, i) => (
                <li key={i} className="flex gap-2 text-xs leading-relaxed"><span className="text-emerald-500 font-black shrink-0">•</span>{s(w)}</li>
              ))}
            </ul>
          </div>

          {/* Technical + Fundamental side by side */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold mb-2"><BarChart2 className="w-3.5 h-3.5 text-blue-500" />TECHNICAL</div>
              <div className="space-y-0">
                <KV label="RSI" value={<span className={cn(pick.rsi != null && pick.rsi <= 35 ? "text-emerald-600 font-bold" : "")}>{pick.rsi ?? "N/A"}{pick.rsi != null && pick.rsi <= 35 ? " ⟵ Oversold" : ""}</span>} />
                <KV label="MACD" value={<Badge label={pick.macdSignal} />} />
                <KV label="Volume Surge" value={pick.volumeSurge} />
                <KV label="Support" value={pick.supportZone} />
                <KV label="Resistance" value={pick.resistanceZone} />
              </div>
              {pick.technicalNotes && <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">{pick.technicalNotes}</p>}
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold mb-2"><TrendingUp className="w-3.5 h-3.5 text-purple-500" />FUNDAMENTALS</div>
              <div className="space-y-0">
                <KV label="P/E" value={pick.pe} />
                <KV label="Sector P/E" value={pick.sectorMedianPe} />
                <KV label="Rev Growth Q1" value={<span className="text-emerald-600">{pick.revenueGrowthQ1}</span>} />
                <KV label="Rev Growth Q2" value={<span className="text-emerald-600">{pick.revenueGrowthQ2}</span>} />
                <KV label="D/E Ratio" value={pick.deRatio} />
                <KV label="Promoter" value={<span className="flex items-center gap-1">{s(pick.promoterHolding)} <Badge label={pick.promoterHoldingTrend} /></span>} />
                <KV label="Pledged" value={<span className={cn(pledgedNum > 10 ? "text-red-500" : "")}>{s(pick.pledgedShares)}</span>} />
              </div>
              {pick.fundamentalNotes && <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">{pick.fundamentalNotes}</p>}
              <div className="mt-2 flex items-center gap-2">
                <ScoreDots score={pick.fundamentalScore} />
                <span className="text-xs font-bold">{pick.fundamentalScore}/10</span>
              </div>
            </div>
          </div>

          {/* Intelligence */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold mb-2"><Info className="w-3.5 h-3.5 text-sky-500" />INTELLIGENCE</div>
            <div className="grid sm:grid-cols-2 gap-0 mb-2">
              <KV label="Sentiment" value={<Badge label={pick.socialSentiment} />} />
              <KV label="Broker View" value={pick.brokerConsensus} />
              <KV label="Promoter Activity" value={pick.promoterActivity} />
              <KV label="FII/DII Flow" value={pick.fiiFiiFlow} />
            </div>
            {newsList.slice(0, 2).map((n, i) => (
              <div key={i} className="flex gap-2 text-xs leading-relaxed py-1 border-b border-border/30 last:border-0">
                <span className={cn("font-bold shrink-0", n.impact === "POSITIVE" ? "text-emerald-500" : n.impact === "NEGATIVE" ? "text-red-500" : "text-muted-foreground")}>
                  {n.impact === "POSITIVE" ? "▲" : n.impact === "NEGATIVE" ? "▼" : "●"}
                </span>
                <span>{s(n.headline)} <span className="text-muted-foreground">· {s(n.source)} · {s(n.date)}</span></span>
              </div>
            ))}
          </div>

          {/* Catalysts + Horizon */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/15">
              <div className="text-[10px] font-bold text-amber-600 uppercase mb-1.5">Catalysts</div>
              {catalystList.map((c, i) => (
                <div key={i} className="flex gap-1.5 text-xs mb-1"><span className="text-amber-500">▶</span>{s(c)}</div>
              ))}
            </div>
            <div className="space-y-2">
              <div className="p-3 rounded-xl bg-muted/50">
                <div className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Short-Term Setup</div>
                <p className="text-xs leading-relaxed">{pick.shortTermSetup}</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/50">
                <div className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Long-Term Setup</div>
                <p className="text-xs leading-relaxed">{pick.longTermSetup}</p>
              </div>
            </div>
          </div>

          {/* Filters + Risks */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold mb-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />FILTERS PASSED</div>
              {filterList.map((f, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-border/30 last:border-0">
                  <span className="text-muted-foreground">{s(f.filter)}</span>
                  <div className="flex items-center gap-1">
                    <span className="font-semibold">{s(f.value)}</span>
                    {f.pass ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <XCircle className="w-3 h-3 text-red-500" />}
                  </div>
                </div>
              ))}
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold mb-2"><AlertTriangle className="w-3.5 h-3.5 text-red-500" />RISKS</div>
              {riskList.map((r, i) => (
                <div key={i} className="flex gap-2 text-xs py-1 leading-relaxed">
                  <span className="text-red-500 font-black shrink-0">•</span>{s(r)}
                </div>
              ))}
            </div>
          </div>

          {/* Red flags cleared */}
          <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex gap-2 items-start">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <div className="flex flex-wrap gap-1.5">
              {flagList.map((f, i) => (
                <span key={i} className="text-[10px] bg-emerald-500/10 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-500/20">✓ {s(f)}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const STEPS = ["Intelligence Gathering","Universe Filter","Technical Analysis","Fundamental Analysis","Catalyst ID","Horizon Assessment","Ranking & Output"];

function StepsProgress({ activeStep }: { activeStep: number }) {
  return (
    <div className="space-y-2">
      {STEPS.map((step, i) => (
        <div key={i} className={cn("flex items-center gap-3 text-xs transition-all", i < activeStep ? "text-emerald-600 font-semibold" : i === activeStep ? "text-foreground font-bold" : "text-muted-foreground")}>
          <div className={cn("w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-black transition-all", i < activeStep ? "bg-emerald-500 text-white" : i === activeStep ? "bg-foreground text-background animate-pulse" : "bg-muted text-muted-foreground")}>
            {i < activeStep ? "✓" : i + 1}
          </div>
          Step {i + 1}: {step}
        </div>
      ))}
    </div>
  );
}

// Extract clean ticker symbol for Yahoo (strips NSE:/BSE: prefix)
function toYahooSymbol(ticker: string): string {
  return ticker
    .replace(/^NSE:/i, "")
    .replace(/^BSE:/i, "")
    .replace(/\.(NS|BO)$/i, "")
    .trim()
    .toUpperCase();
}

export function RAPickDashboard({ onBack }: { onBack: () => void }) {
  const runPick = useServerFn(runRAPick);
  const { apiKey } = useGeminiKey();
  const [result, setResult] = useState<RAPickResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisStep, setAnalysisStep] = useState(0);

  // Derive ticker list from AI result — drives live price fetching
  const liveSymbols = result?.picks?.map(p => toYahooSymbol(p.ticker)) ?? [];
  const { quotes } = useLiveQuotes(liveSymbols);

  const handleRun = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setAnalysisStep(0);
    const interval = setInterval(() => {
      setAnalysisStep(prev => prev >= STEPS.length - 1 ? prev : prev + 1);
    }, 1800);
    try {
      const res = await runPick({ data: { apiKey: apiKey || undefined } });
      clearInterval(interval);
      setAnalysisStep(STEPS.length);
      if (res.error) setError(res.error);
      else setResult(res.result);
    } catch (e: any) {
      clearInterval(interval);
      setError(e.message || "Analysis failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-20 space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <button onClick={onBack} className="text-xs text-muted-foreground hover:text-foreground transition-colors mb-4 flex items-center gap-1">← Back to Home</button>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tighter sm:text-4xl">RA <span className="text-muted-foreground font-light">STOCK PICKS</span></h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">7-step SEBI RA-style analysis · 7–10 best undervalued picks ≤ ₹500 · Ranked by conviction</p>
          </div>
          <button onClick={handleRun} disabled={loading} id="ra-pick-run-btn"
            className="shrink-0 px-6 py-2.5 rounded-2xl bg-foreground text-background text-sm font-bold hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
            {loading ? "Analysing…" : result ? "Re-run Analysis" : "Run Analysis"}
          </button>
        </div>
      </div>

      {/* Info strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[{ label: "Price Filter", value: "≤ ₹500 CMP" }, { label: "Analysis Steps", value: "7 Steps" }, { label: "Picks", value: "7–10 Stocks" }, { label: "Sectors", value: "5+ Diversified" }].map(({ label, value }) => (
          <div key={label} className="p-3 rounded-2xl border border-border bg-card text-center">
            <div className="text-[9px] uppercase font-bold text-muted-foreground">{label}</div>
            <div className="text-sm font-black mt-0.5">{value}</div>
          </div>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid sm:grid-cols-2 gap-6">
          <div className="p-6 rounded-2xl border border-border bg-card">
            <div className="text-xs font-bold mb-4 text-muted-foreground uppercase">Analysis Progress</div>
            <StepsProgress activeStep={analysisStep} />
          </div>
          <div className="space-y-3 animate-pulse">
            {[1,2,3].map(i => <div key={i} className="h-28 rounded-2xl bg-muted" />)}
          </div>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="p-8 text-center space-y-4 border border-dashed rounded-3xl bg-red-500/5 border-red-500/20">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-lg font-bold">Analysis Failed</h2>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">{error}</p>
          <button onClick={handleRun} className="px-6 py-2 rounded-xl bg-foreground text-background text-sm font-bold">Try Again</button>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="space-y-4 animate-in fade-in duration-400">
          {/* Market Context Banner */}
          <div className="p-4 rounded-2xl border border-border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-bold text-muted-foreground uppercase mb-0.5">Market Context</div>
              <p className="text-sm">{result.marketContext}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {result.sectorThemes?.map((t, i) => (
                <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20 font-semibold">{t}</span>
              ))}
            </div>
          </div>

          {/* Summary */}
          {result.summary && (
            <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 flex gap-2.5">
              <Zap className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm">{result.summary}</p>
            </div>
          )}

          {/* Pick cards — #1 expanded by default */}
          <div className="space-y-3">
            {result.picks.map((pick, i) => {
              const sym = toYahooSymbol(pick.ticker);
              return <PickCard key={pick.ticker + i} pick={pick} defaultOpen={i === 0} quoteState={quotes[sym]} />;
            })}
          </div>

          {/* Disclaimer */}
          <div className="p-4 rounded-xl border border-border bg-muted/30 text-[10px] text-muted-foreground leading-relaxed">
            <span className="font-bold">SEBI DISCLAIMER:</span> This is for educational and informational purposes only. Not a solicitation to buy or sell securities. Conduct your own due diligence and consult a SEBI-registered financial advisor before investing. Past performance is not indicative of future results. Equity investments are subject to market risk.
            {result.dataNotice && <><br/><br/><span className="italic">{result.dataNotice}</span></>}
          </div>
          {result.sources?.length > 0 && (
            <div className="text-[10px] text-muted-foreground text-center">Sources: {result.sources.join(" · ")} · Analysis: {result.analysisDate}</div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && !error && (
        <div className="text-center py-20 border border-dashed rounded-3xl space-y-4">
          <div className="text-5xl">🔭</div>
          <h2 className="text-xl font-bold">Ready to Find the Top Picks?</h2>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto">7-step RA-grade analysis across 5+ sectors. Intelligence → Filters → Technical → Fundamental → Catalyst → Horizon → Ranked Picks.</p>
          <button onClick={handleRun} id="ra-pick-start-btn"
            className="px-8 py-3 rounded-2xl bg-foreground text-background font-bold transition-transform hover:scale-105 active:scale-95">
            Run 7-Step Analysis
          </button>
        </div>
      )}
    </div>
  );
}
