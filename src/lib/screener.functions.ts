import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { callAIWithFallback, parseAIJson } from "./ai-provider";
import { gkCache, screenerCacheKey, checkMarketHours, CACHE_TTL } from "./perf-utils";
import { getLearningPrompt } from "./self-learning";

export interface ScreenerStock {
  company: string;
  ticker: string;
  sector: string;
  pe: string;
  sectorMedianPe?: string;
  roce: string;
  roe?: string;
  de: string;
  promoterPledging?: string;
  marketCap: string;
  undervaluedReason?: string;
  thesis: string;
  catalysts: string[];
  risks: string[];
  analystTarget?: string;
  upsidePct?: number;
  riskReward?: "LOW" | "MEDIUM" | "HIGH";
}

export interface ScreenerResult {
  picks: ScreenerStock[];
  sectors: string[];
  summary: string;
  learningTakeaway?: string;
  dataNotice: string;
  sources: string[];
  portfolioRationale?: string;
}

const InputSchema = z.object({
  kind: z.enum(["penny", "nifty100"]),
  apiKey: z.string().optional(),
});

const PRICE_DIRECTIVE = `PRICE / CMP DATA POLICY (mandatory):
- Always populate "price" with the MOST RECENT close price you can produce for the stock from your knowledge — do NOT use stale prices from years ago. Format like "₹84.50".
- Populate "priceAsOf" with the date you believe the price reflects (e.g. "as of last close" or "approx. <Month YYYY>"). If markets are closed, use the last trading day's close.
- All other figures (52W high/low, returns, ratios, holdings) should reflect the most recent fiscal/quarter data you have. Mark anything older than 6 months by adding "(stale)" to that field.
- Do not refuse to provide a price. If uncertain, give your best recent estimate and clearly note it in priceAsOf.`;

const PENNY_PROMPT = `Indian stock analyst task: Return exactly 10 undervalued PENNY STOCKS (price < ₹100) on NSE/BSE.
Guidelines: P/E < 35, ROCE > 10%, Promoter > 40%.
Return exactly 10 picks. If a stock doesn't meet all guidelines, pick it anyway to reach the 10-count.
Keep 'thesis' and 'undervaluedReason' to 1 concise sentence.
Limit 'catalysts' and 'risks' to exactly 2 short items each.`;

const NIFTY_PROMPT = `Indian stock analyst task: Return exactly 10 undervalued NIFTY 100 stocks.
Guidelines: P/E < sector median, ROCE > 15%, D/E < 1.2.
IMPORTANT: You MUST return exactly 10 stocks. If you cannot find perfect matches, pick the next best NIFTY 100 stocks to reach the count.
Format your response as a JSON object with a "picks" key containing an array of objects.`;


const SCHEMA = `{
  "picks": [
    {
      "company": "string",
      "ticker": "NSE:XXX",
      "sector": "string",
      "pe": "..x",
      "sectorMedianPe": "..x",
      "roe": "..%",
      "roce": "..%",
      "de": "..",
      "promoterPledging": "..%",
      "marketCap": "₹... Cr",
      "undervaluedReason": "specific reason (concise)",
      "thesis": "concise investment thesis",
      "catalysts": ["catalyst 1","catalyst 2"],
      "risks": ["risk 1","risk 2"],
      "analystTarget": "₹...",
      "upsidePct": 0,
      "riskReward": "LOW|MEDIUM|HIGH"
    }
  ],
  "sectors": ["sector1", "sector2"],
  "summary": "2-line overview",
  "learningTakeaway": "1-sentence on how you improved this list based on past wins/losses",
  "dataNotice": "notice",
  "sources": ["source1"]
}`;

export const runScreener = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<{ result: ScreenerResult | null; error: string | null; _fromCache?: boolean }> => {
    // Fix 2: cache-first — return cached AI result instantly
    // NOTE: If a custom apiKey is provided, we skip cache to ensure the user gets fresh results from their account
    const cacheKey = screenerCacheKey(data.kind);
    if (!data.apiKey) {
      const cached = gkCache.get<ScreenerResult>(cacheKey);
      if (cached) return { result: cached, error: null, _fromCache: true };
    }

    const prompt = data.kind === "penny" ? PENNY_PROMPT : NIFTY_PROMPT;
    const learningFeedback = await getLearningPrompt();
    const userPrompt = `${prompt}\n\n${learningFeedback}\n\nReturn ONLY valid JSON matching this schema (no prose, no fences):\n\n${SCHEMA}`;

    const aiRes = await callAIWithFallback([
      {
        role: "system",
        content:
          "You are an INDIAN STOCK SCREENER AI. Use the freshest data you have on NSE/BSE listed companies — always provide the latest close price you can recall (never stale multi-year-old prices). Live market data fetching is unavailable; clearly disclaim figures may need verification. Output ONLY valid JSON. EDUCATIONAL purposes, not SEBI-registered investment advice.",
      },
      { role: "user", content: userPrompt },
    ], data.apiKey);

    if (!aiRes.content) {
      return { result: null, error: aiRes.error ?? "AI request failed." };
    }

    const parsed = parseAIJson<ScreenerResult>(aiRes.content);
    if (!parsed) {
      return { result: null, error: "Could not parse AI response as JSON." };
    }

    // Cache the fresh result (only if it has enough data to be useful)
    if (parsed.picks.length >= 5) {
      const marketOpen = checkMarketHours();
      const ttl = marketOpen ? CACHE_TTL.penny_scanner : CACHE_TTL.after_market_close;
      gkCache.set(cacheKey, parsed, ttl);
    }
    
    // Log learning takeaway if provided
    if (parsed.learningTakeaway) {
      supabase.from("ai_learning_log").insert({
        insight: parsed.learningTakeaway,
        insight_category: data.kind,
        created_at: new Date().toISOString(),
      }).then(() => {}); // Fire and forget
    }
    
    return { result: parsed, error: null, _fromCache: false };
  });
