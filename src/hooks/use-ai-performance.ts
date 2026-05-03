// Hook: useAIPerformance
// Fetches all AI performance data from Supabase for the ⚡ AI Performance tab.
// No AI calls — pure Supabase reads.

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface RecommendationRow {
  id: string;
  symbol: string;
  tab_type: string;
  recommendation: string;
  strategy: string;
  entry_price: number;
  target_price: number;
  stop_loss: number;
  composite_score: number;
  ai_model_used: string;
  recommended_at: string;
  min_investment: number;
  outcome_label: string | null;
  profit_pct: number | null;
}

export interface LearningInsight {
  id: string;
  insight: string;
  insight_category: string;
  accuracy_before: number;
  sample_size: number;
  created_at: string;
}

export interface UserPrefs {
  id: string;
  max_investment: number;
  risk_appetite: "low" | "medium" | "high";
  preferred_horizon: "weekly" | "monthly" | "3months";
  preferred_sectors: string[];
}

export interface WinRateStats {
  overall: number;
  penny: number;
  nifty100: number;
  fo: number;
  bestStrategy: string;
  bestSector: string;
  totalTrades: number;
  winCount: number;
}

function calcWinRate(rows: RecommendationRow[], tab?: string): number {
  const filtered = tab ? rows.filter((r) => r.tab_type === tab) : rows;
  const resolved = filtered.filter((r) => r.outcome_label && r.outcome_label !== "PENDING");
  if (!resolved.length) return 0;
  return Math.round((resolved.filter((r) => r.outcome_label === "WIN").length / resolved.length) * 100);
}

export function useAIPerformance() {
  const [recommendations, setRecommendations] = useState<RecommendationRow[]>([]);
  const [insights, setInsights] = useState<LearningInsight[]>([]);
  const [prefs, setPrefs] = useState<UserPrefs | null>(null);
  const [stats, setStats] = useState<WinRateStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchAll() {
    setLoading(true);
    setError(null);
    try {
      // Fetch recommendations joined with outcomes (last 50)
      const { data: recs, error: recErr } = await supabase
        .from("recommendations")
        .select(`
          id, symbol, tab_type, recommendation, strategy,
          entry_price, target_price, stop_loss, composite_score,
          ai_model_used, recommended_at, min_investment,
          recommendation_outcomes(outcome_label, profit_pct)
        `)
        .order("recommended_at", { ascending: false })
        .limit(50);

      if (recErr) {
        console.error("Supabase Error:", recErr);
        toast.error(`Fetch failed: ${recErr.message}`);
        throw recErr;
      }

      console.log(`AI Performance: Found ${recs?.length ?? 0} recommendations.`);
      if (recs?.length === 0) {
        toast.warning("Database connected, but no recommendations found yet.");
      }

      // Flatten outcome join
      const flat: RecommendationRow[] = (recs ?? []).map((r: any) => ({
        id:              r.id,
        symbol:          typeof r.symbol === "object" ? JSON.stringify(r.symbol) : String(r.symbol),
        tab_type:        r.tab_type,
        recommendation:  r.recommendation,
        strategy:        typeof r.strategy === "object" ? JSON.stringify(r.strategy) : String(r.strategy ?? "—"),
        entry_price:     Number(r.entry_price),
        target_price:    Number(r.target_price),
        stop_loss:       Number(r.stop_loss),
        composite_score: r.composite_score,
        ai_model_used:   String(r.ai_model_used ?? "—"),
        recommended_at:  r.recommended_at,
        min_investment:  Number(r.min_investment),
        outcome_label:   r.recommendation_outcomes?.[0]?.outcome_label ?? null,
        profit_pct:      r.recommendation_outcomes?.[0]?.profit_pct ?? null,
      }));

      setRecommendations(flat);

      // Compute win-rate stats
      const strategyMap: Record<string, { wins: number; total: number }> = {};
      const sectorMap:   Record<string, { wins: number; total: number }> = {};
      flat.forEach((r) => {
        if (!r.outcome_label || r.outcome_label === "PENDING") return;
        const isWin = r.outcome_label === "WIN";
        if (r.strategy) {
          if (!strategyMap[r.strategy]) strategyMap[r.strategy] = { wins: 0, total: 0 };
          strategyMap[r.strategy].total++;
          if (isWin) strategyMap[r.strategy].wins++;
        }
        if (r.tab_type) {
          if (!sectorMap[r.tab_type]) sectorMap[r.tab_type] = { wins: 0, total: 0 };
          sectorMap[r.tab_type].total++;
          if (isWin) sectorMap[r.tab_type].wins++;
        }
      });

      const bestStrategy = Object.entries(strategyMap)
        .sort((a, b) => (b[1].wins / b[1].total) - (a[1].wins / a[1].total))[0]?.[0] ?? "N/A";
      const bestSector = Object.entries(sectorMap)
        .sort((a, b) => (b[1].wins / b[1].total) - (a[1].wins / a[1].total))[0]?.[0] ?? "N/A";

      const winCount = flat.filter((r) => r.outcome_label === "WIN").length;
      const totalTrades = flat.filter((r) => r.outcome_label && r.outcome_label !== "PENDING").length;

      setStats({
        overall:    calcWinRate(flat),
        penny:      calcWinRate(flat, "penny"),
        nifty100:   calcWinRate(flat, "nifty100"),
        fo:         calcWinRate(flat, "fo"),
        bestStrategy,
        bestSector,
        totalTrades,
        winCount,
      });

      // Fetch insights
      const { data: ins } = await supabase
        .from("ai_learning_log")
        .select("id, insight, insight_category, accuracy_before, sample_size, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      setInsights((ins ?? []).map((i: any) => ({
        ...i,
        insight: typeof i.insight === "object" ? JSON.stringify(i.insight) : String(i.insight)
      })));

      // Fetch user preferences
      const { data: pref } = await supabase
        .from("user_preferences")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      setPrefs(pref as UserPrefs | null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function savePrefs(updates: Partial<UserPrefs>) {
    if (prefs?.id) {
      await supabase.from("user_preferences")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", prefs.id);
    } else {
      await supabase.from("user_preferences").insert({ ...updates });
    }
    await fetchAll();
  }

  useEffect(() => { fetchAll(); }, []);

  return { recommendations, insights, prefs, stats, loading, error, refresh: fetchAll, savePrefs };
}
