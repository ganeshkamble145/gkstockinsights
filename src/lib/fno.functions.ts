import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { callAIWithFallback, parseAIJson } from "./ai-provider";
import { gkCache, screenerCacheKey, checkMarketHours, CACHE_TTL } from "./perf-utils";
import { getLearningPrompt } from "./self-learning";

export interface FnoStrategy {
  name: string;
  marketOutlook: string;
  strikeSelection: string;
  expiry: "Weekly" | "Monthly" | string;
  entryCondition: string;
  exitCondition: string;
  stopLoss: string;
  maxProfit: string;
  maxRisk: string;
  riskReward: string;
  positionSizingTip: string;
}

export interface FnoStock {
  rank: number;
  company: string;
  symbol: string; // NSE symbol
  sector: string;
  cmp: string;
  cmpAsOf?: string;
  avgVolume: string; // contracts/day
  openInterest: string;
  bidAskSpread?: string;
  iv: string; // implied volatility
  fiiDiiActivity?: string;
  trend: "Bullish" | "Bearish" | "Sideways" | string;
  support: string;
  resistance: string;
  whyQualifies: string;
  inIndex?: string; // e.g., NIFTY 50 / NIFTY 100
  banStatus?: string; // e.g., "No ban — MWPL 42%"
  strategy: FnoStrategy;
}

export interface FnoResult {
  picks: FnoStock[];
  sectors: string[];
  bestThisWeek: { symbol: string; reason: string }[]; // top 3
  summary: string;
  learningTakeaway?: string;
  riskWarning: string;
  dataNotice: string;
  sources: string[];
}

const PROMPT = `You are an expert Indian stock market analyst and F&O trading strategist with deep knowledge of NSE derivatives markets.

TASK: Identify exactly 10 Indian stocks currently best suited for F&O trading.

SELECTION CRITERIA:
1. High daily trading volume (10 lakh+ contracts/day preferred)
2. High Open Interest (OI) and meaningful OI buildup
3. Tight bid-ask spreads (good liquidity)
4. Implied Volatility (IV) vs Historical Volatility (HV) context
5. Strong FII/DII participation and institutional volume profiling
6. Preferably part of NIFTY 50 or NIFTY 100
7. NOT in active F&O ban (no MWPL breach)

For each of the 10 stocks supply ALL fields in the JSON schema below.
Trader profile: ₹50,000 – ₹1,00,000 capital, conservative risk preference. Favour defined-risk strategies (spreads, iron condors) over naked options.
IMPORTANT: Keep all text fields (whyQualifies, strategy details) extremely concise (1-2 sentences max) to ensure the total response fits within token limits.

Then identify the TOP 3 best risk-reward picks for THIS WEEK with a one-line reason each citing Option Greeks and Max Pain data.

PRICE / CMP POLICY (mandatory):
- Always populate "cmp" with the MOST RECENT close price you can produce for the stock — never multi-year-old stale prices. Format like "₹2,845".
- Populate "cmpAsOf" with the date the price reflects (e.g. "last close" or "<Month YYYY>"). If markets are closed, use the last trading day's close.
- Support / resistance / IV should reflect the most recent levels you know.

Return ONLY valid JSON (no prose, no markdown fences) matching this schema:

{
  "picks": [
    {
      "rank": 1,
      "company": "string",
      "symbol": "RELIANCE",
      "sector": "string",
      "cmp": "₹...",
      "cmpAsOf": "last close",
      "avgVolume": "e.g. 12.5 lakh",
      "openInterest": "e.g. 1.8 Cr",
      "bidAskSpread": "e.g. ₹0.05",
      "iv": "e.g. 28%",
      "fiiDiiActivity": "note",
      "trend": "Bullish | Bearish | Sideways",
      "support": "₹... / ₹...",
      "resistance": "₹... / ₹...",
      "whyQualifies": "note",
      "inIndex": "NIFTY 50",
      "banStatus": "note",
      "greeks": "Delta: .., Theta: .., Gamma: ..",
      "pcrMaxPain": "PCR: .., Max Pain: ₹...",
      "strategy": {
        "name": "Bull Call Spread",
        "marketOutlook": "moderately bullish",
        "strikeSelection": "strikes",
        "expiry": "Weekly | Monthly",
        "entryCondition": "trigger",
        "exitCondition": "target",
        "stopLoss": "explicit SL",
        "maxProfit": "₹...",
        "maxRisk": "₹...",
        "riskReward": "1:2",
        "positionSizingTip": "1 lot"
      }
    }
  ],
  "sectors": ["sector1"],
  "bestThisWeek": [
    { "symbol": "SYMBOL", "reason": "reason" }
  ],
  "summary": "overview",
  "learningTakeaway": "1-sentence on strategy adjustment based on recent performance",
  "riskWarning": "warning",
  "dataNotice": "notice",
  "sources": ["source1"]
}`;

const InputSchema = z.object({
  apiKey: z.string().optional(),
});

export const runFno = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(
    async ({ data }): Promise<{ result: FnoResult | null; error: string | null; _fromCache?: boolean }> => {
      // Fix 2: cache-first for F&O scan (5 min TTL market hours)
      const cacheKey = screenerCacheKey("fo");
      if (!data.apiKey) {
        const cached = gkCache.get<FnoResult>(cacheKey);
        if (cached) return { result: cached, error: null, _fromCache: true };
      }

      const learningFeedback = await getLearningPrompt();
      const aiRes = await callAIWithFallback([
        {
          role: "system",
          content:
            "You are an INDIAN F&O DERIVATIVES STRATEGIST AI. Use the freshest knowledge you have on NSE F&O — always provide the latest close prices and IV levels you can recall (never multi-year-old stale prices). Live market data is unavailable; disclaim that figures must be verified on NSE option chain. Output ONLY valid JSON. EDUCATIONAL purposes only — NOT SEBI-registered investment advice.",
        },
        { role: "user", content: `${PROMPT}\n\n${learningFeedback}` },
      ], data.apiKey);

    if (!aiRes.content) {
      return { result: null, error: aiRes.error ?? "AI request failed." };
    }

    const parsed = parseAIJson<FnoResult>(aiRes.content);
    if (!parsed) {
      return { result: null, error: "Could not parse AI response as JSON." };
    }

    // Cache result
    const marketOpen = checkMarketHours();
    const ttl = marketOpen ? CACHE_TTL.fo_scan : CACHE_TTL.after_market_close;
    gkCache.set(cacheKey, parsed, ttl);

    // Log learning takeaway if provided
    if (parsed.learningTakeaway) {
      supabase.from("ai_learning_log").insert({
        insight: parsed.learningTakeaway,
        insight_category: "fo",
        created_at: new Date().toISOString(),
      }).then(() => {}); // Fire and forget
    }

    return { result: parsed, error: null, _fromCache: false };
  },
);
