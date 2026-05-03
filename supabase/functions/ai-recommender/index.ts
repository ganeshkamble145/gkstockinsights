// Supabase Edge Function: ai-recommender
// Builds a learning-aware AI recommendation for a given symbol + tab type.
// Reads past outcomes → calculates metrics → enriches Gemini prompt → saves result.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_KEY_TIER3 = Deno.env.get("GEMINI_API_KEY_TIER3") ?? "";
const GEMINI_KEY_FREE  = Deno.env.get("GEMINI_API_KEY_FREE") ?? "";

const GEMINI_MODELS = [
  { key: GEMINI_KEY_TIER3, model: "gemini-2.5-flash", level: 1 },
  { key: GEMINI_KEY_FREE,  model: "gemini-2.5-flash", level: 2 },
  { key: GEMINI_KEY_FREE,  model: "gemini-flash-latest", level: 2 },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callGemini(prompt: string): Promise<{ text: string; model: string; level: number } | null> {
  for (let i = 0; i < GEMINI_MODELS.length; i++) {
    const { key, model, level } = GEMINI_MODELS[i];
    if (!key) continue;
    if (i > 0) await sleep(3000);
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json", temperature: 0.7 },
          }),
        }
      );
      if (!res.ok) continue;
      const json = await res.json();
      const text: string = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      if (text) return { text, model, level };
    } catch { /* try next */ }
  }
  return null;
}

function calculateMetrics(outcomes: any[]) {
  if (!outcomes?.length) return {
    win_rate: 0, best_sector: "N/A", best_strategy: "N/A",
    underperforming_strategies: [], sector_win_rates: {}, strategy_win_rates: {},
  };
  const wins = outcomes.filter((o) => o.outcome_label === "WIN");
  const win_rate = Math.round((wins.length / outcomes.length) * 100);

  const bySector: Record<string, { wins: number; total: number }> = {};
  const byStrategy: Record<string, { wins: number; total: number }> = {};

  outcomes.forEach((o) => {
    const sector = o.recommendations?.tab_type ?? "unknown";
    const strat  = o.recommendations?.strategy  ?? "unknown";
    if (!bySector[sector]) bySector[sector] = { wins: 0, total: 0 };
    if (!byStrategy[strat]) byStrategy[strat] = { wins: 0, total: 0 };
    bySector[sector].total++;
    byStrategy[strat].total++;
    if (o.outcome_label === "WIN") { bySector[sector].wins++; byStrategy[strat].wins++; }
  });

  const sector_win_rates = Object.fromEntries(
    Object.entries(bySector).map(([k, v]) => [k, Math.round((v.wins / v.total) * 100)])
  );
  const strategy_win_rates = Object.fromEntries(
    Object.entries(byStrategy).map(([k, v]) => [k, Math.round((v.wins / v.total) * 100)])
  );
  const sortedStrats = Object.entries(strategy_win_rates).sort((a, b) => b[1] - a[1]);
  const best_strategy = sortedStrats[0]?.[0] ?? "N/A";
  const best_sector   = Object.entries(sector_win_rates).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "N/A";
  const underperforming_strategies = sortedStrats.filter(([, r]) => r < 40).map(([n]) => n);

  return { win_rate, best_sector, best_strategy, underperforming_strategies, sector_win_rates, strategy_win_rates };
}

async function fetchYahooData(symbol: string) {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.NS?interval=1d&range=5d`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta ?? {};
    return {
      cmp: meta.regularMarketPrice,
      previousClose: meta.previousClose,
      fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
      marketCap: meta.marketCap,
    };
  } catch { return {}; }
}

function buildPrompt(symbol: string, tabType: string, metrics: any, prefs: any, liveData: any, insights: any[]) {
  return `You are an expert Indian stock market analyst for NSE/BSE.
You specialise in high-probability trades with minimum capital under ₹1 lakh.

YOUR PAST PERFORMANCE (last 90 days of real tracked outcomes):
- Overall win rate: ${metrics.win_rate}%
- Best performing sector: ${metrics.best_sector} (${metrics.sector_win_rates[metrics.best_sector] ?? 0}% wins)
- Best strategy: ${metrics.best_strategy} (${metrics.strategy_win_rates[metrics.best_strategy] ?? 0}% wins)
- Strategies currently underperforming (avoid): ${metrics.underperforming_strategies.join(", ") || "None identified yet"}

RECENT AI INSIGHTS LEARNED FROM OUTCOMES:
${insights?.map((i: any) => `- ${i.insight}`).join("\n") || "- No insights yet — first analysis"}

USER PREFERENCES:
- Max investment: ₹${prefs?.max_investment ?? 50000}
- Risk appetite: ${prefs?.risk_appetite ?? "medium"}
- Preferred horizon: ${prefs?.preferred_horizon ?? "monthly"}
- Preferred sectors: ${prefs?.preferred_sectors?.join(", ") || "No preference"}

LIVE MARKET DATA (Yahoo Finance):
${JSON.stringify(liveData, null, 2)}

TASK — Analyse ${symbol} (NSE: ${symbol}.NS) for ${tabType} trading.
Base your analysis on:
- Live price data above
- Latest news (mentally search: "${symbol} NSE latest news April 2026")
- Q4 FY26 results if available
- Sector outlook for ${tabType}
${tabType === "fo" ? "- F&O: OI, PCR, IV, option chain data" : ""}

Return ONLY this exact JSON object (no markdown, no preamble):
{
  "verdict": "STRONG BUY",
  "score": 75,
  "confidence_pct": 80,
  "strategy": "Momentum Buy",
  "strategy_steps": ["step1", "step2", "step3"],
  "entry_price": 0,
  "target_price": 0,
  "stop_loss": 0,
  "min_investment": 0,
  "min_investment_label": "₹X,XXX (N shares at ₹XX)",
  "expected_return_pct": 15,
  "horizon_days": 30,
  "reasoning": "3-sentence explanation",
  "risks": ["risk1", "risk2", "risk3"],
  "catalysts": ["catalyst1", "catalyst2"],
  "best_case": "description",
  "worst_case": "description",
  "data_sources": ["Yahoo Finance", "NSE"],
  "technical": {
    "support1": 0, "support2": 0,
    "resistance1": 0, "resistance2": 0,
    "rsi": 50, "trend": "UPTREND",
    "above_200dma": true
  },
  "fo_data": {
    "oi": 0, "oi_change_pct": 0,
    "pcr": 0, "iv": 0,
    "recommended_strike": "N/A",
    "premium_per_unit": 0,
    "lot_size": 0,
    "lot_cost": 0
  }
}

RULES:
- Fill real numbers — never leave 0 for prices. Use live data above.
- min_investment must be ≤ ₹${prefs?.max_investment ?? 50000}.
- If confidence < 50, set verdict to HOLD or AVOID.
- Prioritise strategies with high win rates from past performance.
- Avoid: ${metrics.underperforming_strategies.join(", ") || "none"}.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type" } });

  try {
    const { symbol, tab_type } = await req.json();
    if (!symbol || !tab_type) return new Response(JSON.stringify({ error: "symbol and tab_type required" }), { status: 400 });

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // 1. Fetch past outcomes (last 90 days)
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: outcomes } = await sb.from("recommendation_outcomes")
      .select("*, recommendations(*)")
      .gte("checked_at", cutoff)
      .neq("outcome_label", "PENDING");

    // 2. Metrics + prefs + live data + insights
    const metrics = calculateMetrics(outcomes ?? []);
    const { data: prefs } = await sb.from("user_preferences").select("*").order("created_at", { ascending: false }).limit(1).single();
    const liveData = await fetchYahooData(symbol);
    const { data: insights } = await sb.from("ai_learning_log").select("insight, insight_category").order("created_at", { ascending: false }).limit(10);

    // 3. Build prompt + call Gemini
    const prompt = buildPrompt(symbol, tab_type, metrics, prefs, liveData, insights ?? []);
    const aiResult = await callGemini(prompt);
    if (!aiResult) return new Response(JSON.stringify({ error: "All AI models failed" }), { status: 503 });

    // 4. Parse JSON
    let rec: any;
    try {
      const clean = aiResult.text.replace(/```json|```/g, "").trim();
      rec = JSON.parse(clean);
    } catch {
      return new Response(JSON.stringify({ error: "JSON parse failed", raw: aiResult.text.slice(0, 200) }), { status: 422 });
    }

    // 5. Save recommendation
    const { data: saved, error: saveErr } = await sb.from("recommendations").insert({
      symbol,
      tab_type,
      recommendation:  rec.verdict,
      strategy:        rec.strategy,
      entry_price:     rec.entry_price,
      target_price:    rec.target_price,
      stop_loss:       rec.stop_loss,
      composite_score: rec.score,
      ai_reasoning:    rec.reasoning,
      ai_model_used:   aiResult.model,
      ai_level:        aiResult.level,
      min_investment:  rec.min_investment,
      expiry_date:     rec.expiry_date ?? null,
    }).select().single();

    if (saveErr) throw saveErr;

    // 6. Create PENDING outcome row
    await sb.from("recommendation_outcomes").insert({
      recommendation_id: saved.id,
      symbol,
      outcome_label: "PENDING",
    });

    return new Response(
      JSON.stringify({ recommendation: rec, saved, _ai: aiResult.model, _level: aiResult.level }),
      { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
