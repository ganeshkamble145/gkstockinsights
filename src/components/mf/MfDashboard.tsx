import { useState, useEffect, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { runMfScreener, type MfResult, type MfFund } from "@/lib/mf.functions";
import { calculateMFScore, type MfCompositeBreakdown } from "@/lib/scoring";
import { cn } from "@/lib/utils";
import { useGeminiKey } from "@/hooks/use-gemini-key";
import { SkeletonTable, PerformanceFooter } from "@/components/screener/PerfUI";
import { toast } from "sonner";
import { Badge } from "@/components/report/Badge";
import { ChevronDown, ChevronUp, ExternalLink, Info, ShieldCheck, Zap } from "lucide-react";

const INR = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

export function MfDashboard({ onBack }: { onBack: () => void }) {
  const run = useServerFn(runMfScreener);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<MfResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { apiKey } = useGeminiKey();
  const [activeCategory, setActiveCategory] = useState("All");

  const fetchFunds = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await run({ data: { apiKey: apiKey || undefined } });
      if (res.error) {
        setError(res.error);
        toast.error(res.error);
      } else {
        setResult(res.result);
      }
    } catch (e) {
      setError("Failed to fetch mutual fund data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFunds();
  }, []);

  const categories = useMemo(() => {
    if (!result?.funds) return ["All"];
    const set = new Set(result.funds.map(f => f.category));
    return ["All", ...Array.from(set)];
  }, [result]);

  const filtered = useMemo(() => {
    return (result?.funds ?? []).filter(f => activeCategory === "All" || f.category === activeCategory);
  }, [result, activeCategory]);

  return (
    <div className="max-w-6xl mx-auto pb-20 space-y-8 animate-in fade-in duration-500">
      <header className="space-y-4">
        <button onClick={onBack} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          ← Back to home
        </button>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
              Mutual Fund Recommender
            </h1>
            <p className="text-muted-foreground text-sm max-w-2xl">
              Institutional-grade dual analysis of India's top performing funds. 
              Powered by real-time AMFI data and independent AI reasoning.
            </p>
          </div>
          <button 
            onClick={fetchFunds}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-all disabled:opacity-50"
          >
            {loading ? "Discovering..." : "🔄 Refresh Rankings"}
          </button>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs border transition-all",
                activeCategory === cat 
                  ? "bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-500/20" 
                  : "bg-background border-border text-muted-foreground hover:border-emerald-500/50"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </header>

      {error ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-muted/30">
          <p className="text-muted-foreground mb-4">{error}</p>
          <button onClick={fetchFunds} className="text-emerald-600 text-sm font-medium underline">Try Again</button>
        </div>
      ) : loading ? (
        <div className="space-y-8 py-12">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-600 rounded-full animate-spin" />
              <Zap className="w-6 h-6 text-emerald-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold">Discovering Top Funds</h2>
              <p className="text-sm text-muted-foreground animate-bounce">🔍 Searching AMFI, Value Research, and Morningstar...</p>
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-64 rounded-2xl bg-muted/30 animate-pulse" />)}
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Market Context Banner */}
          {result?.market_context && (
            <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 flex gap-3 items-start">
              <Zap className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-sm text-emerald-900/80 dark:text-emerald-200/80 leading-relaxed">
                <span className="font-semibold text-emerald-700 dark:text-emerald-300">Market Intelligence:</span> {result.market_context}
                {result.search_summary && (
                  <span className="block mt-1 text-[10px] opacity-70 border-t border-emerald-500/10 pt-1">
                    🔍 {result.search_summary}
                  </span>
                )}
              </p>
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-1">
            {filtered.map((fund) => (
              <MfFundCard key={fund.fund_name} fund={fund} />
            ))}
            {filtered.length === 0 && !loading && (
              <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-muted/30">
                <p className="text-muted-foreground mb-4">No mutual funds discovered. This usually happens when the AI analysis times out or returns invalid data.</p>
                <button onClick={fetchFunds} className="text-emerald-600 text-sm font-medium underline">⚡ Force Re-run Analysis</button>
              </div>
            )}
          </div>

          <div className="pt-8 border-t border-border text-[10px] text-muted-foreground space-y-2 italic">
            <p>Analyst data sourced from public research and rating agencies via web search. AI view is independently reasoned from verified data. Not SEBI-registered investment advice.</p>
            <p>Past performance is not indicative of future returns. Mutual fund investments are subject to market risks. Read all scheme-related documents carefully before investing.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function MfFundCard({ fund }: { fund: MfFund }) {
  const [expanded, setExpanded] = useState(false);
  const score = useMemo(() => calculateMFScore(fund), [fund]);

  const signalColor = {
    STRONG: "bg-emerald-500 text-white",
    MODERATE: "bg-blue-500 text-white",
    CONFLICTED: "bg-amber-500 text-white",
    WEAK: "bg-slate-500 text-white",
    AVOID: "bg-red-500 text-white",
  }[fund.signal?.strength || "WEAK"] || "bg-slate-500";

  return (
    <div className={cn(
      "group rounded-2xl border border-border bg-card transition-all duration-300",
      expanded ? "shadow-2xl shadow-emerald-500/5" : "hover:shadow-lg hover:border-emerald-500/30"
    )}>
      {/* Header Info */}
      <div className="p-5 sm:p-6 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">#{fund.rank}</span>
              <h3 className="font-bold text-lg leading-tight group-hover:text-emerald-600 transition-colors">{fund.fund_name}</h3>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{fund.amc}</span>
              <span>•</span>
              <span>{fund.category}</span>
              <span>•</span>
              <span className="tabular-nums">NAV: ₹{fund.nav ?? "—"} ({fund.nav_date ?? fund.performance?.returns_source?.split("·")[1]?.trim() ?? "Latest"})</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Score</div>
              <div className={cn("text-2xl font-black tabular-nums", 
                score.composite >= 80 ? "text-emerald-600" : score.composite >= 65 ? "text-blue-600" : "text-amber-600")}>
                {score.composite}
              </div>
            </div>
            <div className={cn("px-4 py-2 rounded-xl text-center min-w-[100px]", 
              score.tier.color === 'green' ? "bg-emerald-500/10 text-emerald-700" : 
              score.tier.color === 'blue' ? "bg-blue-500/10 text-blue-700" : "bg-amber-500/10 text-amber-700")}>
              <div className="text-[10px] font-bold uppercase">{score.tier.label}</div>
              <div className="text-sm">{score.tier.badge}</div>
            </div>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          <StatBox label="1Y Return" value={fund.performance?.return_1y_pct ? `${fund.performance.return_1y_pct > 0 ? "+" : ""}${fund.performance.return_1y_pct}%` : "—"} />
          <StatBox label="3Y CAGR" value={fund.performance?.return_3y_cagr_pct ? `${fund.performance.return_3y_cagr_pct}%` : "—"} />
          <StatBox label="5Y CAGR" value={fund.performance?.return_5y_cagr_pct ? `${fund.performance.return_5y_cagr_pct}%` : "—"} />
          <StatBox label="Alpha" value={fund.performance?.alpha_vs_benchmark_pct ? `${fund.performance.alpha_vs_benchmark_pct > 0 ? "+" : ""}${fund.performance.alpha_vs_benchmark_pct}%` : "—"} />
        </div>

        {/* Dual View Summary Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <div className="p-4 rounded-xl border border-border bg-muted/20 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
            <div className="text-[10px] font-bold text-blue-600 uppercase mb-1">📊 Research Desk</div>
            <div className="text-xs font-semibold">{fund.research_desk?.recommendation || "NEUTRAL"}</div>
            <div className="text-[10px] text-muted-foreground mt-1 line-clamp-1">{fund.research_desk?.expert_consensus || "No consensus data."}</div>
          </div>
          <div className="p-4 rounded-xl border border-border bg-muted/20 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
            <div className="text-[10px] font-bold text-emerald-600 uppercase mb-1">🤖 AI Analyst</div>
            <div className="text-xs font-semibold">{fund.ai_analyst?.recommendation || "NEUTRAL"}</div>
            <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-2">
              Confidence: {fund.ai_analyst?.confidence || "LOW"} • 
              {fund.ai_analyst?.agrees_with_research_desk ? "✅ Agrees with Desk" : "⚠️ Conflicts with Desk"}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-5">
          <div className={cn("px-3 py-1 rounded-full text-[10px] font-bold uppercase", signalColor)}>
            {fund.signal?.strength || "WEAK"} SIGNAL — {fund.signal?.direction || "WAIT"}
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            {expanded ? "Collapse details" : "Expand for full AI thinking"}
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </div>
        </div>
      </div>

      {/* Expanded View */}
      {expanded && (
        <div className="border-t border-border p-6 space-y-8 bg-muted/10 animate-in slide-in-from-top-2 duration-300">
          {/* Section 1: AI Thinking */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-600" /> AI Deep Reasoning
            </h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <ThinkingStep title="Return Quality" content={fund.ai_analyst?.thinking?.return_quality || "—"} />
              <ThinkingStep title="Risk & Volatility" content={fund.ai_analyst?.thinking?.risk_adjusted_performance || "—"} />
              <ThinkingStep title="Cost Efficiency" content={fund.ai_analyst?.thinking?.cost_efficiency || "—"} />
              <ThinkingStep title="Fund Manager" content={fund.ai_analyst?.thinking?.fund_manager_quality || "—"} />
              <ThinkingStep title="Portfolio Mix" content={fund.ai_analyst?.thinking?.portfolio_quality || "—"} />
              <ThinkingStep title="Final Verdict" content={fund.ai_analyst?.thinking?.independent_verdict || "—"} />
            </div>
          </div>

          {/* Section 2: Suitability & Corpus */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="text-sm font-bold flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" /> Suitability Matrix
              </h4>
              <div className="space-y-2">
                <SuitabilityRow label="Conservative" result={fund.ai_analyst?.suitability?.conservative_investor || "—"} />
                <SuitabilityRow label="Moderate" result={fund.ai_analyst?.suitability?.moderate_investor || "—"} />
                <SuitabilityRow label="Aggressive" result={fund.ai_analyst?.suitability?.aggressive_investor || "—"} />
                <SuitabilityRow label="Tax Saver" result={fund.ai_analyst?.suitability?.tax_saver_80c || "—"} />
              </div>
            </div>
            <div className="space-y-4">
              <h4 className="text-sm font-bold flex items-center gap-2">
                <Info className="w-4 h-4 text-emerald-600" /> Future Illustration
              </h4>
              <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 space-y-3">
                <p className="text-xs leading-relaxed text-emerald-900/80 dark:text-emerald-100/80 italic">
                  "{fund.ai_analyst?.target_corpus_illustration || "Growth illustration data unavailable."}"
                </p>
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-emerald-500/10">
                  <div>
                    <div className="text-[10px] text-emerald-600/70 uppercase">Ideal SIP</div>
                    <div className="text-sm font-bold">₹{fund.ai_analyst?.ideal_sip_amount || "0"}/mo</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-emerald-600/70 uppercase">Min Horizon</div>
                    <div className="text-sm font-bold">{fund.ai_analyst?.ideal_horizon_years || "0"} Years</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Holdings & Ratings */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Top Holdings</h4>
              <div className="space-y-2">
                {(fund.top_holdings ?? []).map((h, i) => (
                  <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-border/50 last:border-0">
                    <span className="font-medium">{h.stock}</span>
                    <span className="tabular-nums text-muted-foreground">{h.weight_pct}%</span>
                  </div>
                ))}
                {(fund.top_holdings ?? []).length === 0 && <p className="text-[10px] text-muted-foreground">No holdings data found.</p>}
              </div>
            </div>
            <div className="space-y-3">
              <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Rating Agency Logs</h4>
              <div className="grid grid-cols-2 gap-3">
                <RatingPill label="Value Research" value={fund.ratings?.value_research_stars || "Unrated"} />
                <RatingPill label="Morningstar" value={fund.ratings?.morningstar_medal || "Unrated"} />
                <RatingPill label="Crisil Rank" value={fund.ratings?.crisil_rank || "Unrated"} />
                <RatingPill label="Risk Level" value={fund.risk_metrics?.risk_level || "—"} />
              </div>
            </div>
          </div>

          {/* Section 4: Research Desk Full Details */}
          <div className="p-5 rounded-2xl border border-blue-500/10 bg-blue-500/5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-blue-700 dark:text-blue-300 uppercase tracking-widest">Research Desk Dossier</h4>
              <Badge variant="blue" label={fund.research_desk?.recommendation || "NEUTRAL"} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-blue-600 uppercase">Key Expert Positives</p>
                <ul className="list-disc list-inside text-xs space-y-1 text-muted-foreground">
                  {(fund.research_desk?.key_positives ?? []).map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-red-600 uppercase">Analyst Concerns</p>
                <ul className="list-disc list-inside text-xs space-y-1 text-muted-foreground">
                  {(fund.research_desk?.key_concerns ?? []).map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </div>
            </div>
            <div className="pt-3 border-t border-blue-500/10">
              <p className="text-xs leading-relaxed text-muted-foreground">
                <span className="font-semibold text-blue-700 dark:text-blue-300">Summary:</span> {fund.research_desk?.summary || "Dossier summary unavailable."}
              </p>
            </div>
          </div>

          {/* Section 5: Bull/Bear/Risk */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="p-4 rounded-xl border border-emerald-500/10 bg-emerald-500/5">
              <div className="text-[10px] font-bold text-emerald-600 uppercase mb-1">🐂 Bull Case</div>
              <p className="text-[11px] leading-tight text-muted-foreground">{fund.ai_analyst?.bull_case || "—"}</p>
            </div>
            <div className="p-4 rounded-xl border border-red-500/10 bg-red-500/5">
              <div className="text-[10px] font-bold text-red-600 uppercase mb-1">🐻 Bear Case</div>
              <p className="text-[11px] leading-tight text-muted-foreground">{fund.ai_analyst?.bear_case || "—"}</p>
            </div>
            <div className="p-4 rounded-xl border border-amber-500/10 bg-amber-500/5">
              <div className="text-[10px] font-bold text-amber-600 uppercase mb-1">⚠️ Key Risk</div>
              <p className="text-[11px] leading-tight text-muted-foreground">{fund.ai_analyst?.key_risk || "—"}</p>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-4">
            <div className="flex items-center gap-4">
              <span>Data Quality: <span className={cn("font-bold", fund.data_quality === 'COMPLETE' ? "text-emerald-600" : "text-amber-600")}>{fund.data_quality}</span></span>
              <span>Min SIP: ₹{fund.costs?.min_sip_amount || "0"}</span>
            </div>
            <div className="flex items-center gap-2">
              {(fund.research_desk?.sources ?? []).slice(0, 2).map((s, i) => (
                <a key={i} href={s.url} target="_blank" rel="noopener" className="flex items-center gap-1 hover:text-foreground">
                  {s.name} <ExternalLink className="w-2 h-2" />
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value }: { label: string, value: string }) {
  return (
    <div className="p-3 rounded-xl border border-border bg-muted/10">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{label}</div>
      <div className="text-sm font-bold tabular-nums">{value}</div>
    </div>
  );
}

function ThinkingStep({ title, content }: { title: string, content: string }) {
  return (
    <div className="p-3 rounded-xl border border-border bg-muted/20 space-y-1">
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{title}</div>
      <p className="text-[10px] leading-relaxed line-clamp-3 hover:line-clamp-none transition-all">{content}</p>
    </div>
  );
}

function SuitabilityRow({ label, result }: { label: string, result: string }) {
  const isSuitable = result.includes("SUITABLE") && !result.includes("NOT SUITABLE");
  return (
    <div className="flex items-start gap-2 py-1">
      <div className={cn("shrink-0 w-1.5 h-1.5 rounded-full mt-1.5", isSuitable ? "bg-emerald-500" : "bg-slate-300")} />
      <div className="text-[11px]">
        <span className="font-bold">{label}: </span>
        <span className="text-muted-foreground">{result}</span>
      </div>
    </div>
  );
}

function RatingPill({ label, value }: { label: string, value: string }) {
  return (
    <div className="px-3 py-2 rounded-lg bg-muted/30 border border-border/50 text-[10px]">
      <div className="text-muted-foreground font-medium mb-0.5">{label}</div>
      <div className="font-bold">{value}</div>
    </div>
  );
}
