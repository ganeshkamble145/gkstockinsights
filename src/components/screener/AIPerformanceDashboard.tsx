// ⚡ AI Performance Dashboard
// Section A: Win-rate scorecard
// Section B: Past recommendations table (filterable)
// Section C: AI learning insights cards
// Section D: User preference settings form

import { useState, useMemo } from "react";
import { useAIPerformance, type RecommendationRow, type LearningInsight } from "@/hooks/use-ai-performance";
import { cn } from "@/lib/utils";

const SECTORS_OPTIONS = ["Banking", "IT", "Auto", "FMCG", "Pharma", "Energy"];
const INR = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

// ── Win-rate progress bar ──────────────────────────────────────────────────
function WinBar({ pct }: { pct: number }) {
  const color =
    pct >= 80 ? "bg-blue-500"
    : pct >= 60 ? "bg-amber-500"
    : "bg-emerald-500";
  return (
    <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

// ── Section A: Accuracy Scorecard ─────────────────────────────────────────
function SectionScorecard({ stats }: { stats: ReturnType<typeof useAIPerformance>["stats"] }) {
  if (!stats) return (
    <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
      No completed recommendations yet. AI outcomes appear here after 7 days.
    </div>
  );

  const tabs = [
    { label: "Overall", pct: stats.overall },
    { label: "Penny",   pct: stats.penny },
    { label: "NIFTY 100", pct: stats.nifty100 },
    { label: "F&O",     pct: stats.fo },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-base font-semibold flex items-center gap-2">
          ⚡ AI Win Rate <span className="text-xs text-muted-foreground font-normal">(last 30 days)</span>
        </h2>
        <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full border border-border">
          ⚡ Gemini 2.5 Flash
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {tabs.map((t) => (
          <div key={t.label} className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">{t.label}</span>
              <span className="font-semibold tabular-nums">{t.pct}%</span>
            </div>
            <WinBar pct={t.pct} />
          </div>
        ))}
      </div>

      <div className="border-t border-border pt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-muted-foreground text-xs uppercase tracking-wider">Best strategy this month</span>
          <p className="font-medium mt-0.5">{stats.bestStrategy}</p>
        </div>
        <div>
          <span className="text-muted-foreground text-xs uppercase tracking-wider">Best sector</span>
          <p className="font-medium mt-0.5 capitalize">{stats.bestSector}</p>
        </div>
        <div>
          <span className="text-muted-foreground text-xs uppercase tracking-wider">Total trades tracked</span>
          <p className="font-medium mt-0.5">{stats.totalTrades}</p>
        </div>
        <div>
          <span className="text-muted-foreground text-xs uppercase tracking-wider">Winning calls</span>
          <p className="font-medium mt-0.5 text-emerald-600 dark:text-emerald-400">{stats.winCount} ✓</p>
        </div>
      </div>
    </div>
  );
}

// ── Section B: Past Recommendations Table ─────────────────────────────────
type FilterKey = "All" | "WIN" | "LOSS" | "PARTIAL" | "PENDING" | "7d" | "30d";

function outcomeColor(label: string | null): string {
  switch (label) {
    case "WIN":     return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "LOSS":    return "bg-red-500/10 text-red-700 dark:text-red-300";
    case "PARTIAL": return "bg-amber-500/10 text-amber-700 dark:text-amber-300";
    default:        return "bg-secondary text-muted-foreground";
  }
}

function rowTone(label: string | null): string {
  switch (label) {
    case "WIN":     return "border-emerald-500/20 bg-emerald-500/5";
    case "LOSS":    return "border-red-500/20 bg-red-500/5";
    case "PARTIAL": return "border-amber-500/20 bg-amber-500/5";
    default:        return "";
  }
}

function SectionRecommendations({ rows }: { rows: RecommendationRow[] }) {
  const [filter, setFilter] = useState<FilterKey>("All");

  const filtered = useMemo(() => {
    const now = Date.now();
    return rows.filter((r) => {
      if (filter === "All")     return true;
      if (filter === "WIN" || filter === "LOSS" || filter === "PARTIAL" || filter === "PENDING")
        return r.outcome_label === filter;
      const age = (now - new Date(r.recommended_at).getTime()) / (24 * 60 * 60 * 1000);
      if (filter === "7d")  return age <= 7;
      if (filter === "30d") return age <= 30;
      return true;
    });
  }, [rows, filter]);

  const filters: FilterKey[] = ["All", "WIN", "LOSS", "PARTIAL", "PENDING", "7d", "30d"];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-base font-semibold">📋 Past Recommendations</h2>
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs border transition-colors",
                filter === f
                  ? "bg-foreground text-background border-foreground"
                  : "border-border text-muted-foreground hover:border-foreground/40"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No recommendations match this filter yet. Run analyses from the stock tabs to populate this table.
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-secondary text-muted-foreground">
                <tr>
                  {["Date", "Stock", "Strategy", "AI Model", "Entry", "Target", "SL", "Result", "P&L%"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className={cn("border-t border-border", rowTone(r.outcome_label))}>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {new Date(r.recommended_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                    </td>
                    <td className="px-3 py-2 font-medium whitespace-nowrap">{r.symbol}</td>
                    <td className="px-3 py-2 max-w-[140px] truncate" title={r.strategy}>{r.strategy ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{r.ai_model_used ?? "—"}</td>
                    <td className="px-3 py-2 tabular-nums">₹{INR.format(r.entry_price)}</td>
                    <td className="px-3 py-2 tabular-nums">₹{INR.format(r.target_price)}</td>
                    <td className="px-3 py-2 tabular-nums">₹{INR.format(r.stop_loss)}</td>
                    <td className="px-3 py-2">
                      <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", outcomeColor(r.outcome_label))}>
                        {r.outcome_label ?? "PENDING"}
                      </span>
                    </td>
                    <td className={cn("px-3 py-2 tabular-nums font-medium",
                      r.profit_pct != null && r.profit_pct > 0 ? "text-emerald-600 dark:text-emerald-400"
                      : r.profit_pct != null && r.profit_pct < 0 ? "text-red-600 dark:text-red-400"
                      : "text-muted-foreground"
                    )}>
                      {r.profit_pct != null ? `${r.profit_pct > 0 ? "+" : ""}${r.profit_pct.toFixed(2)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Section C: AI Learning Insights ───────────────────────────────────────
function SectionInsights({ insights }: { insights: LearningInsight[] }) {
  const catColor: Record<string, string> = {
    strategy:        "bg-blue-500/10 text-blue-700 dark:text-blue-300",
    timing:          "bg-purple-500/10 text-purple-700 dark:text-purple-300",
    sector:          "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    risk_management: "bg-red-500/10 text-red-700 dark:text-red-300",
    entry_criteria:  "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  };

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">💡 What AI Learned This Month</h2>
      {insights.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Insights appear here after AI analyses outcomes of past recommendations (7, 14, 30-day checkpoints).
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {insights.map((ins) => (
            <div key={ins.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
              <p className="text-sm leading-snug">💡 {ins.insight}</p>
              <div className="flex flex-wrap items-center gap-2 text-[10px]">
                <span className={cn("px-2 py-0.5 rounded-full font-medium capitalize",
                  catColor[ins.insight_category] ?? "bg-secondary text-muted-foreground"
                )}>
                  {ins.insight_category}
                </span>
                <span className="text-muted-foreground">
                  Sample: {ins.sample_size} trades
                </span>
                {ins.accuracy_before != null && (
                  <span className="text-muted-foreground">
                    Win rate at time: {ins.accuracy_before}%
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Section D: User Preference Settings ───────────────────────────────────
function SectionPreferences({
  prefs,
  savePrefs,
}: {
  prefs: ReturnType<typeof useAIPerformance>["prefs"];
  savePrefs: ReturnType<typeof useAIPerformance>["savePrefs"];
}) {
  const [maxInv,    setMaxInv]    = useState(prefs?.max_investment ?? 50000);
  const [risk,      setRisk]      = useState<"low" | "medium" | "high">(prefs?.risk_appetite ?? "medium");
  const [horizon,   setHorizon]   = useState<"weekly" | "monthly" | "3months">(prefs?.preferred_horizon ?? "monthly");
  const [sectors,   setSectors]   = useState<string[]>(prefs?.preferred_sectors ?? []);
  const [saved,     setSaved]     = useState(false);
  const [saving,    setSaving]    = useState(false);

  const toggleSector = (s: string) =>
    setSectors((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);

  const handleSave = async () => {
    setSaving(true);
    await savePrefs({ max_investment: maxInv, risk_appetite: risk, preferred_horizon: horizon, preferred_sectors: sectors });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-6">
      <h2 className="text-base font-semibold">⚙️ Your Preferences</h2>
      <p className="text-xs text-muted-foreground -mt-4">
        These preferences are fed into every future AI recommendation to personalise analysis.
      </p>

      {/* Max investment slider */}
      <div>
        <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
          Max investment per trade
        </label>
        <div className="flex items-center gap-3">
          <input
            type="range" min={10000} max={100000} step={5000}
            value={maxInv} onChange={(e) => setMaxInv(Number(e.target.value))}
            className="flex-1 accent-foreground"
          />
          <span className="text-sm font-semibold tabular-nums w-20 text-right">
            ₹{INR.format(maxInv)}
          </span>
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
          <span>₹10,000</span><span>₹1,00,000</span>
        </div>
      </div>

      {/* Risk appetite */}
      <div>
        <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
          Risk appetite
        </label>
        <div className="flex gap-2">
          {(["low", "medium", "high"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRisk(r)}
              className={cn(
                "px-4 py-1.5 rounded-full text-xs border capitalize transition-colors",
                risk === r
                  ? "bg-foreground text-background border-foreground font-medium"
                  : "border-border text-muted-foreground hover:border-foreground/40"
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Horizon */}
      <div>
        <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
          Preferred horizon
        </label>
        <div className="flex gap-2 flex-wrap">
          {([
            { v: "weekly" as const, l: "Weekly" },
            { v: "monthly" as const, l: "Monthly" },
            { v: "3months" as const, l: "3 Months" },
          ]).map(({ v, l }) => (
            <button
              key={v}
              onClick={() => setHorizon(v)}
              className={cn(
                "px-4 py-1.5 rounded-full text-xs border transition-colors",
                horizon === v
                  ? "bg-foreground text-background border-foreground font-medium"
                  : "border-border text-muted-foreground hover:border-foreground/40"
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Preferred sectors */}
      <div>
        <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
          Preferred sectors <span className="normal-case">(multi-select)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {SECTORS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => toggleSector(s)}
              className={cn(
                "px-3 py-1 rounded-full text-xs border transition-colors",
                sectors.includes(s)
                  ? "bg-foreground text-background border-foreground font-medium"
                  : "border-border text-muted-foreground hover:border-foreground/40"
              )}
            >
              {sectors.includes(s) ? "✓ " : ""}{s}
            </button>
          ))}
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {saving ? "Saving…" : "Save Preferences"}
        </button>
        {saved && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400">
            ✓ Preferences saved — AI will use these in the next recommendation
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────
export function AIPerformanceDashboard({ onBack }: { onBack: () => void }) {
  const { recommendations, insights, prefs, stats, loading, error, refresh, savePrefs } = useAIPerformance();

  return (
    <div className="max-w-6xl mx-auto pb-12 space-y-8">
      <button onClick={onBack} className="mb-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
        ← Back to home
      </button>

      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">⚡ AI Performance</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Self-improving AI intelligence layer — tracks every recommendation against real outcomes
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="px-3 py-1.5 rounded-full border border-border text-xs hover:border-foreground/40 transition-colors disabled:opacity-50"
        >
          {loading ? "Loading…" : "🔄 Refresh"}
        </button>
      </header>

      {error && (
        <div className="rounded-lg border border-r-border bg-r-fill px-4 py-3 text-sm text-r-text">{error}</div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* A: Scorecard */}
          <SectionScorecard stats={stats} />

          {/* B: Past recommendations table */}
          <SectionRecommendations rows={recommendations} />

          {/* C: Learning insights */}
          <SectionInsights insights={insights} />

          {/* D: User preferences */}
          <SectionPreferences prefs={prefs} savePrefs={savePrefs} />
        </>
      )}

      <p className="text-[11px] text-muted-foreground border-t border-border pt-4 leading-relaxed">
        AI outcomes are tracked automatically at 7, 14, and 30 days via the outcome-tracker edge function.
        Learning insights are generated by Gemini from each completed trade and fed back into future prompts.
        Win rates improve as more trades are completed. Educational tool — not SEBI-registered advice.
      </p>
    </div>
  );
}
