// Supabase Edge Function: outcome-tracker
// Scheduled via pg_cron: '30 10 * * 1-5' (4:00 PM IST every weekday)
// Checks all PENDING recommendations at 7/14/30-day milestones,
// fetches live prices, classifies outcomes, and generates AI learning insights.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL        = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY= Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_KEY_TIER3    = Deno.env.get("GEMINI_API_KEY_TIER3") ?? "";
const GEMINI_KEY_FREE     = Deno.env.get("GEMINI_API_KEY_FREE")  ?? "";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callGeminiForInsight(prompt: string): Promise<string | null> {
  const configs = [
    { key: GEMINI_KEY_TIER3, model: "gemini-2.5-flash" },
    { key: GEMINI_KEY_FREE,  model: "gemini-flash-latest" },
  ];
  for (let i = 0; i < configs.length; i++) {
    const { key, model } = configs[i];
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
            generationConfig: { responseMimeType: "application/json", temperature: 0.5 },
          }),
        }
      );
      if (!res.ok) continue;
      const json = await res.json();
      return json.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
    } catch { /* try next */ }
  }
  return null;
}

async function fetchCurrentPrice(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.NS?interval=1d&range=1d`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );
    const data = await res.json();
    return data?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
  } catch { return null; }
}

async function generateInsight(rec: any, outcome: string, profitPct: number, currentPrice: number, sb: any) {
  const prompt = `You are an Indian stock market AI learning from real trade outcomes.

COMPLETED TRADE:
Symbol: ${rec.symbol} | Sector: ${rec.tab_type}
Strategy: ${rec.strategy}
Entry: ₹${rec.entry_price} | Target: ₹${rec.target_price} | SL: ₹${rec.stop_loss}
Current price: ₹${currentPrice}
Outcome: ${outcome} | P&L: ${profitPct.toFixed(2)}%
AI confidence was: ${rec.composite_score}/100
AI reasoning was: ${rec.ai_reasoning}

Return ONLY this JSON (no markdown):
{
  "insight": "one sentence — what to do differently next time",
  "category": "strategy",
  "should_increase_weight": true,
  "confidence_adjustment": 5
}
category must be one of: strategy | timing | sector | risk_management | entry_criteria`;

  const raw = await callGeminiForInsight(prompt);
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());

    const { count: totalCount } = await sb.from("recommendation_outcomes")
      .select("*", { count: "exact", head: true }).neq("outcome_label", "PENDING");
    const { count: winCount } = await sb.from("recommendation_outcomes")
      .select("*", { count: "exact", head: true }).eq("outcome_label", "WIN");

    const win_rate = (totalCount ?? 0) > 0 ? Math.round(((winCount ?? 0) / (totalCount ?? 1)) * 100) : 0;

    await sb.from("ai_learning_log").insert({
      insight:          parsed.insight ?? "No insight generated",
      insight_category: parsed.category ?? "strategy",
      accuracy_before:  win_rate,
      accuracy_after:   null,
      sample_size:      totalCount ?? 0,
    });
  } catch { /* skip on parse error */ }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type" } });
  }

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const now = new Date();

    // Fetch all PENDING outcomes with their recommendation
    const { data: pending, error: fetchErr } = await sb
      .from("recommendation_outcomes")
      .select("*, recommendations(*)")
      .eq("outcome_label", "PENDING");

    if (fetchErr) throw fetchErr;

    const processed: string[] = [];
    const skipped: string[] = [];

    for (const record of pending ?? []) {
      const rec = record.recommendations;
      if (!rec) { skipped.push(record.id); continue; }

      const ageMs = now.getTime() - new Date(rec.recommended_at).getTime();
      const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));

      // Only process at 7d, 14d, or 30d milestones
      if (ageDays < 7) { skipped.push(record.id); continue; }

      const price = await fetchCurrentPrice(rec.symbol);
      if (!price) { skipped.push(record.id); continue; }

      // Classify outcome
      const entryPrice  = Number(rec.entry_price) || price;
      const targetPrice = Number(rec.target_price) || price * 1.15;
      const stopLoss    = Number(rec.stop_loss)    || price * 0.92;

      const target_hit = price >= targetPrice;
      const stop_hit   = price <= stopLoss;
      const profit_pct = ((price - entryPrice) / entryPrice) * 100;

      const outcome_label = target_hit ? "WIN"
                          : stop_hit   ? "LOSS"
                          : profit_pct > 0 ? "PARTIAL" : "LOSS";

      const updateData: Record<string, any> = {
        outcome_label,
        target_hit,
        stop_hit,
        profit_pct: Math.round(profit_pct * 100) / 100,
        checked_at: now.toISOString(),
      };
      if (ageDays >= 7  && !record.price_at_7d)  updateData.price_at_7d  = price;
      if (ageDays >= 14 && !record.price_at_14d) updateData.price_at_14d = price;
      if (ageDays >= 30 && !record.price_at_30d) updateData.price_at_30d = price;

      await sb.from("recommendation_outcomes").update(updateData).eq("id", record.id);

      // Generate learning insight via Gemini
      await generateInsight(rec, outcome_label, profit_pct, price, sb);

      processed.push(`${rec.symbol} → ${outcome_label} (${profit_pct.toFixed(1)}%)`);
    }

    return new Response(
      JSON.stringify({ processed, skipped: skipped.length, timestamp: now.toISOString() }),
      { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
